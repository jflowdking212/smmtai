import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  MessageCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  LogOut,
  Sparkles,
  Monitor,
  User,
} from 'lucide-react';

const adminNavigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Plans', href: '/admin/plans', icon: CreditCard },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Messages', href: '/admin/messages', icon: MessageCircle },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout: clearAuth } = useAuthStore();
  const { settings: siteSettings } = useSiteSettings();

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
    <div className="min-h-screen bg-neutral-900">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-neutral-950 border-r border-neutral-800 flex flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            {siteSettings.site_logo ? (
              <img src={siteSettings.site_logo} alt="" className="w-8 h-8 object-contain rounded-lg" />
            ) : (
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-heading font-bold text-sm text-white">
                  {siteSettings.site_title || 'EE PostMind'}
                </span>
                <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Admin Panel</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {adminNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-red-600/10 text-red-400 border border-red-600/20'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Mode toggle + logout */}
        <div className="py-4 px-3 space-y-1 border-t border-neutral-800">
          <button
            onClick={() => navigate('/dashboard')}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all duration-200',
              collapsed && 'justify-center px-0',
            )}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>User Mode</span>}
          </button>
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-red-600/10 transition-all duration-200',
              collapsed && 'justify-center px-0',
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full h-10 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-all duration-200"
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
        <header className="sticky top-0 z-30 h-16 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-neutral-400 hover:bg-neutral-800"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">Admin Mode</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl text-neutral-400 hover:bg-neutral-800 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <Avatar name={user?.name || 'Admin'} src={user?.avatar} size="sm" />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
