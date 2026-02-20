import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { DashboardPage } from '@/pages/DashboardPage';
import { ComposePage } from '@/pages/ComposePage';
import { CalendarPage } from '@/pages/CalendarPage';
import { PostHistoryPage } from '@/pages/PostHistoryPage';
import { ConnectionsPage } from '@/pages/ConnectionsPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { AIPage } from '@/pages/AIPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BillingPage } from '@/pages/BillingPage';
import { HelpPage } from '@/pages/HelpPage';
import { ConversationsPage } from '@/pages/ConversationsPage';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { LandingPage } from '@/pages/LandingPage';
import { TermsPage } from '@/pages/TermsPage';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';
import { CookiePolicyPage } from '@/pages/CookiePolicyPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { CheckoutSuccessPage } from '@/pages/CheckoutSuccessPage';
import { UpgradeGate } from '@/components/UpgradeGate';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminPlansPage } from '@/pages/admin/AdminPlansPage';
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage';
import { AdminMessagesPage } from '@/pages/admin/AdminMessagesPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';

// Lazy-load heavy pages
const EditorPage = lazy(() => import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function HomePage() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <LandingPage />;
  return <Navigate to="/dashboard" replace />;
}

function SiteHead() {
  const { settings } = useSiteSettings();
  useEffect(() => {
    if (settings.site_favicon) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.site_favicon;
    }
    if (settings.seo_meta_title || settings.site_title) {
      document.title = settings.seo_meta_title || settings.site_title;
    }
    if (settings.seo_meta_description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = settings.seo_meta_description;
    }
  }, [settings]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <SiteHead />
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Routes>
           {/* Public routes */}
           <Route path="/" element={<HomePage />} />
           <Route path="/terms" element={<TermsPage />} />
           <Route path="/privacy" element={<PrivacyPolicyPage />} />
           <Route path="/cookies" element={<CookiePolicyPage />} />
           <Route path="/checkout" element={<CheckoutPage />} />
           <Route path="/checkout/success" element={<CheckoutSuccessPage />} />

           {/* Public auth routes */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/oauth/callback" element={<OAuthCallbackPage />} />

          {/* Protected app routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/posts" element={<PostHistoryPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/analytics" element={<UpgradeGate feature="analytics"><Suspense fallback={<div className="p-8 text-center text-neutral-400">Loading analytics...</div>}><AnalyticsPage /></Suspense></UpgradeGate>} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/editor" element={<Suspense fallback={<div className="p-8 text-center text-neutral-400">Loading editor...</div>}><EditorPage /></Suspense>} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/team" element={<UpgradeGate feature="team"><SettingsPage /></UpgradeGate>} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/help" element={<HelpPage />} />
          </Route>

          {/* Admin routes — separate layout */}
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/plans" element={<AdminPlansPage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/messages" element={<AdminMessagesPage />} />
            <Route path="/admin/conversations" element={<ConversationsPage />} />
            <Route path="/admin/knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
              </Routes>
            </BrowserRouter>
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
