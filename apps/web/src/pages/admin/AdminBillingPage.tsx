import { useCallback, useEffect, useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Wallet,
  Users,
  CalendarClock,
  CreditCard,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';

interface BillingStats {
  mrr: number;
  totalSubs: number;
  activeCount: number;
  trialingCount: number;
  canceledCount: number;
  invoices: any[];
  subscriptions: any[];
}

const EMPTY_STATS: BillingStats = {
  mrr: 0,
  totalSubs: 0,
  activeCount: 0,
  trialingCount: 0,
  canceledCount: 0,
  invoices: [],
  subscriptions: [],
};

export function AdminBillingPage() {
  const [stats, setStats] = useState<BillingStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const toast = useToast();

  const loadStats = useCallback(async () => {
    try {
      const res = await api.admin.getBillingStats();
      setStats(res.data);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Failed to load billing statistics');
    }
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats().finally(() => setRefreshing(false));
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setActionLoading(cancelTarget.stripeSubscriptionId);
    try {
      await api.admin.adminCancelSubscription(cancelTarget.stripeSubscriptionId);
      toast.success('Success', `Auto-renewal disabled for workspace "${cancelTarget.workspaceName}"`);
      setCancelTarget(null);
      await loadStats();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter subscriptions based on search query
  const filteredSubs = stats.subscriptions.filter(
    (sub) =>
      sub.workspaceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statCards = [
    {
      label: 'Monthly Recurring Revenue',
      value: `$${stats.mrr.toLocaleString()}`,
      icon: Wallet,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Paid Subscribers',
      value: stats.activeCount,
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Active Free Trials',
      value: stats.trialingCount,
      icon: CalendarClock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Canceled / Churned',
      value: stats.canceledCount,
      icon: CreditCard,
      color: 'text-neutral-400',
      bg: 'bg-neutral-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Payments & Billing</h1>
          <p className="text-sm text-neutral-400 mt-1">Manage subscriptions, track revenue, and monitor transactions.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={refreshing}
          onClick={handleRefresh}
          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-5 bg-neutral-900 border-neutral-800">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <Badge variant="default" className="bg-neutral-800 text-neutral-300">Live</Badge>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-white">{loading ? '—' : stat.value}</p>
              <p className="text-sm text-neutral-400 mt-0.5">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Subscriptions Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-400" />
            Workspace Subscriptions
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by workspace, owner, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-200 placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>

        <Card className="bg-neutral-900 border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-850">
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Workspace</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Owner</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Tier</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">End Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Loading subscriptions...</td></tr>
                ) : filteredSubs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No subscriptions found.</td></tr>
                ) : (
                  filteredSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-neutral-200">{sub.workspaceName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-200">{sub.ownerName}</p>
                          <p className="text-xs text-neutral-500">{sub.ownerEmail}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="brand" className="capitalize text-xs font-medium">
                          {sub.tier}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            sub.status === 'active'
                              ? 'success'
                              : sub.status === 'trialing'
                                ? 'warning'
                                : 'danger'
                          }
                          className="capitalize text-xs font-medium"
                        >
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-400">
                        {sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                          : 'N/A'}
                        {sub.cancelAtPeriodEnd && (
                          <span className="block text-[10px] text-red-400 font-semibold mt-0.5">🛑 Canceling</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sub.stripeSubscriptionId && !sub.cancelAtPeriodEnd && sub.status !== 'canceled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={actionLoading === sub.stripeSubscriptionId}
                            onClick={() => setCancelTarget(sub)}
                            className="text-red-400 hover:bg-red-500/10 text-xs py-1"
                          >
                            Cancel Sub
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Transactions Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-neutral-400" />
          Recent Stripe Payments Ledger
        </h2>

        <Card className="bg-neutral-900 border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-850">
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Invoice No.</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Amount Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Billing Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Loading ledger...</td></tr>
                ) : stats.invoices.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No payment invoices found.</td></tr>
                ) : (
                  stats.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-neutral-300">{inv.number}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-200">
                        {inv.customerEmail}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-400">
                        ${inv.amountPaid.toLocaleString()} {inv.currency}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={inv.status === 'paid' ? 'success' : 'danger'}
                          className="capitalize text-xs font-medium"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-400">
                        {new Date(inv.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Styled Admin Cancellation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Cancel Auto-Renewal
              </h3>
              <button
                onClick={() => setCancelTarget(null)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-300 mb-2">
              Are you sure you want to cancel the auto-renewal for the workspace{' '}
              <strong className="text-white">"{cancelTarget.workspaceName}"</strong>?
            </p>
            <p className="text-xs text-neutral-500 bg-neutral-800 p-3 rounded-lg border border-neutral-700 mb-5 leading-relaxed">
              This will set the subscription's auto-renewal flag to off in Stripe. The owner ({cancelTarget.ownerName}) will continue to enjoy paid features until their current period ends on <strong>{new Date(cancelTarget.currentPeriodEnd).toLocaleDateString()}</strong>, after which their access will expire.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 text-neutral-400 border-neutral-700"
                onClick={() => setCancelTarget(null)}
              >
                Go Back
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={handleCancelConfirm}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
