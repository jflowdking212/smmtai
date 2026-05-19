import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Footer } from '@/components/Footer';
import { Sparkles, ArrowLeft, FileText, Shield, Cookie } from 'lucide-react';

interface LegalPageLayoutProps {
  title: string;
  subtitle: string;
  icon: 'terms' | 'privacy' | 'cookies';
  lastUpdated: string;
  children: React.ReactNode;
}

const ICONS = {
  terms: FileText,
  privacy: Shield,
  cookies: Cookie,
};

const GRADIENTS = {
  terms: 'from-blue-600 via-indigo-600 to-purple-700',
  privacy: 'from-emerald-600 via-teal-600 to-cyan-700',
  cookies: 'from-amber-500 via-orange-500 to-red-600',
};

const ACCENTS = {
  terms: 'blue',
  privacy: 'emerald',
  cookies: 'amber',
};

const RELATED_PAGES = [
  { label: 'Privacy Policy', href: '/privacy', icon: 'privacy' as const },
  { label: 'Terms & Conditions', href: '/terms', icon: 'terms' as const },
  { label: 'Cookie Policy', href: '/cookies', icon: 'cookies' as const },
];

export function LegalPageLayout({ title, subtitle, icon, lastUpdated, children }: LegalPageLayoutProps) {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'SmmtAI';
  const Icon = ICONS[icon];
  const gradient = GRADIENTS[icon];
  const accent = ACCENTS[icon];
  const relatedPages = RELATED_PAGES.filter((p) => p.icon !== icon);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero header */}
      <div className={`bg-gradient-to-br ${gradient} relative overflow-hidden`}>
        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-white/3 rounded-full blur-xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-16 relative z-10">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm"
            >
              {settings.site_logo ? (
                <img src={settings.site_logo} alt={siteName} className="w-6 h-6 object-contain rounded" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              <span className="font-medium">{siteName}</span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>

          {/* Title block */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">{title}</h1>
              <p className="text-white/70 mt-2 text-sm sm:text-base">{subtitle}</p>
              <p className="text-white/50 text-xs mt-3">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>

        {/* Curved bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 40V20C360 0 720 0 1080 20C1260 30 1380 35 1440 38V40H0Z" fill="#FAFAFA" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-2 pb-16">
        <div className="space-y-5">
          {children}
        </div>

        {/* Related pages */}
        <div className="mt-16 pt-8 border-t border-neutral-200">
          <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Related Policies</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedPages.map((page) => {
              const PageIcon = ICONS[page.icon];
              const pageGradient = GRADIENTS[page.icon];
              return (
                <Link
                  key={page.href}
                  to={page.href}
                  className="group flex items-center gap-3 p-4 rounded-xl border border-neutral-200 bg-white hover:shadow-md hover:border-neutral-300 transition-all"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pageGradient} flex items-center justify-center shrink-0`}>
                    <PageIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800 group-hover:text-neutral-900">{page.label}</p>
                    <p className="text-xs text-neutral-400">Read our {page.label.toLowerCase()}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Company info */}
        <div className="mt-10 text-center">
          <p className="text-xs text-neutral-400">
            EntreprenrEducation (Private Limited) · Registered in the United Kingdom ·{' '}
            <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

/* Reusable styled section card */
export function LegalSection({
  number,
  title,
  icon,
  children,
}: {
  number: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 bg-neutral-50/80 border-b border-neutral-100">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
            {icon}
          </div>
        )}
        <h2 className="text-base font-semibold text-neutral-900">
          <span className="text-neutral-400 font-normal mr-1.5">{number}.</span>
          {title}
        </h2>
      </div>
      <div className="px-6 py-5 space-y-3 text-sm text-neutral-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
