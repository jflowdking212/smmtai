import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
