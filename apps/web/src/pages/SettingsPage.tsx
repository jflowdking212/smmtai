import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { api } from '@/lib/api';
import { invalidateSiteSettings } from '@/hooks/useSiteSettings';
import {
  User, Bell, Shield, Palette, Key, Trash2, Save, Settings2, Mail, Cloud, CheckCircle, XCircle, Globe,
} from 'lucide-react';
import { GLOBAL_CREDENTIAL_PLATFORMS, PLATFORMS, SUBSCRIPTION_LIMITS, TIER_PLATFORMS, type SubscriptionTier, type PlatformType } from '@ee-postmind/shared';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'appearance' | 'admin';
type NotificationPreferenceKey =
  | 'postPublished'
  | 'postFailed'
  | 'upcomingScheduled'
  | 'weeklyAnalyticsDigest'
  | 'monthlyAnalyticsDigest';

const BASE_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
];

const ADMIN_TAB: { id: SettingsTab; label: string; icon: React.ReactNode } = { id: 'admin', label: 'Admin', icon: <Settings2 className="w-4 h-4" /> };

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [isOwner, setIsOwner] = useState(false);

  // Admin state
  const [smtpConfig, setSmtpConfig] = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '', smtp_secure: 'true' });
  const [storageConfig, setStorageConfig] = useState({ storage_provider: '', storage_endpoint: '', storage_region: '', storage_bucket: '', storage_access_key: '', storage_secret_key: '' });
  const [siteConfig, setSiteConfig] = useState({ site_title: '', site_tagline: '', site_favicon: '', site_logo: '', seo_meta_title: '', seo_meta_description: '' });
  const [platformCreds, setPlatformCreds] = useState<Record<string, { access_token: string; server_key: string }>>({});
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});
  const [adminMsg, setAdminMsg] = useState<{ section: string; type: 'success' | 'error'; text: string } | null>(null);
  const [adminLoading, setAdminLoading] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [timezone, setTimezone] = useState('America/New_York');
  const [notificationPrefs, setNotificationPrefs] = useState({
    postPublished: true,
    postFailed: true,
    upcomingScheduled: true,
    weeklyAnalyticsDigest: true,
    monthlyAnalyticsDigest: true,
  });
  const [notificationLoadingKey, setNotificationLoadingKey] = useState<NotificationPreferenceKey | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    api.users.getNotificationPreferences()
      .then((res) => {
        if (!active) return;
        setNotificationPrefs(res.data);
      })
      .catch(() => {
        if (!active) return;
        setNotificationMessage({ type: 'error', text: 'Unable to load notification preferences.' });
      });
    // Check if user is owner by trying to load admin settings
    api.admin.getSmtp()
      .then((res) => {
        if (!active) return;
        setIsOwner(true);
        setSmtpConfig((prev) => ({ ...prev, ...res.data, smtp_pass: '' }));
      })
      .catch(() => { /* Not owner or error — hide admin tab */ });
    api.admin.getStorage()
      .then((res) => {
        if (!active) return;
        setStorageConfig((prev) => ({ ...prev, ...res.data, storage_access_key: '', storage_secret_key: '' }));
      })
      .catch(() => { /* ignore */ });
    api.admin.getSiteSettings()
      .then((res) => {
        if (!active) return;
        setSiteConfig((prev) => ({ ...prev, ...res.data }));
      })
      .catch(() => { /* ignore */ });
    api.admin.getPlatforms()
      .then((res) => {
        if (!active) return;
        // Clear sensitive fields for display — keep only masked values
        const cleaned: Record<string, { access_token: string; server_key: string }> = {};
        for (const [k, v] of Object.entries(res.data)) {
          cleaned[k] = { access_token: '', server_key: '' };
        }
        setPlatformCreds(cleaned);
      })
      .catch(() => { /* ignore */ });
    api.admin.getPlans()
      .then((res) => {
        if (!active) return;
        setPlanConfig(res.data);
      })
      .catch(() => { /* ignore */ });
    return () => {
      active = false;
    };
  }, []);

  async function toggleNotificationPreference(key: NotificationPreferenceKey) {
    const nextValue = !notificationPrefs[key];
    setNotificationLoadingKey(key);
    setNotificationMessage(null);
    try {
      const res = await api.users.updateNotificationPreferences({ [key]: nextValue });
      setNotificationPrefs(res.data);
      setNotificationMessage({ type: 'success', text: 'Notification preferences updated.' });
    } catch (error) {
      setNotificationMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to update notification preferences.',
      });
    } finally {
      setNotificationLoadingKey(null);
    }
  }

  const tabs = isOwner ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  async function saveSmtp() {
    setAdminLoading('smtp-save');
    setAdminMsg(null);
    try {
      const res = await api.admin.saveSmtp(smtpConfig);
      setSmtpConfig((prev) => ({ ...prev, ...res.data, smtp_pass: '' }));
      setAdminMsg({ section: 'smtp', type: 'success', text: 'SMTP settings saved.' });
    } catch (err: any) {
      setAdminMsg({ section: 'smtp', type: 'error', text: err.message || 'Failed to save SMTP settings.' });
    } finally {
      setAdminLoading(null);
    }
  }

  async function testSmtp() {
    setAdminLoading('smtp-test');
    setAdminMsg(null);
    try {
      const res = await api.admin.testSmtp(user?.email || '');
      setAdminMsg({ section: 'smtp', type: 'success', text: res.data.message });
    } catch (err: any) {
      setAdminMsg({ section: 'smtp', type: 'error', text: err.message || 'SMTP test failed.' });
    } finally {
      setAdminLoading(null);
    }
  }

  async function saveStorage() {
    setAdminLoading('storage-save');
    setAdminMsg(null);
    try {
      const res = await api.admin.saveStorage(storageConfig);
      setStorageConfig((prev) => ({ ...prev, ...res.data, storage_access_key: '', storage_secret_key: '' }));
      setAdminMsg({ section: 'storage', type: 'success', text: 'Storage settings saved.' });
    } catch (err: any) {
      setAdminMsg({ section: 'storage', type: 'error', text: err.message || 'Failed to save storage settings.' });
    } finally {
      setAdminLoading(null);
    }
  }

  async function testStorage() {
    setAdminLoading('storage-test');
    setAdminMsg(null);
    try {
      const res = await api.admin.testStorage(storageConfig);
      setAdminMsg({ section: 'storage', type: 'success', text: res.data.message });
    } catch (err: any) {
      setAdminMsg({ section: 'storage', type: 'error', text: err.message || 'Storage test failed.' });
    } finally {
      setAdminLoading(null);
    }
  }

  async function saveSiteSettings() {
    setAdminLoading('site-save');
    setAdminMsg(null);
    try {
      const res = await api.admin.saveSiteSettings(siteConfig);
      setSiteConfig((prev) => ({ ...prev, ...res.data }));
      setAdminMsg({ section: 'site', type: 'success', text: 'Site settings saved.' });
      invalidateSiteSettings();
    } catch (err: any) {
      setAdminMsg({ section: 'site', type: 'error', text: err.message || 'Failed to save site settings.' });
    } finally {
      setAdminLoading(null);
    }
  }

  async function savePlatforms() {
    setAdminLoading('platforms-save');
    setAdminMsg(null);
    try {
      const res = await api.admin.savePlatforms(platformCreds);
      const cleaned: Record<string, { access_token: string; server_key: string }> = {};
      for (const k of Object.keys(res.data)) {
        cleaned[k] = { access_token: '', server_key: '' };
      }
      setPlatformCreds(cleaned);
      setAdminMsg({ section: 'platforms', type: 'success', text: 'Platform credentials saved.' });
    } catch (err: any) {
      setAdminMsg({ section: 'platforms', type: 'error', text: err.message || 'Failed to save platform credentials.' });
    } finally {
      setAdminLoading(null);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdminLoading('logo-upload');
    setAdminMsg(null);
    try {
      const res = await api.admin.uploadLogo(file);
      setSiteConfig((prev) => ({ ...prev, site_logo: res.data.url }));
      setAdminMsg({ section: 'site', type: 'success', text: 'Logo uploaded successfully.' });
      invalidateSiteSettings();
    } catch (err: any) {
      setAdminMsg({ section: 'site', type: 'error', text: err.message || 'Failed to upload logo.' });
    } finally {
      setAdminLoading(null);
    }
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdminLoading('favicon-upload');
    setAdminMsg(null);
    try {
      const res = await api.admin.uploadFavicon(file);
      setSiteConfig((prev) => ({ ...prev, site_favicon: res.data.url }));
      setAdminMsg({ section: 'site', type: 'success', text: 'Favicon uploaded successfully.' });
      invalidateSiteSettings();
    } catch (err: any) {
      setAdminMsg({ section: 'site', type: 'error', text: err.message || 'Failed to upload favicon.' });
    } finally {
      setAdminLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0 hidden md:block">
          <nav className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === t.id ? 'bg-brand-blue/10 text-brand-blue' : 'text-neutral-600 hover:bg-neutral-100'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {tab === 'profile' && (
            <Card className="p-6 space-y-5">
              <h2 className="text-lg font-heading font-semibold text-neutral-900">Profile</h2>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-blue/10 flex items-center justify-center text-2xl font-bold text-brand-blue">
                  {name?.charAt(0) || 'U'}
                </div>
                <div>
                  <Button variant="secondary" size="sm">Change Avatar</Button>
                  <p className="text-xs text-neutral-400 mt-1">JPG, PNG, GIF. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm">
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">GMT</option>
                    <option value="Europe/Paris">CET</option>
                    <option value="Asia/Tokyo">JST</option>
                  </select>
                </div>
              </div>

              <Button><Save className="w-4 h-4" /> Save Changes</Button>
            </Card>
          )}

          {tab === 'notifications' && (
            <Card className="p-6 space-y-5">
              <h2 className="text-lg font-heading font-semibold text-neutral-900">Notifications</h2>
              {notificationMessage ? (
                <div className={`text-sm ${notificationMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                  {notificationMessage.text}
                </div>
              ) : null}

              <div className="space-y-4">
                {[
                  {
                    key: 'postPublished' as const,
                    label: 'Post published emails',
                    desc: 'Receive an email when posts are published successfully.',
                  },
                  {
                    key: 'postFailed' as const,
                    label: 'Post failed emails',
                    desc: 'Receive an email when publishing fails.',
                  },
                  {
                    key: 'upcomingScheduled' as const,
                    label: 'Upcoming schedule reminders',
                    desc: 'Receive reminders before scheduled posts go live.',
                  },
                  {
                    key: 'weeklyAnalyticsDigest' as const,
                    label: 'Weekly analytics digest',
                    desc: 'Receive a weekly email digest with performance highlights.',
                  },
                  {
                    key: 'monthlyAnalyticsDigest' as const,
                    label: 'Monthly analytics digest',
                    desc: 'Receive a monthly summary with trends and top posts.',
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{item.label}</p>
                      <p className="text-xs text-neutral-500">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => void toggleNotificationPreference(item.key)}
                      disabled={notificationLoadingKey === item.key}
                      className={`w-11 h-6 rounded-full transition-colors relative ${notificationPrefs[item.key] ? 'bg-brand-blue' : 'bg-neutral-300'} ${notificationLoadingKey === item.key ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notificationPrefs[item.key] ? 'left-5.5 translate-x-0' : 'left-0.5'}`}
                        style={{ left: notificationPrefs[item.key] ? '22px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'security' && (
            <Card className="p-6 space-y-5">
              <h2 className="text-lg font-heading font-semibold text-neutral-900">Security</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Current Password</label>
                  <input type="password" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">New Password</label>
                  <input type="password" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Confirm New Password</label>
                  <input type="password" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <Button><Key className="w-4 h-4" /> Update Password</Button>
              </div>

              <div className="pt-4 border-t border-neutral-100">
                <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
                <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" /> Delete Account
                </Button>
              </div>
            </Card>
          )}

          {tab === 'appearance' && (
            <Card className="p-6 space-y-5">
              <h2 className="text-lg font-heading font-semibold text-neutral-900">Appearance</h2>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`p-4 rounded-lg border-2 text-center transition-all
                        ${theme === t ? 'border-brand-blue bg-blue-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                    >
                      <div className={`w-8 h-8 mx-auto rounded-lg mb-2 ${t === 'dark' ? 'bg-neutral-800' : t === 'light' ? 'bg-white border border-neutral-200' : 'bg-gradient-to-br from-white to-neutral-800'}`} />
                      <span className="text-xs font-medium text-neutral-700 capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {tab === 'admin' && isOwner && (
            <div className="space-y-6">
              {/* General Site Settings */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-brand-blue" />
                  <h2 className="text-lg font-heading font-semibold text-neutral-900">General Site Settings</h2>
                </div>
                <p className="text-sm text-neutral-500">Configure your site branding, logo, and SEO metadata.</p>

                {adminMsg?.section === 'site' && (
                  <div className={`flex items-center gap-2 text-sm ${adminMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {adminMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {adminMsg.text}
                  </div>
                )}

                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Site Logo</label>
                  <div className="flex items-center gap-4">
                    {siteConfig.site_logo && (
                      <img src={siteConfig.site_logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-neutral-200" />
                    )}
                    <label className="cursor-pointer px-4 py-2 text-sm font-medium bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
                      {adminLoading === 'logo-upload' ? 'Uploading…' : 'Upload Logo'}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={adminLoading === 'logo-upload'} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Site Title</label>
                    <input value={siteConfig.site_title} onChange={(e) => setSiteConfig({ ...siteConfig, site_title: e.target.value })}
                      placeholder="Postmind" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Tagline</label>
                    <input value={siteConfig.site_tagline} onChange={(e) => setSiteConfig({ ...siteConfig, site_tagline: e.target.value })}
                      placeholder="AI-Powered Social Media Management" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Favicon</label>
                    <div className="flex items-center gap-3">
                      {siteConfig.site_favicon && (
                        <img src={siteConfig.site_favicon} alt="Favicon" className="w-8 h-8 object-contain rounded border border-neutral-200" />
                      )}
                      <label className="cursor-pointer px-3 py-1.5 text-sm font-medium bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
                        {adminLoading === 'favicon-upload' ? 'Uploading…' : 'Upload Favicon'}
                        <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" disabled={adminLoading === 'favicon-upload'} />
                      </label>
                    </div>
                  </div>
                </div>

                <hr className="border-neutral-100" />
                <h3 className="text-sm font-semibold text-neutral-800">SEO Settings</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Meta Title</label>
                    <input value={siteConfig.seo_meta_title} onChange={(e) => setSiteConfig({ ...siteConfig, seo_meta_title: e.target.value })}
                      placeholder="Postmind — AI Social Media Management" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Meta Description</label>
                    <textarea value={siteConfig.seo_meta_description} onChange={(e) => setSiteConfig({ ...siteConfig, seo_meta_description: e.target.value })}
                      placeholder="Create, schedule, and publish social media content with AI…" rows={3}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={saveSiteSettings} disabled={adminLoading === 'site-save'}>
                    <Save className="w-4 h-4 mr-2" /> {adminLoading === 'site-save' ? 'Saving…' : 'Save Site Settings'}
                  </Button>
                </div>
              </Card>

              {/* SMTP Email Configuration */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-brand-blue" />
                  <h2 className="text-lg font-heading font-semibold text-neutral-900">SMTP Email Configuration</h2>
                </div>
                <p className="text-sm text-neutral-500">Configure your own SMTP server for sending emails. Leave empty to use the default email provider.</p>

                {adminMsg?.section === 'smtp' && (
                  <div className={`flex items-center gap-2 text-sm ${adminMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {adminMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {adminMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">SMTP Host</label>
                    <input value={smtpConfig.smtp_host} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">SMTP Port</label>
                    <input value={smtpConfig.smtp_port} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: e.target.value })}
                      placeholder="587" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Username</label>
                    <input value={smtpConfig.smtp_user} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                      placeholder="user@example.com" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
                    <input type="password" value={smtpConfig.smtp_pass} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_pass: e.target.value })}
                      placeholder="Enter password" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">From Address</label>
                    <input value={smtpConfig.smtp_from} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from: e.target.value })}
                      placeholder="App Name <noreply@example.com>" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Secure (TLS)</label>
                    <select value={smtpConfig.smtp_secure} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_secure: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm">
                      <option value="true">Yes (port 465)</option>
                      <option value="false">No / STARTTLS (port 587)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => void saveSmtp()} disabled={adminLoading === 'smtp-save'}>
                    <Save className="w-4 h-4" /> {adminLoading === 'smtp-save' ? 'Saving...' : 'Save SMTP Settings'}
                  </Button>
                  <Button variant="secondary" onClick={() => void testSmtp()} disabled={adminLoading === 'smtp-test'}>
                    <Mail className="w-4 h-4" /> {adminLoading === 'smtp-test' ? 'Sending...' : 'Send Test Email'}
                  </Button>
                </div>
              </Card>

              {/* Cloud Storage Configuration */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-brand-blue" />
                  <h2 className="text-lg font-heading font-semibold text-neutral-900">Cloud Storage (S3-Compatible)</h2>
                </div>
                <p className="text-sm text-neutral-500">Configure S3-compatible cloud storage for media uploads. Supports Wasabi and DigitalOcean Spaces.</p>

                {adminMsg?.section === 'storage' && (
                  <div className={`flex items-center gap-2 text-sm ${adminMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {adminMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {adminMsg.text}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Storage Provider</label>
                  <select value={storageConfig.storage_provider} onChange={(e) => {
                    const provider = e.target.value;
                    const defaults: Record<string, { endpoint: string; region: string }> = {
                      wasabi: { endpoint: 'https://s3.wasabisys.com', region: 'us-east-1' },
                      digitalocean: { endpoint: 'https://nyc3.digitaloceanspaces.com', region: 'nyc3' },
                    };
                    setStorageConfig({
                      ...storageConfig,
                      storage_provider: provider,
                      storage_endpoint: defaults[provider]?.endpoint || storageConfig.storage_endpoint,
                      storage_region: defaults[provider]?.region || storageConfig.storage_region,
                    });
                  }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm">
                    <option value="">Select a provider...</option>
                    <option value="wasabi">Wasabi</option>
                    <option value="digitalocean">DigitalOcean Spaces</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Endpoint URL</label>
                    <input value={storageConfig.storage_endpoint} onChange={(e) => setStorageConfig({ ...storageConfig, storage_endpoint: e.target.value })}
                      placeholder="https://s3.wasabisys.com" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Region</label>
                    <input value={storageConfig.storage_region} onChange={(e) => setStorageConfig({ ...storageConfig, storage_region: e.target.value })}
                      placeholder="us-east-1" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Bucket Name</label>
                    <input value={storageConfig.storage_bucket} onChange={(e) => setStorageConfig({ ...storageConfig, storage_bucket: e.target.value })}
                      placeholder="my-media-bucket" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div className="hidden sm:block" />
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Access Key</label>
                    <input value={storageConfig.storage_access_key} onChange={(e) => setStorageConfig({ ...storageConfig, storage_access_key: e.target.value })}
                      placeholder="Enter access key" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Secret Key</label>
                    <input type="password" value={storageConfig.storage_secret_key} onChange={(e) => setStorageConfig({ ...storageConfig, storage_secret_key: e.target.value })}
                      placeholder="Enter secret key" className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => void saveStorage()} disabled={adminLoading === 'storage-save'}>
                    <Save className="w-4 h-4" /> {adminLoading === 'storage-save' ? 'Saving...' : 'Save Storage Settings'}
                  </Button>
                  <Button variant="secondary" onClick={() => void testStorage()} disabled={adminLoading === 'storage-test'}>
                    <Cloud className="w-4 h-4" /> {adminLoading === 'storage-test' ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
              </Card>

              {/* Global Platform Credentials */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-brand-blue" />
                  <h2 className="text-lg font-heading font-semibold text-neutral-900">Custom Platform Credentials</h2>
                </div>
                <p className="text-sm text-neutral-500">
                  Configure global API credentials for your custom platforms. All users will be able to connect these platforms with a single click.
                </p>

                {adminMsg?.section === 'platforms' && (
                  <div className={`flex items-center gap-2 text-sm ${adminMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {adminMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {adminMsg.text}
                  </div>
                )}

                {GLOBAL_CREDENTIAL_PLATFORMS.map((platformId) => {
                  const platform = PLATFORMS[platformId];
                  const creds = platformCreds[platformId] || { access_token: '', server_key: '' };
                  const needsServerKey = platformId === 'entreprenrs' || platformId === 'iohah';
                  return (
                    <div key={platformId} className="space-y-3 p-4 border border-neutral-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: platform.color }} />
                        <h3 className="text-sm font-semibold text-neutral-800">{platform.name}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">Access Token</label>
                          <input
                            type="password"
                            value={creds.access_token}
                            onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformId]: { ...creds, access_token: e.target.value } }))}
                            placeholder="Enter access token"
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                          />
                        </div>
                        {needsServerKey && (
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Server Key</label>
                            <input
                              type="password"
                              value={creds.server_key}
                              onChange={(e) => setPlatformCreds((prev) => ({ ...prev, [platformId]: { ...creds, server_key: e.target.value } }))}
                              placeholder="Enter server key"
                              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="flex gap-3 pt-2">
                  <Button onClick={() => void savePlatforms()} disabled={adminLoading === 'platforms-save'}>
                    <Save className="w-4 h-4" /> {adminLoading === 'platforms-save' ? 'Saving...' : 'Save Platform Credentials'}
                  </Button>
                </div>
              </Card>

              {/* Plan Management */}
              <PlanManagementCard
                planConfig={planConfig}
                setPlanConfig={setPlanConfig}
                adminMsg={adminMsg}
                setAdminMsg={setAdminMsg}
                adminLoading={adminLoading}
                setAdminLoading={setAdminLoading}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Plan Management Card (admin-only)
// ============================================================

const TIERS: SubscriptionTier[] = ['basic', 'pro', 'business', 'enterprise'];
const TIER_LABELS: Record<SubscriptionTier, string> = { basic: 'Basic', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };
const LIMIT_KEYS: { key: string; label: string; isInfinity?: boolean }[] = [
  { key: 'socialAccounts', label: 'Social Accounts' },
  { key: 'postsPerMonth', label: 'Posts / Month' },
  { key: 'aiGenerationsPerMonth', label: 'AI Generations / Month' },
  { key: 'templatesPerMonth', label: 'Templates / Month' },
  { key: 'teamMembers', label: 'Team Members' },
  { key: 'analyticsDays', label: 'Analytics Days' },
];
const PRICE_KEYS: { key: string; label: string }[] = [
  { key: 'monthlyPrice', label: 'Monthly Price ($)' },
  { key: 'yearlyDiscount', label: 'Yearly Discount (%)' },
];

const ALL_PLATFORMS: PlatformType[] = [
  'entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram', 'twitter',
  'youtube', 'pinterest', 'tiktok', 'linkedin', 'bluesky', 'mastodon', 'telegram',
];

function PlanManagementCard({
  planConfig, setPlanConfig, adminMsg, setAdminMsg, adminLoading, setAdminLoading,
}: {
  planConfig: Record<string, any>;
  setPlanConfig: (v: Record<string, any>) => void;
  adminMsg: { section: string; type: 'success' | 'error'; text: string } | null;
  setAdminMsg: (v: { section: string; type: 'success' | 'error'; text: string } | null) => void;
  adminLoading: string | null;
  setAdminLoading: (v: string | null) => void;
}) {
  // Merge saved config over defaults
  function getLimits(tier: SubscriptionTier) {
    const defaults = SUBSCRIPTION_LIMITS[tier];
    const saved = planConfig?.limits?.[tier] || {};
    // Merge, converting __INFINITY__ strings to Infinity for display
    const merged = { ...defaults, ...saved };
    for (const key of Object.keys(merged)) {
      if ((merged as any)[key] === '__INFINITY__') (merged as any)[key] = Infinity;
    }
    return merged;
  }

  function getPricing(tier: SubscriptionTier) {
    const defaultPrices: Record<SubscriptionTier, number> = { basic: 0, pro: 19, business: 49, enterprise: 0 };
    const saved = planConfig?.pricing?.[tier] || {};
    return {
      monthlyPrice: saved.monthlyPrice ?? defaultPrices[tier],
      yearlyDiscount: saved.yearlyDiscount ?? planConfig?.yearlyDiscount ?? 30,
    };
  }

  function getGlobalDiscount(): number {
    return planConfig?.yearlyDiscount ?? 30;
  }

  function updateGlobalDiscount(value: string) {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setPlanConfig({ ...planConfig, yearlyDiscount: num });
  }

  function getPlatforms(tier: SubscriptionTier): PlatformType[] {
    return planConfig?.platforms?.[tier] || TIER_PLATFORMS[tier];
  }

  function updateLimit(tier: SubscriptionTier, key: string, value: string) {
    const num = value === '' ? 0 : value.toLowerCase() === 'unlimited' ? Infinity : Number(value);
    setPlanConfig({
      ...planConfig,
      limits: {
        ...planConfig?.limits,
        [tier]: { ...getLimits(tier), [key]: isNaN(num) ? 0 : num },
      },
    });
  }

  function updatePricing(tier: SubscriptionTier, key: string, value: string) {
    const num = Number(value) || 0;
    setPlanConfig({
      ...planConfig,
      pricing: {
        ...planConfig?.pricing,
        [tier]: { ...getPricing(tier), [key]: num },
      },
    });
  }

  function togglePlatform(tier: SubscriptionTier, platform: PlatformType) {
    const current = new Set(getPlatforms(tier));
    if (current.has(platform)) current.delete(platform); else current.add(platform);
    setPlanConfig({
      ...planConfig,
      platforms: {
        ...planConfig?.platforms,
        [tier]: ALL_PLATFORMS.filter((p) => current.has(p)),
      },
    });
  }

  async function savePlans() {
    setAdminLoading('plans-save');
    setAdminMsg(null);
    try {
      const res = await api.admin.savePlans(planConfig);
      setPlanConfig(res.data);
      setAdminMsg({ section: 'plans', type: 'success', text: 'Plan configuration saved.' });
    } catch (err) {
      setAdminMsg({ section: 'plans', type: 'error', text: err instanceof Error ? err.message : 'Failed to save.' });
    } finally {
      setAdminLoading(null);
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold text-neutral-900">Plan Management</h2>
        {adminMsg?.section === 'plans' && (
          <span className={`text-sm ${adminMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {adminMsg.text}
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-500">
        Configure limits, pricing, and available platforms for each subscription tier. Changes are saved to the database and override defaults.
      </p>

      {/* Global Yearly Discount */}
      <div className="border rounded-lg p-4 bg-neutral-50">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Yearly Discount (%)</label>
            <p className="text-xs text-neutral-500">Default discount applied when users choose yearly billing. Each tier can override this below.</p>
          </div>
          <div className="w-32">
            <input
              type="number"
              min={0}
              max={100}
              value={getGlobalDiscount()}
              onChange={(e) => updateGlobalDiscount(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {TIERS.map((tier) => {
          const limits = getLimits(tier);
          const pricing = getPricing(tier);
          const platforms = new Set(getPlatforms(tier));

          return (
            <div key={tier} className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-neutral-800">{TIER_LABELS[tier]}</h3>

              {/* Pricing */}
              {tier !== 'basic' && tier !== 'enterprise' && (
                <div className="grid grid-cols-2 gap-3">
                  {PRICE_KEYS.map((pk) => (
                    <div key={pk.key}>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">{pk.label}</label>
                      <input
                        type="number"
                        min={0}
                        value={pricing[pk.key as keyof typeof pricing]}
                        onChange={(e) => updatePricing(tier, pk.key, e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Limits */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LIMIT_KEYS.map((lk) => {
                  const val = limits[lk.key as keyof typeof limits];
                  return (
                    <div key={lk.key}>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">{lk.label}</label>
                      <input
                        type="text"
                        value={val === Infinity ? 'Unlimited' : val}
                        onChange={(e) => updateLimit(tier, lk.key, e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Available Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map((pid) => (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => togglePlatform(tier, pid)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        platforms.has(pid)
                          ? 'bg-brand-50 border-brand-300 text-brand-700'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                      }`}
                    >
                      {PLATFORMS[pid].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={() => void savePlans()} disabled={adminLoading === 'plans-save'}>
          <Save className="w-4 h-4" /> {adminLoading === 'plans-save' ? 'Saving...' : 'Save Plan Configuration'}
        </Button>
      </div>
    </Card>
  );
}
