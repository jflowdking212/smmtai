import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { api } from '@/lib/api';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import type { AppFeature } from '@ee-postmind/shared';
import {
  LayoutDashboard,
  PenSquare,
  History,
  Calendar,
  BarChart3,
  Link2,
  MessageCircle,
  MessageSquare,
  Palette,
  Sparkles,
  Settings,
  CreditCard,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  Search,
  LogOut,
  HelpCircle,
  Lock,
  Monitor,
} from 'lucide-react';

const navigation: { name: string; href: string; icon: typeof LayoutDashboard; feature: AppFeature }[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { name: 'Compose', href: '/compose', icon: PenSquare, feature: 'compose' },
  { name: 'Post History', href: '/posts', icon: History, feature: 'post_history' },
  { name: 'Calendar', href: '/calendar', icon: Calendar, feature: 'calendar' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, feature: 'analytics' },
  { name: 'Connections', href: '/connections', icon: Link2, feature: 'connections' },
  { name: 'Entrepreneurs', href: '/entrepreneurs', icon: Users, feature: 'connections' },
  { name: 'Inbox', href: '/inbox', icon: MessageCircle, feature: 'connections' },
  { name: 'Comments', href: '/comments', icon: MessageSquare, feature: 'connections' },
  { name: 'Templates', href: '/templates', icon: Palette, feature: 'templates' },
  { name: 'AI Assistant', href: '/ai', icon: Sparkles, feature: 'ai_assistant' },
];

const bottomNav: { name: string; href: string; icon: typeof Users; feature: AppFeature; ownerOnly?: boolean }[] = [
  { name: 'Team', href: '/team', icon: Users, feature: 'team' },
  { name: 'Billing', href: '/billing', icon: CreditCard, feature: 'billing' },
  { name: 'Help', href: '/help', icon: HelpCircle, feature: 'billing' },
  { name: 'Settings', href: '/settings', icon: Settings, feature: 'settings' },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { user, role, logout: clearAuth } = useAuthStore();
  const { settings: siteSettings } = useSiteSettings();
  const { canAccess } = useSubscription();
  const isOwner = role === 'owner';

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      // logout anyway
    }
    clearAuth();
    navigate('/auth/login');
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-white border-r border-neutral-200/60 flex flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            {siteSettings.site_logo ? (
              <img src={siteSettings.site_logo} alt="" className="w-8 h-8 object-contain rounded-lg" />
            ) : (
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            {!collapsed && (
              <span className="font-heading font-bold text-lg text-neutral-900">
                {siteSettings.site_title || 'SmmtAI'}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const accessible = canAccess(item.feature);
            return (
              <NavLink
                key={item.name}
                to={accessible ? item.href : '/billing'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    !accessible
                      ? 'text-neutral-300 cursor-default'
                      : isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                {accessible ? (
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 flex-shrink-0" />
                )}
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div className="py-4 px-3 space-y-1 border-t border-neutral-100">
          {bottomNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
        </div>

        {/* Collapse toggle */}
        <div className="px-3 mb-3 space-y-1">
          {isOwner && (
            <button
              onClick={() => navigate('/admin/dashboard')}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border border-amber-200 transition-all duration-200',
                collapsed && 'justify-center px-0',
              )}
            >
              <Monitor className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Admin Panel</span>}
            </button>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200',
              collapsed && 'justify-center px-0',
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full h-10 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-all duration-200"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-300',
          collapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]',
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-neutral-500 hover:bg-neutral-100"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 text-neutral-400 w-80">
              <Search className="w-4 h-4" />
              <span className="text-sm">Search posts, templates...</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
            </button>
            <Avatar name={user?.name || 'User'} src={user?.avatar} size="sm" />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Feedback widget */}
      {/* <FeedbackWidget /> */}
    </div>
  );
}
