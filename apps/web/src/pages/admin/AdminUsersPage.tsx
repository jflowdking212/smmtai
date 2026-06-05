import { useCallback, useEffect, useState } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldOff,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  X,
  Calendar,
} from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastActive: string;
  role: string;
  isSystemAdmin?: boolean;
  plan: string;
  subscriptionStatus: string;
  workspaceId: string | null;
  postCount: number;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

const TIERS = ['basic', 'pro', 'business', 'enterprise'];

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [planChangeTarget, setPlanChangeTarget] = useState<{ user: AdminUser, tier: string } | null>(null);
  const [planEndDate, setPlanEndDate] = useState<string>(''); 
  const [planIsUnlimited, setPlanIsUnlimited] = useState<boolean>(false);
  const toast = useToast();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      const res = await api.admin.getUsers(params);
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleStatusChange(userId: string, action: 'suspend' | 'enable') {
    setActionLoading(userId);
    try {
      await api.admin.updateUserStatus(userId, action);
      toast.success('Success', `User ${action === 'suspend' ? 'suspended' : 'enabled'}`);
      await loadUsers();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  function handlePlanSelection(user: AdminUser, tier: string) {
    setPlanChangeTarget({ user, tier });
    
    // Default to existing end date, or 30 days from now if not basic
    if (tier !== 'basic') {
      if (user.currentPeriodEnd && tier === user.plan) {
        setPlanEndDate(new Date(user.currentPeriodEnd).toISOString().split('T')[0]);
        setPlanIsUnlimited(false);
      } else {
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        setPlanEndDate(nextMonth.toISOString().split('T')[0]);
        setPlanIsUnlimited(false);
      }
    } else {
      setPlanEndDate('');
      setPlanIsUnlimited(true);
    }
  }

  async function confirmPlanChange() {
    if (!planChangeTarget) return;
    const { user, tier } = planChangeTarget;
    setActionLoading(user.id);
    try {
      const finalEndDate = planIsUnlimited ? 'unlimited' : new Date(planEndDate).toISOString();
      await api.admin.updateUserPlan(user.id, tier, finalEndDate);
      toast.success('Success', `User plan updated to ${tier}`);
      await loadUsers();
      setPlanChangeTarget(null);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Plan change failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setActionLoading(userId);
    try {
      await api.admin.updateUserRole(userId, newRole);
      toast.success('Success', `User role updated to ${newRole}`);
      await loadUsers();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Role change failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || !deletePassword.trim()) return;
    setDeleteLoading(true);
    try {
      await api.admin.deleteUser(deleteTarget.id, deletePassword);
      toast.success('Deleted', `${deleteTarget.name} has been removed`);
      setDeleteTarget(null);
      setDeletePassword('');
      await loadUsers();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
    if (status === 'active') return 'success';
    if (status === 'trialing' || status === 'past_due') return 'warning';
    if (status === 'suspended' || status === 'canceled') return 'danger';
    return 'default';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">User Management</h1>
        <p className="text-sm text-neutral-400 mt-1">View and manage all registered users.</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-200 placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>
        <Badge variant="default" className="bg-neutral-100 dark:bg-neutral-800 text-neutral-300 self-center">
          {total} users
        </Badge>
      </div>

      {/* Users Table */}
      <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">End Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Posts</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">No users found.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-100 dark:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-200">{user.name}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.trialEndsAt && new Date(user.trialEndsAt) > new Date() && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              ?? Trial ends {new Date(user.trialEndsAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isSystemAdmin ? 'brand' : 'default'} className="text-xs">
                        {user.isSystemAdmin ? 'System Admin' : 'User'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={user.plan}
                          onChange={(e) => handlePlanSelection(user, e.target.value)}
                          disabled={actionLoading === user.id}
                          className="text-xs px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handlePlanSelection(user, user.plan)}
                          className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                          title="Edit Plan Details"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(user.subscriptionStatus)}>
                        {user.subscriptionStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.plan === 'basic' ? (
                        <span className="text-xs text-neutral-600">?</span>
                      ) : user.isSystemAdmin ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">?? Unlimited</span>
                      ) : user.currentPeriodEnd ? (
                        new Date(user.currentPeriodEnd) < new Date() ? (
                          <button
                            onClick={() => handlePlanSelection(user, user.plan)}
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 hover:opacity-80 transition-opacity cursor-pointer"
                            title="Expired ? click to extend"
                          >
                            ? Expired
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePlanSelection(user, user.plan)}
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-500 transition-colors cursor-pointer flex items-center gap-1"
                            title="Click to edit expiration date"
                          >
                            <Calendar className="w-3 h-3" />
                            {new Date(user.currentPeriodEnd).toLocaleDateString()}
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">?? Unlimited</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400">{user.postCount}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.isSystemAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRoleChange(user.id, 'viewer')}
                            loading={actionLoading === user.id}
                            className="text-amber-400 hover:bg-amber-500/10"
                            title="Demote to regular user"
                          >
                            <ArrowDownCircle className="w-4 h-4" /> Make User
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRoleChange(user.id, 'owner')}
                            loading={actionLoading === user.id}
                            className="text-blue-400 hover:bg-blue-500/10"
                            title="Promote to admin"
                          >
                            <ArrowUpCircle className="w-4 h-4" /> Make Admin
                          </Button>
                        )}
                        {user.subscriptionStatus === 'suspended' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(user.id, 'enable')}
                            loading={actionLoading === user.id}
                            className="text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <Shield className="w-4 h-4" /> Enable
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(user.id, 'suspend')}
                            loading={actionLoading === user.id}
                            className="text-red-400 hover:bg-red-500/10"
                          >
                            <ShieldOff className="w-4 h-4" /> Suspend
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setDeleteTarget(user); setDeletePassword(''); }}
                          className="text-red-500 hover:bg-red-500/10"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1} className="text-neutral-400">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="text-neutral-400">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Delete User</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-neutral-500 hover:text-neutral-900 dark:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-400 mb-1">
              You are about to permanently delete <span className="text-neutral-900 dark:text-white font-medium">{deleteTarget.name}</span> ({deleteTarget.email}).
            </p>
            {deleteTarget.isSystemAdmin && (
              <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-3 mt-2">
                ? This user is an admin. You can only delete them if at least one other admin exists.
              </p>
            )}
            <p className="text-sm text-neutral-400 mb-4 mt-2">Enter your admin password to confirm:</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDeleteConfirm()}
              placeholder="Your password"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-200 placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 mb-4"
            />
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 text-neutral-400" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700 text-neutral-900 dark:text-white"
                loading={deleteLoading}
                disabled={!deletePassword.trim()}
                onClick={handleDeleteConfirm}
              >
                <Trash2 className="w-4 h-4" /> Delete User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plan change modal */}
      {planChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Update Plan for {planChangeTarget.user.name}</h3>
              <button onClick={() => setPlanChangeTarget(null)} className="text-neutral-500 hover:text-neutral-900 dark:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-400 mb-4">
              You are changing the plan from <span className="font-bold text-neutral-900 dark:text-white">{planChangeTarget.user.plan}</span> to <span className="font-bold text-neutral-900 dark:text-white">{planChangeTarget.tier}</span>.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-300 mb-2">Subscription End Date</label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="unlimitedPlan"
                  checked={planIsUnlimited}
                  onChange={(e) => setPlanIsUnlimited(e.target.checked)}
                  className="w-4 h-4 bg-neutral-100 dark:bg-neutral-800 border-neutral-600 rounded text-red-500 focus:ring-red-500"
                />
                <label htmlFor="unlimitedPlan" className="text-sm text-neutral-400">Unlimited (No expiration)</label>
              </div>
              
              {!planIsUnlimited && (
                <input
                  type="date"
                  value={planEndDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setPlanEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 [color-scheme:dark]"
                />
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 text-neutral-400" onClick={() => setPlanChangeTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700 text-neutral-900 dark:text-white"
                loading={actionLoading === planChangeTarget.user.id}
                disabled={!planIsUnlimited && !planEndDate}
                onClick={confirmPlanChange}
              >
                Confirm Upgrade
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
