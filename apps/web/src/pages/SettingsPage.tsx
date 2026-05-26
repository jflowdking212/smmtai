import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { User, Bell, Shield, Palette, Save, Key, Trash2, Users, Loader2, AlertTriangle, X, MailWarning, CheckCircle2, AlertCircle } from 'lucide-react';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'appearance' | 'team';
type NotificationPreferenceKey =
  | 'postPublished'
  | 'postFailed'
  | 'upcomingScheduled'
  | 'weeklyAnalyticsDigest'
  | 'monthlyAnalyticsDigest';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
];

// ─── Themed Confirm Dialog ──────────────────────────────────────────────────
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon + Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            <p className="text-sm text-neutral-500 mt-1">{description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-blue hover:bg-brand-blue/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>(() => window.location.pathname === '/team' ? 'team' : 'profile');
  const { user, workspaceId, role, tier, setUser } = useAuthStore();
  const TEAM_LIMITS: Record<string, number> = { basic: 1, pro: 5, business: 10, enterprise: 20 };
  const limit = tier ? (TEAM_LIMITS[tier] ?? 1) : 1;
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  // Form states
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Lagos');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [country, setCountry] = useState((user as any)?.country || 'Nigeria');
  const [notificationPrefs, setNotificationPrefs] = useState({
    postPublished: true,
    postFailed: true,
    upcomingScheduled: true,
    weeklyAnalyticsDigest: true,
    monthlyAnalyticsDigest: true,
  });
  const [notificationLoadingKey, setNotificationLoadingKey] = useState<NotificationPreferenceKey | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  // Derive role from the members list for the current workspace (more accurate than JWT role)
  const myRoleInWorkspace = members.find(m => m.user?.id === user?.id || m.userId === user?.id)?.role ?? role;
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [myWorkspaces, setMyWorkspaces] = useState<any[]>([]);
  const [loadingMyWorkspaces, setLoadingMyWorkspaces] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('creator');
  const [inviting, setInviting] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    memberId: string;
    memberName: string;
  } | null>(null);

  useEffect(() => {
    if (tab === 'team' && workspaceId) {
      // Load workspace members (team the current user manages)
      setLoadingMembers(true);
      api.workspaces.getMembers(workspaceId)
        .then(res => setMembers(res.data))
        .catch(() => toast.error('Error', 'Failed to load team members'))
        .finally(() => setLoadingMembers(false));

      // Load all workspaces the user belongs to (teams they've been invited to)
      setLoadingMyWorkspaces(true);
      api.workspaces.list()
        .then(res => setMyWorkspaces(res.data || []))
        .catch(() => {})
        .finally(() => setLoadingMyWorkspaces(false));
    }
  }, [tab, workspaceId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !inviteEmail) return;
    setInviting(true);
    try {
      const result = await api.workspaces.inviteMember(workspaceId, inviteEmail, inviteRole);
      const data = (result as any).data;
      if (data?.invitationSent === false && data?.acceptLink) {
        // Email failed - show copyable link
        toast.success(
          'Invite Created',
          `Email delivery failed. Share this link manually: ${data.acceptLink}`
        );
        // Also copy to clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(data.acceptLink).catch(() => {});
        }
      } else {
        toast.success('Success', `Invitation email sent to ${inviteEmail}`);
      }
      setInviteEmail('');
      const res = await api.workspaces.getMembers(workspaceId);
      setMembers(res.data);
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  }

  // Open the themed confirm dialog
  function requestRemoveMember(member: any) {
    setConfirmDialog({
      open: true,
      memberId: member.id, // WorkspaceMember row id (works for both active and pending)
      memberName: member.displayName || member.user?.name || member.inviteEmail || 'this member',
    });
  }

  // Called after user confirms
  async function handleRemoveMember(memberId: string) {
    if (!workspaceId) return;
    setConfirmDialog(null);
    try {
      // Pass the WorkspaceMember row id. The backend now resolves by id first.
      await api.workspaces.removeMember(workspaceId, memberId);
      toast.success('Removed', 'Member has been removed from the team.');
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to remove member');
    }
  }


  useEffect(() => {
    let active = true;
    api.users.getNotificationPreferences()
      .then((res) => {
        if (!active) return;
        setNotificationPrefs(res.data);
      })
      .catch(() => {
        if (!active) return;
        toast.error('Load Failed', 'Unable to load notification preferences.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggleNotificationPreference(key: NotificationPreferenceKey) {
    const nextValue = !notificationPrefs[key];
    setNotificationLoadingKey(key);
    try {
      const res = await api.users.updateNotificationPreferences({ [key]: nextValue });
      setNotificationPrefs(res.data);
      toast.success('Preferences Updated', 'Notification preferences updated.');
    } catch (error) {
      toast.error('Update Failed', error instanceof Error ? error.message : 'Unable to update notification preferences.');
    } finally {
      setNotificationLoadingKey(null);
    }
  }

  const tabs = TABS;

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
          {tab === 'team' && (
            <Card className="p-6 space-y-5">
              <h2 className="text-lg font-heading font-semibold text-neutral-900">Team Management</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-neutral-700">Invite New Member</h3>
                  <span className="text-xs text-neutral-500 font-medium bg-neutral-100 px-2 py-1 rounded">
                    {members.length} / {limit === Infinity ? 'Unlimited' : limit} seats used
                  </span>
                </div>
                {myRoleInWorkspace !== 'viewer' ? (
                  <form onSubmit={handleInvite} className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Email Address</label>
                      <input 
                        type="email" 
                        required 
                        value={inviteEmail} 
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" 
                        placeholder="colleague@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
                      <select 
                        value={inviteRole} 
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                      >
                        <option value="creator">Creator</option>
                        <option value="manager">Manager</option>
                      </select>
                    </div>
                    <Button type="submit" disabled={inviting}>
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite'}
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-neutral-500 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    You do not have permission to invite members. Please contact a workspace owner or admin.
                  </p>
                )}
              </div>

              <div className="pt-6 border-t border-neutral-100 space-y-4">
                <h3 className="text-sm font-semibold text-neutral-700">Team Members</h3>
                {loadingMembers ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                    <span className="text-sm text-neutral-500">Loading members...</span>
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-sm text-neutral-500">No other team members found.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${member.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-brand-blue/10 text-brand-blue'}`}>
                            {(member.displayName || member.user?.name || member.displayEmail || member.inviteEmail || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-900">{member.displayName || member.user?.name || member.displayEmail || member.inviteEmail || 'Invited User'}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500 capitalize">{member.role}</span>
                              {member.status === 'pending' ? (
                                <span className="text-[10px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">⏳ Pending</span>
                              ) : member.role !== 'owner' ? (
                                <span className="text-[10px] uppercase tracking-wider font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200">✓ Active</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {myRoleInWorkspace !== 'viewer' && member.user?.id !== user?.id && member.userId !== user?.id && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            title={member.status === 'pending' ? 'Cancel invitation' : 'Remove member'}
                            onClick={() => requestRemoveMember(member)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Teams Section - workspaces the current user has been invited to */}
              <div className="pt-6 border-t border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-700">Teams I Belong To</h3>
                  <span className="text-xs text-neutral-400">{myWorkspaces.length} workspace{myWorkspaces.length !== 1 ? 's' : ''}</span>
                </div>
                {loadingMyWorkspaces ? (
                  <div className="flex items-center gap-2 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                    <span className="text-sm text-neutral-500">Loading your teams...</span>
                  </div>
                ) : myWorkspaces.length === 0 ? (
                  <div className="py-4 text-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50">
                    <p className="text-sm text-neutral-400">You haven't been added to any other teams yet.</p>
                    <p className="text-xs text-neutral-400 mt-1">When someone invites you to their workspace, it will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myWorkspaces.map((ws: any) => {
                      const isOwn = ws.id === workspaceId;
                      const roleColors: Record<string, string> = {
                        owner: 'bg-purple-100 text-purple-700',
                        manager: 'bg-blue-100 text-blue-700',
                        creator: 'bg-green-100 text-green-700',
                        viewer: 'bg-neutral-100 text-neutral-600',
                      };
                      const roleColor = roleColors[ws.role] || roleColors.viewer;
                      return (
                        <div key={ws.id} className={`flex items-center justify-between p-3 rounded-lg border bg-white ${isOwn ? 'border-brand-blue/30 bg-brand-blue/5' : 'border-neutral-200'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-blue/20 to-purple-100 flex items-center justify-center text-sm font-bold text-brand-blue">
                              {ws.name?.charAt(0)?.toUpperCase() || 'W'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                                {ws.name}
                                {isOwn && <span className="text-[10px] font-semibold text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded">Your Workspace</span>}
                              </p>
                              <p className="text-xs text-neutral-400">{ws._count?.members || 0} member{(ws._count?.members || 0) !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full capitalize ${roleColor}`}>{ws.role}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

          {tab === 'profile' && (
            <Card className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-heading font-semibold text-neutral-900">Profile</h2>
                {/* Profile completion badge */}
                {user?.name ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full border border-green-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" /> Incomplete — cannot post
                  </span>
                )}
              </div>

              {/* Email verification badge */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${user?.emailVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  <MailWarning className={`w-4 h-4 ${user?.emailVerified ? 'text-green-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{user?.email}</p>
                    <p className={`text-xs ${user?.emailVerified ? 'text-green-600' : 'text-amber-600'} font-medium`}>
                      {user?.emailVerified ? '✓ Email verified' : '⚠ Not verified — check your inbox'}
                    </p>
                  </div>
                </div>
                {!user?.emailVerified && (
                  <button
                    onClick={async () => {
                      try {
                        await api.auth.resendVerification();
                        toast.success('Email sent!', 'Check your inbox for the verification link.');
                      } catch {
                        toast.error('Error', 'Failed to resend verification email.');
                      }
                    }}
                    className="text-xs font-semibold text-amber-700 hover:underline"
                  >
                    Resend
                  </button>
                )}
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-blue/10 flex items-center justify-center text-2xl font-bold text-brand-blue overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const fileInput = document.getElementById('avatar-upload-input');
                        if (fileInput) fileInput.click();
                      }}
                      className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold shadow hover:bg-brand-blue-dark transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Picture
                    </button>
                    {user?.avatar && (
                      <button
                        type="button"
                        onClick={() => {
                          api.users.updateProfile({ avatar: '' })
                            .then(res => {
                              setUser({ ...user!, ...res.data });
                              toast.success('Success', 'Profile picture removed.');
                            })
                            .catch(() => toast.error('Error', 'Failed to remove picture.'));
                        }}
                        className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    id="avatar-upload-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      toast.info('Uploading...', 'Uploading your profile picture.');
                      try {
                        const res = await api.posts.uploadMedia(file);
                        const imageUrl = res.data.url;
                        
                        const profileRes = await api.users.updateProfile({ avatar: imageUrl });
                        setUser({ ...user!, ...profileRes.data });
                        
                        toast.success('Success', 'Profile picture uploaded successfully.');
                      } catch (err: any) {
                        toast.error('Upload Failed', err.message || 'Failed to upload image.');
                      }
                    }}
                  />
                  <p className="text-xs text-neutral-400">JPG, PNG or GIF. Max size 5MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                  <input value={email} readOnly type="email"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-neutral-50 text-neutral-400 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Phone Number *</label>
                  <input
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 8900" type="tel"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Country *</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm">
                    {['Nigeria','United States','United Kingdom','Canada','Australia','Ghana','Kenya','South Africa','India','Germany','France','Brazil','Mexico','Philippines','Indonesia','Other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm">
                    <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                    <option value="America/New_York">America/New_York (ET)</option>
                    <option value="America/Chicago">America/Chicago (CT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <Button onClick={async () => {
                try {
                  const res = await api.users.updateProfile({ name, timezone, phone, country });
                  setUser({ ...user!, ...res.data });
                  toast.success('Saved', 'Profile updated successfully.');
                } catch (err) {
                  toast.error('Error', err instanceof Error ? err.message : 'Failed to save');
                }
              }}>
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </Card>
          )}

          {tab === 'notifications' && (
            <Card className="p-6 space-y-5">
              <h2 className="text-lg font-heading font-semibold text-neutral-900">Notifications</h2>

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

      {/* Themed Confirm Dialog for member removal */}
      <ConfirmDialog
        open={!!confirmDialog?.open}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${confirmDialog?.memberName ?? 'this member'} from the team? This action cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        onConfirm={() => confirmDialog && handleRemoveMember(confirmDialog.memberId)}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
