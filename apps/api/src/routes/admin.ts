import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
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
adminRouter.use(authenticate, requireRole('owner'));

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
    const uploadDir = resolve(process.env.MEDIA_UPLOAD_DIR || './uploads', 'site');
    await mkdir(uploadDir, { recursive: true });
    const filename = `logo-${randomUUID()}${extname(req.file.originalname)}`;
    await writeFile(join(uploadDir, filename), req.file.buffer);
    const logoUrl = `/uploads/site/${filename}`;
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
    const uploadDir = resolve(process.env.MEDIA_UPLOAD_DIR || './uploads', 'site');
    await mkdir(uploadDir, { recursive: true });
    const filename = `favicon-${randomUUID()}${extname(req.file.originalname)}`;
    await writeFile(join(uploadDir, filename), req.file.buffer);
    const faviconUrl = `/uploads/site/${filename}`;
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
