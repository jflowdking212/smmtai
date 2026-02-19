import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import {
  getSmtpConfigMasked,
  saveSmtpConfig,
  testSmtpConnection,
  getStorageConfigMasked,
  saveStorageConfig,
  testStorageConnection,
} from '../services/admin-settings.service.js';

export const adminRouter = Router();

// All admin routes require authentication + owner role
adminRouter.use(authenticate, requireRole('owner'));

// ----- SMTP -----

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

adminRouter.post('/settings/storage/test', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await testStorageConnection();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
