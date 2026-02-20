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
  plan: string;
  subscriptionStatus: string;
  workspaceId: string | null;
  postCount: number;
}

const TIERS = ['basic', 'pro', 'business', 'enterprise'];

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  async function handlePlanChange(userId: string, tier: string) {
    setActionLoading(userId);
    try {
      await api.admin.updateUserPlan(userId, tier);
      toast.success('Success', `User plan updated to ${tier}`);
      await loadUsers();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Plan change failed');
    } finally {
      setActionLoading(null);
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
        <h1 className="text-2xl font-heading font-bold text-white">User Management</h1>
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-200 placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>
        <Badge variant="default" className="bg-neutral-800 text-neutral-300 self-center">
          {total} users
        </Badge>
      </div>

      {/* Users Table */}
      <Card className="bg-neutral-900 border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Posts</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No users found.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-200">{user.name}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.plan}
                        onChange={(e) => handlePlanChange(user.id, e.target.value)}
                        disabled={actionLoading === user.id}
                        className="text-xs px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        {TIERS.map((t) => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(user.subscriptionStatus)}>
                        {user.subscriptionStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400">{user.postCount}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
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
    </div>
  );
}
