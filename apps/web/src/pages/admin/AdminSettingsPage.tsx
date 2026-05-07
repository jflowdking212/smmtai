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

type SettingsSection = 'site' | 'smtp' | 'storage' | 'platforms';

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'site', label: 'Site Settings', icon: <Globe className="w-4 h-4" /> },
  { id: 'smtp', label: 'SMTP / Email', icon: <Mail className="w-4 h-4" /> },
  { id: 'storage', label: 'Cloud Storage', icon: <Cloud className="w-4 h-4" /> },
  { id: 'platforms', label: 'Platform Credentials', icon: <Key className="w-4 h-4" /> },
];

export function AdminSettingsPage() {
  const [section, setSection] = useState<SettingsSection>('site');
  const { user } = useAuthStore();
  const toast = useToast();

  // State
  const [smtpConfig, setSmtpConfig] = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '', smtp_secure: 'true' });
  const [storageConfig, setStorageConfig] = useState({ storage_provider: '', storage_endpoint: '', storage_region: '', storage_bucket: '', storage_access_key: '', storage_secret_key: '' });
  const [siteConfig, setSiteConfig] = useState({ site_title: '', site_tagline: '', site_favicon: '', site_logo: '', seo_meta_title: '', seo_meta_description: '' });
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
    try {
      const res = await api.admin.saveSiteSettings(siteConfig);
      setSiteConfig((prev) => ({ ...prev, ...res.data }));
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
        </div>
      </div>
    </div>
  );
}
