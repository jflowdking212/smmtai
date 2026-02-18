import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';
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
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage';

// Lazy-load heavy pages
const EditorPage = lazy(() => import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Routes>
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/posts" element={<PostHistoryPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/analytics" element={<Suspense fallback={<div className="p-8 text-center text-neutral-400">Loading analytics...</div>}><AnalyticsPage /></Suspense>} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/editor" element={<Suspense fallback={<div className="p-8 text-center text-neutral-400">Loading editor...</div>}><EditorPage /></Suspense>} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/team" element={<SettingsPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/help" element={<HelpPage />} />
          </Route>
              </Routes>
            </BrowserRouter>
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
