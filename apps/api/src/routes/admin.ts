import { AppError } from '../middleware/errorHandler.js';
import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import {
  getSmtpConfigMasked,
  saveSmtpConfig,
  testSmtpConnection,
  getStorageConfigMasked,
  saveStorageConfig,
  testStorageConnection,
  getSiteSettings,
  saveSiteSettings,
  getPlatformCredentialsMasked,
  savePlatformCredentials,
  getGlobalCredentialPlatforms,
  getPlanConfig,
  savePlanConfig,
} from '../services/admin-settings.service.js';
import { couponService } from '../services/coupon.service.js';
import { uploadPublicFile } from '../services/storage.service.js';
import { prisma } from '../config/database.js';

export const adminRouter = Router();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Public endpoint — no auth required
adminRouter.get('/settings/site/public', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getSiteSettings();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// Public endpoint — plan pricing (no auth required)
adminRouter.get('/settings/plans/public', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getPlanConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// All admin routes require authentication + owner role

export const requireSystemAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.email !== 'judeobidozie@gmail.com') {
      throw new AppError('Insufficient permissions. System Admin only.', 403, 'FORBIDDEN');
    }
    next();
  } catch (err) {
    next(err);
  }
};

// All admin routes require authentication + system admin
adminRouter.use(authenticate, requireSystemAdmin);


// ----- SMTP -----

// ----- Site General Settings -----

adminRouter.get('/settings/site', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getSiteSettings();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/settings/site', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await saveSiteSettings(req.body);
    const config = await getSiteSettings();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/settings/site/logo', logoUpload.single('logo'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded', code: 'VALIDATION_ERROR' } });
    }
    const filename = `logo-${randomUUID()}${extname(req.file.originalname)}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const uploadDir = resolve(process.env.MEDIA_UPLOAD_DIR || './uploads');
    const uploaded = await uploadPublicFile({
      buffer: req.file.buffer,
      key: `site/${filename}`,
      contentType: req.file.mimetype,
      baseUrl,
      localUploadDir: uploadDir,
    });
    const logoUrl = uploaded.url;
    await saveSiteSettings({ site_logo: logoUrl });
    res.json({ success: true, data: { url: logoUrl } });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/settings/site/favicon', logoUpload.single('favicon'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded', code: 'VALIDATION_ERROR' } });
    }
    const filename = `favicon-${randomUUID()}${extname(req.file.originalname)}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const uploadDir = resolve(process.env.MEDIA_UPLOAD_DIR || './uploads');
    const uploaded = await uploadPublicFile({
      buffer: req.file.buffer,
      key: `site/${filename}`,
      contentType: req.file.mimetype,
      baseUrl,
      localUploadDir: uploadDir,
    });
    const faviconUrl = uploaded.url;
    await saveSiteSettings({ site_favicon: faviconUrl });
    res.json({ success: true, data: { url: faviconUrl } });
  } catch (err) {
    next(err);
  }
});

// ----- SMTP (below) -----

adminRouter.get('/settings/smtp', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getSmtpConfigMasked();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/settings/smtp', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await saveSmtpConfig(req.body);
    const config = await getSmtpConfigMasked();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/settings/smtp/test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'Email address is required', code: 'VALIDATION_ERROR' } });
    }
    const result = await testSmtpConnection(email);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ----- Cloud Storage -----

adminRouter.get('/settings/storage', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getStorageConfigMasked();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/settings/storage', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await saveStorageConfig(req.body);
    const config = await getStorageConfigMasked();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/settings/storage/test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await testStorageConnection(req.body || {});
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ----- Platform Credentials -----

adminRouter.get('/settings/platforms', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getPlatformCredentialsMasked();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/settings/platforms', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await savePlatformCredentials(req.body);
    const config = await getPlatformCredentialsMasked();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// ----- Plan Configuration -----

adminRouter.get('/settings/plans', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getPlanConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/settings/plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await savePlanConfig(req.body);
    const config = await getPlanConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// ----- Coupons -----

adminRouter.get('/coupons', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const coupons = await couponService.listCoupons();
    res.json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/coupons', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } });
    }
    const coupon = await couponService.createCoupon(req.userId, req.body);
    await logAdminAction(req.userId, 'coupon.create', 'coupon', coupon.id, { code: coupon.code });
    res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/coupons/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } });
    }
    const couponId = req.params.id as string;
    const coupon = await couponService.updateCoupon(couponId, req.body);
    await logAdminAction(req.userId, 'coupon.update', 'coupon', coupon.id, { code: coupon.code });
    res.json({ success: true, data: coupon });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin Dashboard Stats
// ============================================================

async function logAdminAction(adminId: string, action: string, targetType?: string, targetId?: string, details?: any) {
  await prisma.adminAuditLog.create({
    data: { adminId, action, targetType, targetId, details: details ?? undefined },
  });
}

adminRouter.get('/dashboard', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, scheduledPosts, activeSubscriptions, allSubscriptions] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({ where: { status: 'scheduled' } }),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.findMany({ select: { tier: true, status: true } }),
    ]);

    const planBreakdown: Record<string, number> = {};
    for (const sub of allSubscriptions) {
      planBreakdown[sub.tier] = (planBreakdown[sub.tier] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        scheduledPosts,
        activeSubscriptions,
        planBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin Users Management
// ============================================================

adminRouter.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, status, plan, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          workspaces: {
            select: {
              role: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  subscription: {
                    select: { tier: true, status: true },
                  },
                },
              },
            },
          },
          _count: { select: { posts: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const mapped = users.map((u) => {
      const primaryWorkspace = u.workspaces[0];
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        avatar: u.avatar,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        lastActive: u.updatedAt,
        role: primaryWorkspace?.role || 'viewer',
        isSystemAdmin: u.email === 'judeobidozie@gmail.com',
        plan: primaryWorkspace?.workspace?.subscription?.tier || 'basic',
        subscriptionStatus: primaryWorkspace?.workspace?.subscription?.status || 'none',
        workspaceId: primaryWorkspace?.workspace?.id || null,
        postCount: u._count.posts,
      };
    });

    res.json({ success: true, data: { users: mapped, total, page: parseInt(page, 10), limit: take } });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/users/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { action } = req.body; // 'suspend' | 'enable'

    if (!['suspend', 'enable'].includes(action)) {
      return res.status(400).json({ success: false, error: { message: 'Action must be suspend or enable', code: 'VALIDATION_ERROR' } });
    }

    // Update subscription status to reflect suspension
    const user = await prisma.user.findUnique({
      where: { id },
      include: { workspaces: { include: { workspace: { include: { subscription: true } } } } },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }

    // Prevent suspending admin/owner users
    const isOwner = user.workspaces.some((wm) => wm.role === 'owner');
    if (isOwner && action === 'suspend') {
      return res.status(403).json({ success: false, error: { message: 'Cannot suspend an admin user', code: 'FORBIDDEN' } });
    }

    const workspace = user.workspaces[0]?.workspace;
    if (workspace?.subscription) {
      await prisma.subscription.update({
        where: { id: workspace.subscription.id },
        data: { status: action === 'suspend' ? 'suspended' : 'active' },
      });
    }

    await logAdminAction(req.userId!, `user.${action}`, 'user', id, { action });

    res.json({ success: true, data: { message: `User ${action === 'suspend' ? 'suspended' : 'enabled'} successfully` } });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/users/:id/plan', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { tier } = req.body; // 'basic' | 'pro' | 'business' | 'enterprise'

    if (!['basic', 'pro', 'business', 'enterprise'].includes(tier)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid tier', code: 'VALIDATION_ERROR' } });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { workspaces: { include: { workspace: { include: { subscription: true } } } } },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }

    const workspace = user.workspaces[0]?.workspace;
    if (workspace?.subscription) {
      const oldTier = workspace.subscription.tier;
      await prisma.subscription.update({
        where: { id: workspace.subscription.id },
        data: { tier },
      });
      await logAdminAction(req.userId!, 'user.plan_change', 'user', id, { oldTier, newTier: tier });
    } else if (workspace) {
      await prisma.subscription.create({
        data: { workspaceId: workspace.id, tier, status: 'active' },
      });
      await logAdminAction(req.userId!, 'user.plan_change', 'user', id, { oldTier: 'none', newTier: tier });
    }

    res.json({ success: true, data: { message: `User plan updated to ${tier}` } });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/users/:id/role', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body; // 'owner' | 'admin' | 'editor' | 'viewer'

    if (!['owner', 'admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid role', code: 'VALIDATION_ERROR' } });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { workspaces: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }

    // Prevent changing own role
    if (id === req.userId) {
      return res.status(403).json({ success: false, error: { message: 'Cannot change your own role', code: 'FORBIDDEN' } });
    }

    // Prevent demoting the last owner
    const membership = user.workspaces[0];
    if (membership && membership.role === 'owner' && role !== 'owner') {
      const ownerCount = await prisma.workspaceMember.count({ where: { role: 'owner' } });
      if (ownerCount <= 1) {
        return res.status(403).json({
          success: false,
          error: { message: 'Cannot demote the last admin. Transfer admin privileges to another user first.', code: 'LAST_OWNER' },
        });
      }
    }

    if (membership) {
      const oldRole = membership.role;
      await prisma.workspaceMember.update({
        where: { userId_workspaceId: { userId: id, workspaceId: membership.workspaceId } },
        data: { role },
      });
      await logAdminAction(req.userId!, 'user.role_change', 'user', id, { oldRole, newRole: role });
    }

    res.json({ success: true, data: { message: `User role updated to ${role}` } });
  } catch (err) {
    next(err);
  }
});

// Delete a user — requires admin password confirmation; cannot delete last owner
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: { message: 'Admin password required to delete a user', code: 'VALIDATION_ERROR' } });
    }

    // Verify admin's own password
    const admin = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!admin?.passwordHash) {
      return res.status(403).json({ success: false, error: { message: 'Cannot verify credentials', code: 'FORBIDDEN' } });
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(403).json({ success: false, error: { message: 'Incorrect password', code: 'FORBIDDEN' } });
    }

    // Cannot delete yourself
    if (id === req.userId) {
      return res.status(403).json({ success: false, error: { message: 'Cannot delete your own account', code: 'FORBIDDEN' } });
    }

    const user = await prisma.user.findUnique({ where: { id }, include: { workspaces: true } });
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } });
    }

    // Cannot delete the last owner
    const isOwner = user.workspaces.some((m) => m.role === 'owner');
    if (isOwner) {
      const ownerCount = await prisma.workspaceMember.count({ where: { role: 'owner' } });
      if (ownerCount <= 1) {
        return res.status(403).json({
          success: false,
          error: { message: 'Cannot delete the last admin. Transfer admin privileges to another user first.', code: 'LAST_OWNER' },
        });
      }
    }

    // Must delete owned workspaces before the user (FK: workspaces.ownerId -> users.id)
    await prisma.$transaction(async (tx: any) => {
      const ownedWorkspaces = await tx.workspace.findMany({ where: { ownerId: id }, select: { id: true } });
      for (const ws of ownedWorkspaces) {
        // Delete child records (order matters for FK constraints)
        await tx.workspaceMember.deleteMany({ where: { workspaceId: ws.id } });
        await tx.platformPost.deleteMany({ where: { post: { workspaceId: ws.id } } }).catch(() => {});
        await tx.post.deleteMany({ where: { workspaceId: ws.id } });
        await tx.subscription.deleteMany({ where: { workspaceId: ws.id } });
        await tx.socialConnection.deleteMany({ where: { workspaceId: ws.id } });
        await tx.template.deleteMany({ where: { workspaceId: ws.id } }).catch(() => {});
        await tx.analyticsSnapshot.deleteMany({ where: { workspaceId: ws.id } }).catch(() => {});
        await tx.workspace.delete({ where: { id: ws.id } });
      }
      await tx.workspaceMember.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
    await logAdminAction(req.userId!, 'user.delete', 'user', id, { email: user.email });

    res.json({ success: true, data: { message: 'User deleted' } });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin Analytics (system-wide)
// ============================================================

adminRouter.get('/analytics', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      totalPosts,
      publishedPosts,
      scheduledPosts,
      activeConversations,
      totalConversations,
      subscriptionsByTier,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.post.count(),
      prisma.post.count({ where: { status: 'published' } }),
      prisma.post.count({ where: { status: 'scheduled' } }),
      prisma.chatConversation.count({ where: { status: 'ACTIVE' } }),
      prisma.chatConversation.count(),
      prisma.subscription.groupBy({ by: ['tier'], _count: { id: true } }),
    ]);

    const planDistribution: Record<string, number> = {};
    for (const s of subscriptionsByTier) {
      planDistribution[s.tier] = s._count.id;
    }

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, newThisMonth: newUsersThisMonth, newThisWeek: newUsersThisWeek },
        posts: { total: totalPosts, published: publishedPosts, scheduled: scheduledPosts },
        conversations: { active: activeConversations, total: totalConversations },
        planDistribution,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin Messages (all conversations)
// ============================================================

adminRouter.get('/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (status) where.status = status.toUpperCase();
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.chatConversation.count({ where }),
    ]);

    res.json({ success: true, data: { conversations, total, page: parseInt(page, 10), limit: take } });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin Audit Log
// ============================================================

adminRouter.get('/audit-log', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, name: true, email: true } } },
      }),
      prisma.adminAuditLog.count(),
    ]);

    res.json({ success: true, data: { logs, total, page: parseInt(page, 10), limit: take } });
  } catch (err) {
    next(err);
  }
});
