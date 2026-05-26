import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  postPublished: z.boolean().optional(),
  postFailed: z.boolean().optional(),
  upcomingScheduled: z.boolean().optional(),
  weeklyAnalyticsDigest: z.boolean().optional(),
  monthlyAnalyticsDigest: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one notification preference must be provided',
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['manager', 'creator', 'viewer']),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters').max(50),
});

export const workspaceInviteActionSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

export const publicCheckoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  priceKey: z.enum([
    'pro_monthly',
    'pro_yearly',
    'business_monthly',
    'business_yearly',
    'enterprise_monthly',
    'enterprise_yearly',
  ]),
  couponCode: z.string().trim().min(1).max(64).optional(),
});

export const changePlanSchema = z.object({
  tier: z.enum(['basic', 'pro', 'business', 'enterprise']).optional(),
  priceKey: z.string().optional(),
  couponCode: z.string().trim().min(1).max(64).optional(),
}).refine((value) => Boolean(value.tier || value.priceKey), {
  message: 'tier or priceKey is required',
});
