import { Router } from 'express';

export const authRouter = Router();

// Placeholder — will be fully implemented in Milestone 2
authRouter.post('/register', (_req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Registration coming in Milestone 2' },
  });
});

authRouter.post('/login', (_req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Login coming in Milestone 2' },
  });
});
