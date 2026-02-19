import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { api } from '@/lib/api';
import {
  User, Bell, Shield, Palette, Key, Trash2, Save, Settings2, Mail, Cloud, CheckCircle, XCircle,
} from 'lucide-react';

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
      const res = await api.admin.testStorage();
      setAdminMsg({ section: 'storage', type: 'success', text: res.data.message });
    } catch (err: any) {
      setAdminMsg({ section: 'storage', type: 'error', text: err.message || 'Storage test failed.' });
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
