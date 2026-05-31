import { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { invalidateSiteSettings } from '@/hooks/useSiteSettings';
import { GLOBAL_CREDENTIAL_PLATFORMS, PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import { useAuthStore } from '@/stores/authStore';
import {
  Save, Mail, Cloud, Globe, Key, CheckCircle, XCircle, Settings2,
} from 'lucide-react';

type SettingsSection = 'site' | 'smtp' | 'storage' | 'platforms' | 'promo';

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'site', label: 'Site Settings', icon: <Globe className="w-4 h-4" /> },
  { id: 'smtp', label: 'SMTP / Email', icon: <Mail className="w-4 h-4" /> },
  { id: 'storage', label: 'Cloud Storage', icon: <Cloud className="w-4 h-4" /> },
  { id: 'platforms', label: 'Platform Credentials', icon: <Key className="w-4 h-4" /> },
  { id: 'promo', label: 'Seasonal Campaign', icon: <Settings2 className="w-4 h-4" /> },
];

export function AdminSettingsPage() {
  const [section, setSection] = useState<SettingsSection>('site');
  const { user } = useAuthStore();
  const toast = useToast();

  // State
  const [smtpConfig, setSmtpConfig] = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '', smtp_secure: 'true' });
  const [storageConfig, setStorageConfig] = useState({ storage_provider: '', storage_endpoint: '', storage_region: '', storage_bucket: '', storage_access_key: '', storage_secret_key: '' });
  const [siteConfig, setSiteConfig] = useState({
    site_title: '',
    site_tagline: '',
    site_favicon: '',
    site_logo: '',
    seo_meta_title: '',
    seo_meta_description: '',
    fb_pixel_id: '',
    promo_enabled: 'false',
    promo_badge: '',
    promo_headline: '',
    promo_subheadline: '',
    promo_pro_discounted_price: '',
    promo_pro_original_price: '',
    promo_biz_discounted_price: '',
    promo_biz_original_price: '',
    promo_pro_coupon: '',
    promo_biz_coupon: '',
    promo_enterprise_discounted_price: '',
    promo_enterprise_original_price: '',
    promo_enterprise_coupon: '',
    promo_min_months: '',
    promo_disclaimer: '',
    promo_primary_cta: '',
    promo_secondary_cta: '',
    promo_secondary_trial_days: '',
    promo_trust_bar: '',
    promo_footer: '',
  });
  const [platformCreds, setPlatformCreds] = useState<Record<string, { access_token: string; server_key: string; client_id: string; client_secret: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.admin.getSmtp().then((res) => setSmtpConfig((prev) => ({ ...prev, ...res.data, smtp_pass: '' }))).catch(() => {});
    api.admin.getStorage().then((res) => setStorageConfig((prev) => ({ ...prev, ...res.data, storage_access_key: '', storage_secret_key: '' }))).catch(() => {});
    api.admin.getSiteSettings().then((res) => setSiteConfig((prev) => ({ ...prev, ...res.data }))).catch(() => {});
    api.admin.getPlatforms().then((res) => {
      const cleaned: Record<string, { access_token: string; server_key: string; client_id: string; client_secret: string }> = {};
      for (const k of Object.keys(res.data)) cleaned[k] = { access_token: '', server_key: '', client_id: '', client_secret: '' };
      setPlatformCreds(cleaned);
    }).catch(() => {});
  }, []);

  async function saveSmtp() {
    setSaving('smtp');
    try {
      const res = await api.admin.saveSmtp(smtpConfig);
      setSmtpConfig((prev) => ({ ...prev, ...res.data, smtp_pass: '' }));
      toast.success('Saved', 'SMTP settings saved.');
    } catch (err: any) { toast.error('Error', err.message || 'Failed'); }
    finally { setSaving(null); }
  }

  async function testSmtp() {
    setSaving('smtp-test');
    try {
      const res = await api.admin.testSmtp(user?.email || '');
      toast.success('Test Passed', res.data.message);
    } catch (err: any) { toast.error('Test Failed', err.message || 'SMTP test failed.'); }
    finally { setSaving(null); }
  }

  async function saveStorage() {
    setSaving('storage');
    try {
      const res = await api.admin.saveStorage(storageConfig);
      setStorageConfig((prev) => ({ ...prev, ...res.data, storage_access_key: '', storage_secret_key: '' }));
      toast.success('Saved', 'Storage settings saved.');
    } catch (err: any) { toast.error('Error', err.message || 'Failed'); }
    finally { setSaving(null); }
  }

  async function testStorage() {
    setSaving('storage-test');
    try {
      const res = await api.admin.testStorage(storageConfig);
      toast.success('Test Passed', res.data.message);
    } catch (err: any) { toast.error('Test Failed', err.message || 'Storage test failed.'); }
    finally { setSaving(null); }
  }

  async function saveSiteSettings() {
    setSaving('site');
    // Sanitize fb_pixel_id — extract digits only before saving
    const pixelRaw = siteConfig.fb_pixel_id || '';
    const pixelDigits = pixelRaw.replace(/\D/g, '');
    if (pixelRaw && !pixelDigits.match(/^\d{10,18}$/)) {
      toast.error('Invalid Pixel ID', 'Facebook Pixel ID must be a 10–18 digit number only. Do not paste the full script code.');
      setSaving(null);
      return;
    }
    const cleanConfig = { ...siteConfig, fb_pixel_id: pixelDigits };
    try {
      const res = await api.admin.saveSiteSettings(cleanConfig);
      setSiteConfig((prev) => ({ ...prev, ...res.data, fb_pixel_id: pixelDigits }));
      toast.success('Saved', 'Site settings saved.');
      invalidateSiteSettings();
    } catch (err: any) { toast.error('Error', err.message || 'Failed'); }
    finally { setSaving(null); }
  }

  async function savePlatforms() {
    setSaving('platforms');
    try {
      const res = await api.admin.savePlatforms(platformCreds);
      const cleaned: Record<string, { access_token: string; server_key: string; client_id: string; client_secret: string }> = {};
      for (const k of Object.keys(res.data)) cleaned[k] = { access_token: '', server_key: '', client_id: '', client_secret: '' };
      setPlatformCreds(cleaned);
      toast.success('Saved', 'Platform credentials saved.');
    } catch (err: any) { toast.error('Error', err.message || 'Failed'); }
    finally { setSaving(null); }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving('logo');
    try {
      const res = await api.admin.uploadLogo(file);
      setSiteConfig((prev) => ({ ...prev, site_logo: res.data.url }));
      toast.success('Uploaded', 'Logo uploaded.');
      invalidateSiteSettings();
    } catch (err: any) { toast.error('Error', err.message || 'Failed'); }
    finally { setSaving(null); }
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving('favicon');
    try {
      const res = await api.admin.uploadFavicon(file);
      setSiteConfig((prev) => ({ ...prev, site_favicon: res.data.url }));
      toast.success('Uploaded', 'Favicon uploaded.');
      invalidateSiteSettings();
    } catch (err: any) { toast.error('Error', err.message || 'Failed'); }
    finally { setSaving(null); }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-neutral-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">System Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">Configure SMTP, cloud storage, site settings, and platform credentials.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0 hidden md:block">
          <nav className="space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${section === s.id ? 'bg-red-600/10 text-red-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {section === 'site' && (
            <Card className="p-6 space-y-5 bg-neutral-900 border-neutral-800">
              <h2 className="text-lg font-semibold text-white">
                <Globe className="w-5 h-5 inline-block mr-2 text-neutral-400" />Site Settings
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'site_title', label: 'Site Title' },
                  { key: 'site_tagline', label: 'Tagline' },
                  { key: 'seo_meta_title', label: 'SEO Title' },
                  { key: 'seo_meta_description', label: 'SEO Description' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-neutral-400 mb-1">{label}</label>
                    <input value={(siteConfig as any)[key]} onChange={(e) => setSiteConfig((prev) => ({ ...prev, [key]: e.target.value }))} className={inputClass} />
                  </div>
                ))}

                {/* Facebook Pixel ID — digits only */}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Facebook Pixel ID</label>
                  <input
                    value={siteConfig.fb_pixel_id}
                    onChange={(e) => {
                      // Strip all non-digit characters on every keystroke
                      const digitsOnly = e.target.value.replace(/\D/g, '');
                      setSiteConfig((prev) => ({ ...prev, fb_pixel_id: digitsOnly }));
                    }}
                    onPaste={(e) => {
                      // On paste, extract only the digits from whatever is pasted (handles full script tags)
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      const match = pasted.match(/\d{10,18}/);
                      if (match) {
                        setSiteConfig((prev) => ({ ...prev, fb_pixel_id: match[0] }));
                      } else {
                        const digitsOnly = pasted.replace(/\D/g, '');
                        setSiteConfig((prev) => ({ ...prev, fb_pixel_id: digitsOnly }));
                      }
                    }}
                    className={inputClass}
                    placeholder="e.g. 4091896597776182"
                    inputMode="numeric"
                    maxLength={18}
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Enter the numeric ID only (10–18 digits). Pasting the full &lt;script&gt; code will automatically extract the ID.
                  </p>
                  {siteConfig.fb_pixel_id && !/^\d{10,18}$/.test(siteConfig.fb_pixel_id) && (
                    <p className="text-[10px] text-red-400 mt-1">⚠ Invalid — must be 10 to 18 digits with no spaces or letters.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-xs text-neutral-400" />
                  {siteConfig.site_logo && <img src={siteConfig.site_logo} alt="Logo" className="w-12 h-12 mt-2 rounded-lg object-contain bg-neutral-800" />}
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Favicon</label>
                  <input type="file" accept="image/*" onChange={handleFaviconUpload} className="text-xs text-neutral-400" />
                  {siteConfig.site_favicon && <img src={siteConfig.site_favicon} alt="Favicon" className="w-8 h-8 mt-2 rounded object-contain bg-neutral-800" />}
                </div>
              </div>
              <Button onClick={saveSiteSettings} loading={saving === 'site'} className="bg-red-600 hover:bg-red-700 text-white">
                <Save className="w-4 h-4" /> Save Site Settings
              </Button>
            </Card>
          )}

          {section === 'smtp' && (
            <Card className="p-6 space-y-5 bg-neutral-900 border-neutral-800">
              <h2 className="text-lg font-semibold text-white">
                <Mail className="w-5 h-5 inline-block mr-2 text-neutral-400" />SMTP Configuration
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'smtp_host', label: 'SMTP Host' },
                  { key: 'smtp_port', label: 'Port' },
                  { key: 'smtp_user', label: 'Username' },
                  { key: 'smtp_pass', label: 'Password', type: 'password' },
                  { key: 'smtp_from', label: 'From Address' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-xs text-neutral-400 mb-1">{label}</label>
                    <input type={type || 'text'} value={(smtpConfig as any)[key]} onChange={(e) => setSmtpConfig((prev) => ({ ...prev, [key]: e.target.value }))} className={inputClass} placeholder={label} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Secure (TLS)</label>
                  <select value={smtpConfig.smtp_secure} onChange={(e) => setSmtpConfig((prev) => ({ ...prev, smtp_secure: e.target.value }))} className={inputClass}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={saveSmtp} loading={saving === 'smtp'} className="bg-red-600 hover:bg-red-700 text-white"><Save className="w-4 h-4" /> Save</Button>
                <Button variant="secondary" onClick={testSmtp} loading={saving === 'smtp-test'} className="border-neutral-700 text-neutral-300"><CheckCircle className="w-4 h-4" /> Test Connection</Button>
              </div>
            </Card>
          )}

          {section === 'storage' && (
            <Card className="p-6 space-y-5 bg-neutral-900 border-neutral-800">
              <h2 className="text-lg font-semibold text-white">
                <Cloud className="w-5 h-5 inline-block mr-2 text-neutral-400" />Cloud Storage
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Provider</label>
                  <select value={storageConfig.storage_provider} onChange={(e) => setStorageConfig((prev) => ({ ...prev, storage_provider: e.target.value }))} className={inputClass}>
                    <option value="">Local</option>
                    <option value="s3">AWS S3</option>
                    <option value="r2">Cloudflare R2</option>
                    <option value="minio">MinIO</option>
                  </select>
                </div>
                {['storage_endpoint', 'storage_region', 'storage_bucket', 'storage_access_key', 'storage_secret_key'].map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-neutral-400 mb-1">{key.replace('storage_', '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</label>
                    <input type={key.includes('key') ? 'password' : 'text'} value={(storageConfig as any)[key]} onChange={(e) => setStorageConfig((prev) => ({ ...prev, [key]: e.target.value }))} className={inputClass} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={saveStorage} loading={saving === 'storage'} className="bg-red-600 hover:bg-red-700 text-white"><Save className="w-4 h-4" /> Save</Button>
                <Button variant="secondary" onClick={testStorage} loading={saving === 'storage-test'} className="border-neutral-700 text-neutral-300"><CheckCircle className="w-4 h-4" /> Test Connection</Button>
              </div>
            </Card>
          )}

          {section === 'platforms' && (
            <Card className="p-6 space-y-5 bg-neutral-900 border-neutral-800">
              <h2 className="text-lg font-semibold text-white">
                <Key className="w-5 h-5 inline-block mr-2 text-neutral-400" />Platform Credentials
              </h2>
              <p className="text-sm text-neutral-400">Configure API/OAuth credentials for all platforms. Credentials are stored securely on the server.</p>
              <div className="space-y-4">
                {GLOBAL_CREDENTIAL_PLATFORMS.map((platformKey) => {
                  const platform = PLATFORMS[platformKey as PlatformType] || { name: platformKey };
                  const creds = platformCreds[platformKey] || { access_token: '', server_key: '', client_id: '', client_secret: '' };
                  const isWoWonder = ['entreprenrs', 'chrxstians', 'iohah'].includes(platformKey);
                  const isSngine = platformKey === 'chrxstians' || platformKey === 'iohah';
                  const isEntreprenrs = platformKey === 'entreprenrs';
                  const isTelegram = platformKey === 'telegram';
                  const isOAuth = ['facebook', 'instagram', 'tiktok', 'linkedin', 'twitter', 'youtube', 'pinterest'].includes(platformKey);
                  return (
                    <div key={platformKey} className="p-4 rounded-xl bg-neutral-800/50 border border-neutral-700/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }} />
                        <h4 className="text-sm font-medium text-neutral-200">{platform.name}</h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">{isWoWonder ? 'API Key' : isOAuth ? 'OAuth' : 'Token'}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {isOAuth ? (
                          <>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">Client ID / App ID</label>
                              <input type="password" value={creds.client_id} onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformKey]: { ...prev[platformKey], client_id: e.target.value } }))} className={inputClass} placeholder="Enter client ID" />
                            </div>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">Client Secret / App Secret</label>
                              <input type="password" value={creds.client_secret} onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformKey]: { ...prev[platformKey], client_secret: e.target.value } }))} className={inputClass} placeholder="Enter client secret" />
                            </div>
                          </>
                        ) : isWoWonder ? (
                          <>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">{isEntreprenrs ? 'Access Token (user)' : isSngine ? 'API Key' : 'Access Token'}</label>
                              <input type="password" value={creds.access_token} onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformKey]: { ...prev[platformKey], access_token: e.target.value } }))} className={inputClass} placeholder={isEntreprenrs ? 'Enter access token' : isSngine ? 'Enter API key' : 'Enter access token'} />
                            </div>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">{isEntreprenrs ? 'Server Key (API v2)' : isSngine ? 'API Secret' : 'Server Key'}</label>
                              <input type="password" value={creds.server_key} onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformKey]: { ...prev[platformKey], server_key: e.target.value } }))} className={inputClass} placeholder={isEntreprenrs ? 'Enter server key' : isSngine ? 'Enter API secret' : 'Enter secret'} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">{isTelegram ? 'Bot Token' : 'Access Token / Bot Token'}</label>
                              <input type="password" value={creds.access_token} onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformKey]: { ...prev[platformKey], access_token: e.target.value } }))} className={inputClass} placeholder={isTelegram ? 'Enter bot token from @BotFather' : 'Enter token'} />
                            </div>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">{isTelegram ? 'Default Chat ID / Channel Username' : 'App Password / Secret'}</label>
                              {isTelegram ? (
                                <input type="text" value={creds.client_id} onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformKey]: { ...prev[platformKey], client_id: e.target.value } }))} className={inputClass} placeholder="@mychannel or -1001234567890" />
                              ) : (
                                <input type="password" value={creds.server_key} onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformKey]: { ...prev[platformKey], server_key: e.target.value } }))} className={inputClass} placeholder="Enter secret (if needed)" />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={savePlatforms} loading={saving === 'platforms'} className="bg-red-600 hover:bg-red-700 text-white"><Save className="w-4 h-4" /> Save Credentials</Button>
            </Card>
          )}

          {section === 'promo' && (
            <Card className="p-6 space-y-5 bg-neutral-900 border-neutral-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-neutral-400" />
                Seasonal Campaign Page Settings
              </h2>
              <p className="text-sm text-neutral-400">
                Customize content, prices, coupons, and disclaimers for the Entrepreneur Campaign landing page dynamically.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Campaign Enabled</label>
                  <select
                    value={siteConfig.promo_enabled}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_enabled: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="true">Active (Redirects Enabled)</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Urgency Badge Banner Text</label>
                  <input
                    value={siteConfig.promo_badge}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_badge: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Entrepreneurs Day exclusive offer"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Main Headline</label>
                  <input
                    value={siteConfig.promo_headline}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_headline: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Subheadline</label>
                  <textarea
                    rows={2}
                    value={siteConfig.promo_subheadline}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_subheadline: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Pro Plan Discounted Price ($/month)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_pro_discounted_price}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_pro_discounted_price: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Pro Plan Original Price ($/month)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_pro_original_price}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_pro_original_price: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Business Plan Discounted Price ($/month)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_biz_discounted_price}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_biz_discounted_price: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Business Plan Original Price ($/month)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_biz_original_price}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_biz_original_price: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Enterprise Plan Discounted Price ($/month)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_enterprise_discounted_price}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_enterprise_discounted_price: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Enterprise Plan Original Price ($/month)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_enterprise_original_price}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_enterprise_original_price: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Pro Plan Promo Coupon</label>
                  <input
                    value={siteConfig.promo_pro_coupon}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_pro_coupon: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Business Plan Promo Coupon</label>
                  <input
                    value={siteConfig.promo_biz_coupon}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_biz_coupon: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Enterprise Plan Promo Coupon</label>
                  <input
                    value={siteConfig.promo_enterprise_coupon}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_enterprise_coupon: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Minimum Billing Interval (Months)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_min_months}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_min_months: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Secondary CTA Trial Duration (Days)</label>
                  <input
                    type="number"
                    value={siteConfig.promo_secondary_trial_days}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_secondary_trial_days: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Billing Limitation Disclaimer Text</label>
                  <input
                    value={siteConfig.promo_disclaimer}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_disclaimer: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Primary CTA Button Copy</label>
                  <input
                    value={siteConfig.promo_primary_cta}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_primary_cta: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Secondary CTA Button Copy</label>
                  <input
                    value={siteConfig.promo_secondary_cta}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_secondary_cta: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Trust Bar Items (Comma Separated)</label>
                  <input
                    value={siteConfig.promo_trust_bar}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_trust_bar: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Campaign Custom Footer text</label>
                  <input
                    value={siteConfig.promo_footer}
                    onChange={(e) => setSiteConfig((prev) => ({ ...prev, promo_footer: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <Button onClick={saveSiteSettings} loading={saving === 'site'} className="bg-red-600 hover:bg-red-700 text-white">
                <Save className="w-4 h-4" /> Save Campaign Configuration
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
