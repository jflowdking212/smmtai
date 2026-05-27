import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';

const PRICE_KEYS = [
  'basic_monthly',
  'basic_quarterly',
  'basic_6month',
  'basic_yearly',
  'pro_monthly',
  'pro_quarterly',
  'pro_6month',
  'pro_yearly',
  'business_monthly',
  'business_quarterly',
  'business_6month',
  'business_yearly',
  'enterprise_monthly',
  'enterprise_quarterly',
  'enterprise_6month',
  'enterprise_yearly',
] as const;

const PRICE_KEY_SET = new Set<string>(PRICE_KEYS);
const RESERVATION_WINDOW_MS = 2 * 60 * 60 * 1000;
type CouponRedemptionReader = Pick<typeof prisma, 'couponRedemption'>;

export interface CouponCreateInput {
  code: string;
  name: string;
  description?: string;
  discountPercent?: number | null;
  freeDurationDays?: number | null;
  discountDurationMonths?: number | null;
  maxTotalUses?: number | null;
  maxUniqueUsers?: number | null;
  requireCardForFreeCheckout?: boolean;
  maxUsesPerUser?: number | null;
  allowedPriceKeys?: string[];
  defaultPriceKey?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface CouponUpdateInput {
  name?: string;
  description?: string | null;
  discountPercent?: number | null;
  freeDurationDays?: number | null;
  discountDurationMonths?: number | null;
  maxTotalUses?: number | null;
  maxUniqueUsers?: number | null;
  requireCardForFreeCheckout?: boolean;
  maxUsesPerUser?: number | null;
  allowedPriceKeys?: string[];
  defaultPriceKey?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface CouponReservation {
  redemptionId: string;
  code: string;
  discountPercent: number | null;
  freeDurationDays: number | null;
  discountDurationMonths: number | null;
  requireCardForFreeCheckout: boolean;
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

function parseDateOrNull(value: string | null | undefined): Date | null {
  if (value === undefined) return null;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Invalid date format', 400, 'VALIDATION_ERROR');
  }
  return date;
}

function ensurePriceKey(priceKey: string): void {
  if (!PRICE_KEY_SET.has(priceKey)) {
    throw new AppError('Invalid price plan', 400, 'INVALID_PRICE');
  }
}

function normalizeAllowedPriceKeys(value?: string[]): string[] {
  if (!value || value.length === 0) return [];
  const normalized = Array.from(new Set(value.map((entry) => entry.trim()).filter(Boolean)));
  for (const priceKey of normalized) {
    ensurePriceKey(priceKey);
  }
  return normalized;
}

function sanitizeDuration(value: number | null | undefined, field: string, min = 0, max = 730): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError(`${field} must be an integer between ${min} and ${max}`, 400, 'VALIDATION_ERROR');
  }
  return value;
}

function sanitizePercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new AppError('discountPercent must be between 1 and 100', 400, 'VALIDATION_ERROR');
  }
  return Math.round(value);
}

function assertCouponBenefit(discountPercent: number | null, freeDurationDays: number | null): void {
  if ((discountPercent ?? 0) <= 0 && (freeDurationDays ?? 0) <= 0) {
    throw new AppError('Coupon must provide a discountPercent or freeDurationDays', 400, 'VALIDATION_ERROR');
  }
}

function buildCheckoutLink(code: string, defaultPriceKey: string | null): string {
  const base = `${config.frontend.url}/checkout?coupon=${encodeURIComponent(code)}`;
  if (defaultPriceKey) {
    return `${base}&priceKey=${encodeURIComponent(defaultPriceKey)}`;
  }
  return base;
}

export class CouponService {
  private assertCouponActiveWindow(coupon: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now: Date): void {
    if (!coupon.isActive) {
      throw new AppError('Coupon is inactive', 400, 'COUPON_INACTIVE');
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new AppError('Coupon is not active yet', 400, 'COUPON_NOT_STARTED');
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      throw new AppError('Coupon has expired', 400, 'COUPON_EXPIRED');
    }
  }

  private assertCouponPriceEligibility(coupon: { code: string; allowedPriceKeys: string[] }, priceKey: string): void {
    if (coupon.allowedPriceKeys.length > 0 && !coupon.allowedPriceKeys.includes(priceKey)) {
      throw new AppError('Coupon does not apply to this package', 400, 'COUPON_PLAN_MISMATCH');
    }

    const codeUpper = coupon.code.toUpperCase();
    if (codeUpper === 'ENTREPRENEURS60PRO' || codeUpper === 'ENTREPRENEURS60BIZ') {
      const parts = priceKey.split('_');
      const period = parts[parts.length - 1];
      if (period === 'monthly' || period === 'quarterly') {
        throw new AppError('This coupon requires a minimum billing period of 6 months.', 400, 'COUPON_MIN_MONTHS_REQUIRED');
      }
    }
  }

  private activeRedemptionFilter(now: Date) {
    return {
      OR: [
        { status: 'redeemed' as const },
        { status: 'pending' as const, reservationExpiresAt: { gt: now } },
      ],
    };
  }

  private async getRedemptionUsageSnapshot(
    client: CouponRedemptionReader,
    couponId: string,
    now: Date,
    userId?: string,
  ): Promise<{ totalUsageCount: number; perUserUsageCount: number; uniqueUserCount: number }> {
    const activeFilter = this.activeRedemptionFilter(now);
    const [totalUsageCount, perUserUsageCount, uniqueUserRows] = await Promise.all([
      client.couponRedemption.count({
        where: {
          couponId,
          ...activeFilter,
        },
      }),
      userId
        ? client.couponRedemption.count({
          where: {
            couponId,
            userId,
            ...activeFilter,
          },
        })
        : Promise.resolve(0),
      client.couponRedemption.findMany({
        where: {
          couponId,
          ...activeFilter,
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    return {
      totalUsageCount,
      perUserUsageCount,
      uniqueUserCount: uniqueUserRows.length,
    };
  }

  private async validateRedemptionCapacity(
    client: CouponRedemptionReader,
    couponId: string,
    userId: string,
    maxTotalUses: number | null,
    maxUniqueUsers: number | null,
    maxUsesPerUser: number,
    now: Date,
  ): Promise<{ totalUsageCount: number; perUserUsageCount: number; uniqueUserCount: number }> {
    const usage = await this.getRedemptionUsageSnapshot(client, couponId, now, userId);
    const { totalUsageCount, perUserUsageCount, uniqueUserCount } = usage;

    if (maxTotalUses !== null && totalUsageCount >= maxTotalUses) {
      throw new AppError('Coupon usage limit reached', 400, 'COUPON_LIMIT_REACHED');
    }

    if (maxUniqueUsers !== null && uniqueUserCount >= maxUniqueUsers && perUserUsageCount === 0) {
      throw new AppError('Coupon user limit reached', 400, 'COUPON_USER_COUNT_LIMIT');
    }

    if (perUserUsageCount >= maxUsesPerUser) {
      throw new AppError('You have already used this coupon the maximum allowed times', 400, 'COUPON_USER_LIMIT');
    }

    return usage;
  }

  private mapCouponForAdmin(coupon: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    discountPercent: number | null;
    freeDurationDays: number | null;
    discountDurationMonths: number | null;
    maxTotalUses: number | null;
    maxUniqueUsers: number | null;
    requireCardForFreeCheckout: boolean;
    maxUsesPerUser: number;
    allowedPriceKeys: string[];
    defaultPriceKey: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    redemptionCount: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; name: string; email: string } | null;
  }, uniqueUserCount: number) {
    const remainingUserSlots = coupon.maxUniqueUsers === null
      ? null
      : Math.max(coupon.maxUniqueUsers - uniqueUserCount, 0);

    return {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      isActive: coupon.isActive,
      discountPercent: coupon.discountPercent,
      freeDurationDays: coupon.freeDurationDays,
      discountDurationMonths: coupon.discountDurationMonths,
      maxTotalUses: coupon.maxTotalUses,
      maxUniqueUsers: coupon.maxUniqueUsers,
      requireCardForFreeCheckout: coupon.requireCardForFreeCheckout,
      maxUsesPerUser: coupon.maxUsesPerUser,
      allowedPriceKeys: coupon.allowedPriceKeys,
      defaultPriceKey: coupon.defaultPriceKey,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      redemptionCount: coupon.redemptionCount,
      uniqueUserCount,
      remainingUserSlots,
      checkoutLink: buildCheckoutLink(coupon.code, coupon.defaultPriceKey),
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
      createdBy: coupon.createdBy,
    };
  }

  async listCoupons() {
    const now = new Date();
    const [coupons, uniqueRows] = await Promise.all([
      prisma.coupon.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.couponRedemption.findMany({
        where: this.activeRedemptionFilter(now),
        select: {
          couponId: true,
          userId: true,
        },
        distinct: ['couponId', 'userId'],
      }),
    ]);

    const uniqueUserCounts = new Map<string, number>();
    for (const row of uniqueRows) {
      uniqueUserCounts.set(row.couponId, (uniqueUserCounts.get(row.couponId) || 0) + 1);
    }

    return coupons.map((coupon) => this.mapCouponForAdmin(coupon, uniqueUserCounts.get(coupon.id) || 0));
  }

  async createCoupon(adminId: string, input: CouponCreateInput) {
    const code = normalizeCode(input.code || '');
    if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(code)) {
      throw new AppError('Coupon code must be 3-64 characters using letters, numbers, underscores, or dashes', 400, 'VALIDATION_ERROR');
    }

    const name = (input.name || '').trim();
    if (!name) {
      throw new AppError('Coupon name is required', 400, 'VALIDATION_ERROR');
    }

    const discountPercent = sanitizePercent(input.discountPercent);
    const freeDurationDays = sanitizeDuration(input.freeDurationDays, 'freeDurationDays', 0, 730);
    const discountDurationMonths = sanitizeDuration(input.discountDurationMonths, 'discountDurationMonths', 1, 36);
    const maxTotalUses = sanitizeDuration(input.maxTotalUses, 'maxTotalUses', 1, 1_000_000);
    const maxUniqueUsers = sanitizeDuration(input.maxUniqueUsers, 'maxUniqueUsers', 1, 1_000_000);
    const requireCardForFreeCheckout = input.requireCardForFreeCheckout ?? true;
    const maxUsesPerUser = sanitizeDuration(input.maxUsesPerUser, 'maxUsesPerUser', 1, 1000) ?? 1;
    const allowedPriceKeys = normalizeAllowedPriceKeys(input.allowedPriceKeys);

    const defaultPriceKey = input.defaultPriceKey ? input.defaultPriceKey.trim() : null;
    if (defaultPriceKey) {
      ensurePriceKey(defaultPriceKey);
      if (allowedPriceKeys.length > 0 && !allowedPriceKeys.includes(defaultPriceKey)) {
        throw new AppError('defaultPriceKey must be included in allowedPriceKeys', 400, 'VALIDATION_ERROR');
      }
    }

    const startsAt = parseDateOrNull(input.startsAt);
    const endsAt = parseDateOrNull(input.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new AppError('endsAt must be after startsAt', 400, 'VALIDATION_ERROR');
    }

    assertCouponBenefit(discountPercent, freeDurationDays);

    const coupon = await prisma.coupon.create({
      data: {
        code,
        name,
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true,
        discountPercent,
        freeDurationDays,
        discountDurationMonths,
        maxTotalUses,
        maxUniqueUsers,
        requireCardForFreeCheckout,
        maxUsesPerUser,
        allowedPriceKeys,
        defaultPriceKey,
        startsAt,
        endsAt,
        createdById: adminId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return this.mapCouponForAdmin(coupon, 0);
  }

  async updateCoupon(couponId: string, input: CouponUpdateInput) {
    const existing = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!existing) {
      throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND');
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    if (!name) {
      throw new AppError('Coupon name is required', 400, 'VALIDATION_ERROR');
    }

    const discountPercent = input.discountPercent !== undefined
      ? sanitizePercent(input.discountPercent)
      : existing.discountPercent;

    const freeDurationDays = input.freeDurationDays !== undefined
      ? sanitizeDuration(input.freeDurationDays, 'freeDurationDays', 0, 730)
      : existing.freeDurationDays;

    const discountDurationMonths = input.discountDurationMonths !== undefined
      ? sanitizeDuration(input.discountDurationMonths, 'discountDurationMonths', 1, 36)
      : existing.discountDurationMonths;

    const maxTotalUses = input.maxTotalUses !== undefined
      ? sanitizeDuration(input.maxTotalUses, 'maxTotalUses', 1, 1_000_000)
      : existing.maxTotalUses;

    const maxUniqueUsers = input.maxUniqueUsers !== undefined
      ? sanitizeDuration(input.maxUniqueUsers, 'maxUniqueUsers', 1, 1_000_000)
      : existing.maxUniqueUsers;

    const requireCardForFreeCheckout = input.requireCardForFreeCheckout !== undefined
      ? input.requireCardForFreeCheckout
      : existing.requireCardForFreeCheckout;

    const maxUsesPerUser = input.maxUsesPerUser !== undefined
      ? (sanitizeDuration(input.maxUsesPerUser, 'maxUsesPerUser', 1, 1000) ?? existing.maxUsesPerUser)
      : existing.maxUsesPerUser;

    const allowedPriceKeys = input.allowedPriceKeys !== undefined
      ? normalizeAllowedPriceKeys(input.allowedPriceKeys)
      : existing.allowedPriceKeys;

    const defaultPriceKey = input.defaultPriceKey !== undefined
      ? (input.defaultPriceKey ? input.defaultPriceKey.trim() : null)
      : existing.defaultPriceKey;

    if (defaultPriceKey) {
      ensurePriceKey(defaultPriceKey);
      if (allowedPriceKeys.length > 0 && !allowedPriceKeys.includes(defaultPriceKey)) {
        throw new AppError('defaultPriceKey must be included in allowedPriceKeys', 400, 'VALIDATION_ERROR');
      }
    }

    const startsAt = input.startsAt !== undefined ? parseDateOrNull(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt !== undefined ? parseDateOrNull(input.endsAt) : existing.endsAt;

    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new AppError('endsAt must be after startsAt', 400, 'VALIDATION_ERROR');
    }

    assertCouponBenefit(discountPercent, freeDurationDays);

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        name,
        description: input.description !== undefined ? (input.description?.trim() || null) : existing.description,
        isActive: input.isActive ?? existing.isActive,
        discountPercent,
        freeDurationDays,
        discountDurationMonths,
        maxTotalUses,
        maxUniqueUsers,
        requireCardForFreeCheckout,
        maxUsesPerUser,
        allowedPriceKeys,
        defaultPriceKey,
        startsAt,
        endsAt,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const usage = await this.getRedemptionUsageSnapshot(prisma, coupon.id, new Date());
    return this.mapCouponForAdmin(coupon, usage.uniqueUserCount);
  }

  async previewCoupon(codeInput: string, priceKey?: string) {
    const code = normalizeCode(codeInput || '');
    if (!code) {
      throw new AppError('Coupon code is required', 400, 'VALIDATION_ERROR');
    }

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) {
      throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND');
    }

    const now = new Date();
    this.assertCouponActiveWindow(coupon, now);
    const usage = await this.getRedemptionUsageSnapshot(prisma, coupon.id, now);

    if (priceKey) {
      ensurePriceKey(priceKey);
      this.assertCouponPriceEligibility(coupon, priceKey);
    }

    if (coupon.maxTotalUses !== null && usage.totalUsageCount >= coupon.maxTotalUses) {
      throw new AppError('Coupon usage limit reached', 400, 'COUPON_LIMIT_REACHED');
    }

    if (coupon.maxUniqueUsers !== null && usage.uniqueUserCount >= coupon.maxUniqueUsers) {
      throw new AppError('Coupon user limit reached', 400, 'COUPON_USER_COUNT_LIMIT');
    }

    const remainingTotalUses = coupon.maxTotalUses === null
      ? null
      : Math.max(coupon.maxTotalUses - usage.totalUsageCount, 0);
    const remainingUserSlots = coupon.maxUniqueUsers === null
      ? null
      : Math.max(coupon.maxUniqueUsers - usage.uniqueUserCount, 0);

    return {
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountPercent: coupon.discountPercent,
      freeDurationDays: coupon.freeDurationDays,
      discountDurationMonths: coupon.discountDurationMonths,
      maxTotalUses: coupon.maxTotalUses,
      maxUniqueUsers: coupon.maxUniqueUsers,
      requireCardForFreeCheckout: coupon.requireCardForFreeCheckout,
      maxUsesPerUser: coupon.maxUsesPerUser,
      allowedPriceKeys: coupon.allowedPriceKeys,
      defaultPriceKey: coupon.defaultPriceKey,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      redemptionCount: coupon.redemptionCount,
      uniqueUserCount: usage.uniqueUserCount,
      remainingTotalUses,
      remainingUserSlots,
      checkoutLink: buildCheckoutLink(coupon.code, coupon.defaultPriceKey),
    };
  }

  async reserveForCheckout(input: {
    code: string;
    userId: string;
    workspaceId?: string;
    priceKey: string;
  }): Promise<CouponReservation> {
    const code = normalizeCode(input.code || '');
    if (!code) {
      throw new AppError('Coupon code is required', 400, 'VALIDATION_ERROR');
    }

    ensurePriceKey(input.priceKey);

    const now = new Date();
    const reservationExpiresAt = new Date(now.getTime() + RESERVATION_WINDOW_MS);

    return prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({ where: { code } });
      if (!coupon) {
        throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND');
      }

      this.assertCouponActiveWindow(coupon, now);
      this.assertCouponPriceEligibility(coupon, input.priceKey);
      await this.validateRedemptionCapacity(
        tx,
        coupon.id,
        input.userId,
        coupon.maxTotalUses,
        coupon.maxUniqueUsers,
        coupon.maxUsesPerUser,
        now,
      );

      const redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: input.userId,
          workspaceId: input.workspaceId || null,
          priceKey: input.priceKey,
          status: 'pending',
          reservationExpiresAt,
        },
      });

      return {
        redemptionId: redemption.id,
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        freeDurationDays: coupon.freeDurationDays,
        discountDurationMonths: coupon.discountDurationMonths,
        requireCardForFreeCheckout: coupon.requireCardForFreeCheckout,
      };
    });
  }

  async bindCheckoutSession(redemptionId: string, checkoutSessionId: string): Promise<void> {
    await prisma.couponRedemption.update({
      where: { id: redemptionId },
      data: { checkoutSessionId },
    });
  }

  async releaseReservation(redemptionId: string): Promise<void> {
    await prisma.couponRedemption.updateMany({
      where: {
        id: redemptionId,
        status: 'pending',
      },
      data: {
        status: 'expired',
      },
    });
  }

  async finalizeReservationFromCheckoutSession(session: {
    id: string;
    metadata?: Record<string, string> | null;
    subscription?: string | { id?: string } | null;
  }): Promise<void> {
    const redemptionId = session.metadata?.couponRedemptionId;
    if (!redemptionId) return;

    await prisma.$transaction(async (tx) => {
      const redemption = await tx.couponRedemption.findUnique({
        where: { id: redemptionId },
        select: {
          id: true,
          couponId: true,
          status: true,
        },
      });

      if (!redemption || redemption.status !== 'pending') {
        return;
      }

      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || null;

      const updateResult = await tx.couponRedemption.updateMany({
        where: {
          id: redemption.id,
          status: 'pending',
        },
        data: {
          status: 'redeemed',
          checkoutSessionId: session.id,
          redeemedAt: new Date(),
          reservationExpiresAt: null,
          metadata: {
            stripeSubscriptionId: subscriptionId,
          },
        },
      });

      if (updateResult.count > 0) {
        await tx.coupon.update({
          where: { id: redemption.couponId },
          data: {
            redemptionCount: {
              increment: 1,
            },
          },
        });
      }
    });
  }

  async assertCouponCanBeUsedByUser(codeInput: string, userId: string, priceKey: string): Promise<void> {
    const code = normalizeCode(codeInput || '');
    if (!code) {
      throw new AppError('Coupon code is required', 400, 'VALIDATION_ERROR');
    }

    ensurePriceKey(priceKey);

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) {
      throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND');
    }

    const now = new Date();
    this.assertCouponActiveWindow(coupon, now);
    this.assertCouponPriceEligibility(coupon, priceKey);
    await this.validateRedemptionCapacity(
      prisma,
      coupon.id,
      userId,
      coupon.maxTotalUses,
      coupon.maxUniqueUsers,
      coupon.maxUsesPerUser,
      now,
    );
  }
}

export const couponService = new CouponService();
