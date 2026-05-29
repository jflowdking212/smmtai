import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface SiteSettings {
  site_title: string;
  site_tagline: string;
  site_favicon: string;
  site_logo: string;
  seo_meta_title: string;
  seo_meta_description: string;
  fb_pixel_id?: string;
  promo_enabled?: string;
  promo_badge?: string;
  promo_headline?: string;
  promo_subheadline?: string;
  promo_pro_discounted_price?: string;
  promo_pro_original_price?: string;
  promo_biz_discounted_price?: string;
  promo_biz_original_price?: string;
  promo_pro_coupon?: string;
  promo_biz_coupon?: string;
  promo_min_months?: string;
  promo_enterprise_discounted_price?: string;
  promo_enterprise_original_price?: string;
  promo_enterprise_coupon?: string;
  promo_disclaimer?: string;
  promo_primary_cta?: string;
  promo_secondary_cta?: string;
  promo_secondary_trial_days?: string;
  promo_trust_bar?: string;
  promo_footer?: string;
}

const DEFAULTS: SiteSettings = {
  site_title: 'SmmtAI',
  site_tagline: 'AI-Powered Social Media Management',
  site_favicon: '',
  site_logo: '',
  seo_meta_title: '',
  seo_meta_description: '',
  fb_pixel_id: '',
  promo_enabled: 'false',
  promo_badge: 'Entrepreneurs Day exclusive offer',
  promo_headline: 'Happy Entrepreneurs Day — Your Exclusive Offer Awaits',
  promo_subheadline: 'Get 60% off SMMTAI and take full control of your social media — at a price that makes sense for every entrepreneur.',
  promo_pro_discounted_price: '10',
  promo_pro_original_price: '25',
  promo_biz_discounted_price: '20',
  promo_biz_original_price: '50',
  promo_pro_coupon: 'ENTREPRENEURS60PRO',
  promo_biz_coupon: 'ENTREPRENEURS60BIZ',
  promo_min_months: '6',
  promo_enterprise_discounted_price: '40',
  promo_enterprise_original_price: '100',
  promo_enterprise_coupon: 'ENTREPRENEURS60ENT',
  promo_disclaimer: 'Discount applies only when you subscribe for a minimum of six months. Selecting less than six months removes the sixty percent discount automatically.',
  promo_primary_cta: 'Claim 60% Off Now — Entrepreneurs Day Deal',
  promo_secondary_cta: 'Try Pro Free for 14 Days — No Credit Card Needed',
  promo_secondary_trial_days: '14',
  promo_trust_bar: 'All Features Included,Cancel Anytime After Six Months,Trusted by Entrepreneurs Worldwide',
  promo_footer: 'This offer is exclusive to Entrepreneurs Day and available only through this page. SMMTAI.com',
};

let cached: SiteSettings | null = null;
let fetchPromise: Promise<SiteSettings> | null = null;

function fetchSettings(): Promise<SiteSettings> {
  if (!fetchPromise) {
    fetchPromise = api.site
      .getPublicSettings()
      .then((res) => {
        const s = { ...DEFAULTS, ...res.data };
        cached = s;
        return s;
      })
      .catch(() => {
        cached = DEFAULTS;
        return DEFAULTS;
      });
  }
  return fetchPromise;
}

/** Invalidate cache so next call re-fetches */
export function invalidateSiteSettings() {
  cached = null;
  fetchPromise = null;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cached || DEFAULTS);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}
