import { randomUUID } from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { resolveUsageAccess } from '../middleware/usage.js';
import { getEffectiveLimits } from '../services/admin-settings.service.js';
import { prisma } from '../config/database.js';
import { verifyAccessToken } from '../utils/tokens.js';

export const collaborationRouter = Router();

interface CollaboratorContext {
  userId: string;
  workspaceId: string;
  name: string;
  tier: SubscriptionTier;
}

interface CollaborationClient {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  res: Response;
}

const rooms = new Map<string, Map<string, CollaborationClient>>();
const COLLAB_COLORS = ['#2563EB', '#8B5CF6', '#EC4899', '#10B981', '#F97316', '#14B8A6', '#E11D48'];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length] || COLLAB_COLORS[0];
}

function toRoomKey(workspaceId: string, roomId: string): string {
  return `${workspaceId}:${roomId}`;
}

function emitSse(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function getPresence(room: Map<string, CollaborationClient>) {
  return {
    users: [...room.values()].map((client) => ({
      id: client.clientId,
      name: client.name,
      color: client.color,
    })),
  };
}

function broadcast(roomKey: string, event: string, payload: unknown, excludeClientId?: string): void {
  const room = rooms.get(roomKey);
  if (!room) return;
  for (const [clientId, client] of room.entries()) {
    if (excludeClientId && clientId === excludeClientId) continue;
    emitSse(client.res, event, payload);
  }
}

async function resolveCollaborator(req: Request): Promise<CollaboratorContext> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const token = bearerToken || queryToken;

  if (!token) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  let payload: { userId: string; workspaceId?: string };
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  if (!payload.workspaceId) {
    throw new AppError('Workspace context required', 400, 'NO_WORKSPACE');
  }

  const [member, subscription] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: payload.userId,
          workspaceId: payload.workspaceId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.subscription.findUnique({
      where: { workspaceId: payload.workspaceId },
    }),
  ]);

  if (!member) {
    throw new AppError('Workspace membership required', 403, 'FORBIDDEN');
  }

  if (!subscription) {
    throw new AppError('No subscription found', 403, 'NO_SUBSCRIPTION');
  }

  const tier = subscription.tier as SubscriptionTier;
  const access = resolveUsageAccess({
    tier,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
  if (!access.allowed) {
    throw new AppError(access.message, 402, access.code);
  }

  const effectiveLimits = await getEffectiveLimits(tier);
  if (effectiveLimits.teamMembers <= 1) {
    throw new AppError(
      'Collaborative editing requires a team plan (Pro or higher).',
      403,
      'COLLAB_TEAM_PLAN_REQUIRED',
    );
  }

  return {
    userId: member.user!.id,
    workspaceId: payload.workspaceId,
    name: member.user!.name,
    tier,
  };
}

collaborationRouter.get(
  '/access',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const context = await resolveCollaborator(req);
      res.json({
        success: true,
        data: {
          allowed: true,
          tier: context.tier,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

collaborationRouter.get(
  '/:roomId/stream',
  async (req: Request, res: Response, next: NextFunction) => {
    let heartbeat: NodeJS.Timeout | null = null;
    try {
      const context = await resolveCollaborator(req);
      const roomId = String(req.params.roomId || '').trim();
      if (!roomId) {
        throw new AppError('Room ID is required', 400, 'INVALID_ROOM');
      }

      const clientId =
        typeof req.query.clientId === 'string' && req.query.clientId.trim()
          ? req.query.clientId.trim()
          : randomUUID();

      const roomKey = toRoomKey(context.workspaceId, roomId);
      const room = rooms.get(roomKey) || new Map<string, CollaborationClient>();
      rooms.set(roomKey, room);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const client: CollaborationClient = {
        clientId,
        userId: context.userId,
        name: context.name,
        color: pickColor(context.userId),
        res,
      };
      room.set(clientId, client);

      emitSse(res, 'connected', {
        clientId,
        roomId,
      });
      broadcast(roomKey, 'presence', getPresence(room));

      heartbeat = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 25000);

      req.on('close', () => {
        if (heartbeat) clearInterval(heartbeat);
        const currentRoom = rooms.get(roomKey);
        if (!currentRoom) return;
        currentRoom.delete(clientId);
        if (currentRoom.size === 0) {
          rooms.delete(roomKey);
          return;
        }
        broadcast(roomKey, 'presence', getPresence(currentRoom));
      });
    } catch (err) {
      if (heartbeat) clearInterval(heartbeat);
      next(err);
    }
  },
);

collaborationRouter.post(
  '/:roomId/publish',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const context = await resolveCollaborator(req);
      const roomId = String(req.params.roomId || '').trim();
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ROOM', message: 'Room ID is required' },
        });
      }

      const { clientId, payload } = req.body as {
        clientId?: string;
        payload?: unknown;
      };

      if (!clientId || payload === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'clientId and payload are required',
          },
        });
      }

      const roomKey = toRoomKey(context.workspaceId, roomId);
      const room = rooms.get(roomKey);
      if (!room) {
        return res.json({ success: true, data: { delivered: 0 } });
      }

      broadcast(
        roomKey,
        'canvas:update',
        {
          clientId,
          payload,
          updatedAt: new Date().toISOString(),
        },
        clientId,
      );

      const deliveredCount = room.has(clientId) ? Math.max(room.size - 1, 0) : room.size;
      return res.json({ success: true, data: { delivered: deliveredCount } });
    } catch (err) {
      next(err);
    }
  },
);
