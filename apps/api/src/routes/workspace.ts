import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  workspaceInviteActionSchema,
} from '../utils/validators.js';
import { workspaceService } from '../services/workspace.service.js';

export const workspaceRouter = Router();

// List user workspaces
workspaceRouter.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const workspaces = await workspaceService.getUserWorkspaces(req.userId!);
      res.json({ success: true, data: workspaces });
    } catch (err) {
      next(err);
    }
  },
);

// Create workspace
workspaceRouter.post(
  '/',
  authenticate,
  validate(createWorkspaceSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const workspace = await workspaceService.createWorkspace(req.userId!, req.body.name);
      res.status(201).json({ success: true, data: workspace });
    } catch (err) {
      next(err);
    }
  },
);

// Get workspace members
workspaceRouter.get(
  '/:workspaceId/members',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const members = await workspaceService.getMembers(req.params.workspaceId as string);
      res.json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  },
);

// Invite member
workspaceRouter.post(
  '/:workspaceId/members',
  authenticate,
  requireRole('owner', 'manager'),
  validate(inviteMemberSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const member = await workspaceService.inviteMember(
        req.params.workspaceId as string,
        req.userId!,
        req.body.email,
        req.body.role,
      );
      res.status(201).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  },
);

// Accept invitation
workspaceRouter.post(
  '/invitations/accept',
  authenticate,
  validate(workspaceInviteActionSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await workspaceService.acceptInvite(req.body.token, req.userId!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Decline invitation
workspaceRouter.post(
  '/invitations/decline',
  validate(workspaceInviteActionSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await workspaceService.declineInvite(req.body.token, req.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Remove member
workspaceRouter.delete(
  '/:workspaceId/members/:userId',
  authenticate,
  requireRole('owner', 'manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await workspaceService.removeMember(
        req.params.workspaceId as string,
        req.userId!,
        req.params.userId as string,
      );
      res.json({ success: true, data: { message: 'Member removed' } });
    } catch (err) {
      next(err);
    }
  },
);
