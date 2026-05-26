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
}

const DEFAULTS: SiteSettings = {
  site_title: 'SmmtAI',
  site_tagline: 'AI-Powered Social Media Management',
  site_favicon: '',
  site_logo: '',
  seo_meta_title: '',
  seo_meta_description: '',
  fb_pixel_id: '',
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
