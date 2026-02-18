import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { api } from '@/lib/api';
import {
  User, Bell, Shield, Palette, Key, Trash2, Save,
} from 'lucide-react';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'appearance';
type NotificationPreferenceKey =
  | 'postPublished'
  | 'postFailed'
  | 'upcomingScheduled'
  | 'weeklyAnalyticsDigest'
  | 'monthlyAnalyticsDigest';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();

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
            {TABS.map((t) => (
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
        </div>
      </div>
    </div>
  );
}
