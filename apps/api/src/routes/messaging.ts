import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { decrypt } from '../utils/encryption.js';
import { InstagramAdapter, InstagramDirectAdapter } from '../services/platforms/major.js';

export const messagingRouter = Router();

const instagramAdapter = new InstagramAdapter();
const instagramDirectAdapter = new InstagramDirectAdapter();

function getInstagramAdapter(metadata: any): InstagramAdapter | InstagramDirectAdapter {
  if (metadata?.mode === 'direct') return instagramDirectAdapter;
  return instagramAdapter;
}

// List Instagram conversations for a connection
messagingRouter.get(
  '/conversations',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { message: 'Workspace required' } });
      }

      const connections = await prisma.socialConnection.findMany({
        where: { workspaceId: req.workspaceId, platform: 'instagram', isActive: true },
      });

      if (!connections.length) {
        return res.json({ success: true, data: { conversations: [], connections: [] } });
      }

      const allConversations: any[] = [];
      const connectionSummaries: any[] = [];

      for (const conn of connections) {
        const accessToken = decrypt(conn.accessToken);
        const metadata = conn.metadata as any;
        const adapter = getInstagramAdapter(metadata);

        connectionSummaries.push({
          id: conn.id,
          accountName: conn.accountName,
          accountId: conn.accountId,
        });

        try {
          const conversations = await adapter.getConversations(accessToken);
          for (const conv of conversations) {
            allConversations.push({ ...conv, connectionId: conn.id, accountName: conn.accountName });
          }
        } catch (err) {
          console.error(`[Messaging] Failed to fetch conversations for ${conn.accountName}:`, err);
        }
      }

      res.json({ success: true, data: { conversations: allConversations, connections: connectionSummaries } });
    } catch (err) {
      next(err);
    }
  },
);

// Get messages for a conversation
messagingRouter.get(
  '/conversations/:conversationId/messages',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { message: 'Workspace required' } });
      }

      const conversationId = req.params.conversationId as string;
      const connectionId = String(req.query.connectionId || '');

      if (!connectionId || typeof connectionId !== 'string') {
        return res.status(400).json({ success: false, error: { message: 'connectionId query param required' } });
      }

      const connection = await prisma.socialConnection.findFirst({
        where: { id: connectionId, workspaceId: req.workspaceId, platform: 'instagram', isActive: true },
      });

      if (!connection) {
        return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
      }

      const accessToken = decrypt(connection.accessToken);
      const adapter = getInstagramAdapter(connection.metadata as any);
      const messages = await adapter.getMessages(accessToken, conversationId);

      res.json({ success: true, data: messages });
    } catch (err) {
      next(err);
    }
  },
);

// Send a message in a conversation
messagingRouter.post(
  '/conversations/:conversationId/messages',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { message: 'Workspace required' } });
      }

      const { conversationId } = req.params;
      const { connectionId, recipientId, message } = req.body;

      if (!connectionId || !recipientId || !message) {
        return res.status(400).json({ success: false, error: { message: 'connectionId, recipientId, and message are required' } });
      }

      const connection = await prisma.socialConnection.findFirst({
        where: { id: connectionId, workspaceId: req.workspaceId, platform: 'instagram', isActive: true },
      });

      if (!connection) {
        return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
      }

      const accessToken = decrypt(connection.accessToken);
      const adapter = getInstagramAdapter(connection.metadata as any);
      const result = await adapter.sendMessage(accessToken, recipientId, message);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Get comments for a post
messagingRouter.get(
  '/posts/:mediaId/comments',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { message: 'Workspace required' } });
      }
      const mediaId = req.params.mediaId as string;
      const connectionId = String(req.query.connectionId || '');
      if (!connectionId) {
        return res.status(400).json({ success: false, error: { message: 'connectionId required' } });
      }
      const connection = await prisma.socialConnection.findFirst({
        where: { id: connectionId, workspaceId: req.workspaceId, platform: 'instagram', isActive: true },
      });
      if (!connection) return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
      const accessToken = decrypt(connection.accessToken);
      const adapter = getInstagramAdapter(connection.metadata as any);
      const comments = await adapter.getPostComments(accessToken, mediaId);
      res.json({ success: true, data: comments });
    } catch (err) { next(err); }
  },
);

// Reply to a comment
messagingRouter.post(
  '/comments/:commentId/reply',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { message: 'Workspace required' } });
      }
      const { commentId } = req.params;
      const { connectionId, message } = req.body;
      if (!connectionId || !message) {
        return res.status(400).json({ success: false, error: { message: 'connectionId and message required' } });
      }
      const connection = await prisma.socialConnection.findFirst({
        where: { id: connectionId, workspaceId: req.workspaceId, platform: 'instagram', isActive: true },
      });
      if (!connection) return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
      const accessToken = decrypt(connection.accessToken);
      const adapter = getInstagramAdapter(connection.metadata as any);
      const result = await adapter.replyToComment(accessToken, String(commentId), message);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

// Hide/show a comment
messagingRouter.post(
  '/comments/:commentId/hide',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { message: 'Workspace required' } });
      }
      const { commentId } = req.params;
      const { connectionId, hide } = req.body;
      if (!connectionId) {
        return res.status(400).json({ success: false, error: { message: 'connectionId required' } });
      }
      const connection = await prisma.socialConnection.findFirst({
        where: { id: connectionId, workspaceId: req.workspaceId, platform: 'instagram', isActive: true },
      });
      if (!connection) return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
      const accessToken = decrypt(connection.accessToken);
      const adapter = getInstagramAdapter(connection.metadata as any);
      const result = await adapter.hideComment(accessToken, String(commentId), Boolean(hide));
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

// Delete a comment
messagingRouter.delete(
  '/comments/:commentId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { message: 'Workspace required' } });
      }
      const { commentId } = req.params;
      const connectionId = String(req.query.connectionId || '');
      if (!connectionId) {
        return res.status(400).json({ success: false, error: { message: 'connectionId required' } });
      }
      const connection = await prisma.socialConnection.findFirst({
        where: { id: connectionId, workspaceId: req.workspaceId, platform: 'instagram', isActive: true },
      });
      if (!connection) return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
      const accessToken = decrypt(connection.accessToken);
      const adapter = getInstagramAdapter(connection.metadata as any);
      const result = await adapter.deleteComment(accessToken, String(commentId));
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);
