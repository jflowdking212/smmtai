import React from 'react';
import { Link } from 'react-router-dom';
import { PLATFORMS, SUBSCRIPTION_LIMITS } from '@ee-postmind/shared';
import { useState } from 'react';
import { Footer } from '@/components/Footer';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useTheme } from '@/components/ThemeProvider';
import { api } from '@/lib/api';
import { useEffect } from 'react';
import {
  Sparkles, ArrowRight, Check, Zap, CreditCard, Building2, Crown,
  PenSquare, Calendar, BarChart3, Palette, Link2, Bot, Shield, Globe, Users,
  Sun, Moon,
} from 'lucide-react';

const DEFAULT_PRICES: Record<string, number> = { Basic: 5, Pro: 19, Business: 49, Enterprise: 99 };
const DEFAULT_YEARLY_DISCOUNT = 30;
const TIER_MAP: Record<string, string> = { Basic: 'basic', Pro: 'pro', Business: 'business', Enterprise: 'enterprise' };

const plans = [
  {
    name: 'Basic', monthlyPrice: 5, description: 'Get started with the basics', icon: Zap, popular: false,
    platforms: ['Entreprenrs', 'Chrxstians', 'Iohah', 'Facebook'],
    features: ['4 social accounts', '30 posts/month', '5 AI generations', '10 templates/month', '1 team member', '7-day analytics'],
  },
  {
    name: 'Pro', monthlyPrice: 19, description: 'For growing creators & teams', icon: CreditCard, popular: true,
    platforms: ['Everything in Basic', 'Instagram', 'X (Twitter)', 'YouTube', 'Pinterest'],
    features: ['8 social accounts', '200 posts/month', '100 AI generations', '50 templates/month', '5 team members', '30-day analytics'],
  },
  {
    name: 'Business', monthlyPrice: 49, description: 'For agencies & larger teams', icon: Building2, popular: false,
    platforms: ['Everything in Pro', 'TikTok', 'LinkedIn', 'Bluesky', 'Mastodon', 'Telegram'],
    features: ['25 social accounts', 'Unlimited posts', '500 AI generations', 'Unlimited templates', '10 team members', '90-day analytics'],
  },
  {
    name: 'Enterprise', monthlyPrice: 0, description: 'Dedicated support & custom limits', icon: Crown, popular: false,
    platforms: ['All 25 platforms'],
    features: ['Unlimited accounts', 'Unlimited posts', 'Unlimited AI', 'Unlimited templates', '20 team members', 'Full analytics history', 'Dedicated support', 'Custom integrations'],
  },
];

const features = [
  { icon: PenSquare, title: 'AI Content Creation', description: 'Generate captions, hashtags, and full posts with AI tailored to each platform.' },
  { icon: Palette, title: 'Visual Design Editor', description: 'Create stunning graphics with our built-in design editor — no design skills needed.' },
  { icon: Calendar, title: 'Smart Scheduling', description: 'Plan and schedule posts across all platforms with an intuitive calendar view.' },
  { icon: Link2, title: 'Multi-Platform Publishing', description: 'Publish to Facebook, Instagram, TikTok, LinkedIn, Twitter, YouTube, and more.' },
  { icon: BarChart3, title: 'Analytics Dashboard', description: 'Track performance, engagement, and growth across all your social channels.' },
  { icon: Bot, title: 'AI Assistant', description: 'Get AI-powered suggestions for best posting times, trending topics, and compliance checks.' },
  { icon: Users, title: 'Team Collaboration', description: 'Invite team members, assign roles, and manage approvals for content workflows.' },
  { icon: Shield, title: 'Secure & Reliable', description: 'Enterprise-grade security with encrypted connections and data protection.' },
  { icon: Globe, title: 'Global Reach', description: 'Support for multiple languages, timezones, and international social platforms.' },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-all duration-200 hover:scale-105 active:scale-95"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-blue-500" />
      )}
    </button>
  );
}

function PricingSection({ planConfig }: { planConfig: Record<string, any> }) {
  const [sliderIndex, setSliderIndex] = useState(0); // 0 = Monthly, 1 = Quarterly, 2 = 6 Months, 3 = Yearly

  const qDiscount = planConfig?.quarterlyDiscount ?? 5;
  const sDiscount = planConfig?.sixMonthDiscount ?? 15;
  const yDiscount = planConfig?.yearlyDiscount ?? 30;
  const PERIODS_INFO = [
    { id: 'monthly',   label: 'Monthly',   months: 1,  discount: 0,         saveText: '' } as const,
    { id: 'quarterly', label: 'Quarterly', months: 3,  discount: qDiscount, saveText: `Save ${qDiscount}%` } as const,
    { id: '6month',    label: '6 Months',  months: 6,  discount: sDiscount, saveText: `Save ${sDiscount}%` } as const,
    { id: 'yearly',    label: 'Yearly',    months: 12, discount: yDiscount, saveText: `Save ${yDiscount}%` } as const,
  ];

  const selectedPeriod = PERIODS_INFO[sliderIndex].id;

  function getMonthlyPrice(planName: string): number {
    const tier = TIER_MAP[planName];
    const rawPrice = planConfig?.[tier]?.monthlyPrice ?? planConfig?.pricing?.[tier]?.monthlyPrice;
    if (rawPrice === '__INFINITY__') return Infinity;
    if (rawPrice != null) return rawPrice as number;
    return DEFAULT_PRICES[planName];
  }

  function formatSliderPrice(baseMonthlyPrice: number, index: number) {
    if (baseMonthlyPrice === 0) return { display: '$0', period: '/forever', billingText: 'Free forever' };
    
    const info = PERIODS_INFO[index];
    const discountedMonthly = +(baseMonthlyPrice * (1 - info.discount / 100)).toFixed(2);
    const totalBilled = +(discountedMonthly * info.months).toFixed(2);
    
    const fmt = (val: number) => Number.isInteger(val) ? val.toString() : val.toFixed(2);
    
    let billingText = 'Billed monthly';
    if (info.months === 3) {
      billingText = `Billed $${fmt(totalBilled)} every 3 months`;
    } else if (info.months === 6) {
      billingText = `Billed $${fmt(totalBilled)} every 6 months`;
    } else if (info.months === 12) {
      billingText = `Billed $${fmt(totalBilled)} yearly`;
    }
    
    return {
      display: `$${fmt(discountedMonthly)}`,
      period: '/month',
      billingText,
      originalMonthly: info.discount > 0 ? `$${baseMonthlyPrice}/month` : undefined
    };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900 dark:text-white">Simple, transparent pricing</h2>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">Choose the perfect plan with flexible billing intervals.</p>
      </div>

      {/* Dynamic Range Slider Control */}
      <div className="max-w-xl mx-auto mb-16 bg-neutral-50 dark:bg-white/5 rounded-2xl p-6 border border-neutral-200/50 dark:border-white/10 shadow-sm">
        <div className="flex justify-between mb-4 text-xs font-semibold tracking-wider uppercase text-neutral-500 dark:text-neutral-400">
          <span>Choose billing period</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold">
            {PERIODS_INFO[sliderIndex].discount > 0 ? `${PERIODS_INFO[sliderIndex].saveText} Activated` : 'Standard Rate'}
          </span>
        </div>
        
        <div className="relative mt-4">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={sliderIndex}
            onChange={(e) => setSliderIndex(parseInt(e.target.value))}
            className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
          />
          
          <div className="flex justify-between mt-5">
            {PERIODS_INFO.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSliderIndex(idx)}
                className={`flex flex-col items-center transition-all ${
                  sliderIndex === idx 
                    ? 'text-blue-600 dark:text-blue-400 font-bold scale-105' 
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs font-medium'
                }`}
              >
                <span className="text-sm">{item.label}</span>
                {item.discount > 0 && (
                  <span className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 font-semibold">
                    -{item.discount}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {plans.map((plan) => {
          const monthlyPrice = getMonthlyPrice(plan.name);
          const price = formatSliderPrice(monthlyPrice, sliderIndex);
          const tier = TIER_MAP[plan.name] || '';
          const planPlatforms: string[] = (() => {
            const adminPlatforms = planConfig?.[tier]?.platforms;
            if (Array.isArray(adminPlatforms) && adminPlatforms.length > 0) return adminPlatforms;
            return plan.platforms;
          })();

          const adminPrice = planConfig?.[tier]?.monthlyPrice ?? planConfig?.pricing?.[tier]?.monthlyPrice;
          // Custom only when admin explicitly sets Enterprise to $0. Undefined = use $99 default.
          const isCustom = plan.name === 'Enterprise' && adminPrice === 0;

          const planDescription = (planConfig as any)?.[tier]?.description || plan.description;
          const selectedPriceKey = tier ? `${tier}_${selectedPeriod}` : '';

          const href = isCustom 
            ? '#contact' 
            : `/checkout?priceKey=${encodeURIComponent(selectedPriceKey)}`;

          const label = isCustom 
            ? 'Contact Sales' 
            : `Start ${plan.name} Plan`;

          // Dynamically compute the features array from the admin entries
          const planFeatures = (() => {
            const overrides = planConfig?.[tier];
            if (!overrides) return plan.features;
            
            const formatVal = (val: unknown) => (val == null || val === Infinity || val === '__INFINITY__' || val === 'Infinity' || (typeof val === 'number' && val < 0)) ? 'Unlimited' : val;
            
            return [
              `${formatVal(overrides.socialAccounts)} social accounts`,
              `${formatVal(overrides.postsPerMonth)} posts/month`,
              `${formatVal(overrides.aiGenerationsPerMonth)} AI generations`,
              `${formatVal(overrides.templatesPerMonth)} templates/month`,
              `${formatVal(overrides.teamMembers)} team member${(overrides.teamMembers == null || overrides.teamMembers > 1) ? 's' : ''}`,
              `${(overrides.analyticsDays == null || overrides.analyticsDays === '__INFINITY__' || overrides.analyticsDays === Infinity || overrides.analyticsDays === 'Infinity' || overrides.analyticsDays < 0) ? 'Full' : `${overrides.analyticsDays}-day`} analytics`,
            ];
          })();

          const className = `block w-full text-center py-2.5 rounded-lg font-medium text-sm transition-all ${
            plan.popular
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/20'
              : 'bg-neutral-100 dark:bg-white/8 hover:bg-neutral-200 dark:hover:bg-white/12 text-neutral-800 dark:text-neutral-200'
          }`;

          return (
            <div key={plan.name}
              className={`relative rounded-2xl p-6 sm:p-8 border-2 transition-all hover:shadow-xl ${
                plan.popular
                  ? 'border-blue-600 shadow-lg shadow-blue-600/20 bg-white dark:bg-[#1a1f3c]'
                  : 'border-neutral-100 dark:border-white/10 bg-white dark:bg-[#141420] hover:border-blue-200 dark:hover:border-blue-500/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full shadow-lg shadow-blue-600/30">
                  Most Popular
                </div>
              )}
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                <plan.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{plan.name}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{planDescription}</p>
              
              <div className="mt-4 mb-2">
                {isCustom ? (
                  <span className="text-4xl font-bold text-neutral-900 dark:text-white">Custom</span>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold text-neutral-900 dark:text-white">{price.display}</span>
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">{price.period}</span>
                    </div>
                    {price.originalMonthly && (
                      <span className="block text-xs text-neutral-400 dark:text-neutral-500 line-through mt-0.5">{price.originalMonthly}</span>
                    )}
                    <span className="block text-xs text-neutral-400 dark:text-neutral-500 mt-1 font-medium">{price.billingText}</span>
                  </>
                )}
              </div>

              {/* Platform badges */}
              <div className="flex flex-wrap gap-1 mb-4 mt-3">
                {planPlatforms.map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-neutral-300">
                    {(PLATFORMS as Record<string, {name?: string}>)[p]?.name ?? p}
                  </span>
                ))}
              </div>

              <ul className="space-y-3 mb-8 mt-4">
                {planFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              
              {isCustom ? (
                <a href="#contact" className={className}>
                  {label}
                </a>
              ) : (
                <Link to={href} className={className}>
                  {label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LandingPage() {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'SmmtAI';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    // Scroll to #pricing hash when navigating from another page
    if (window.location.hash === '#pricing') {
      const tryScroll = () => {
        const el = document.getElementById('pricing');
        if (el) { el.scrollIntoView({ behavior: 'smooth' }); return true; }
        return false;
      };
      if (!tryScroll()) setTimeout(tryScroll, 300);
    }
    // Fetch dynamic plan config from admin settings
    let active = true;
    api.site.getPublicPlans()
      .then((res) => { if (active) setPlanConfig(res.data || {}); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d0d18] transition-colors duration-300">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-[#0d0d18]/90 backdrop-blur-xl border-b border-neutral-100 dark:border-white/8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              {settings.site_logo ? (
                <img src={settings.site_logo} alt={siteName} className="w-8 h-8 object-contain" />
              ) : (
                <Sparkles className="w-7 h-7 text-blue-500" />
              )}
              <span className="text-xl font-bold font-heading text-neutral-900 dark:text-white">{siteName}</span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Pricing</a>
              <a href="#contact" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Contact</a>
            </div>

            {/* Desktop CTA + Theme Toggle */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <Link to="/auth/login" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors px-4 py-2">Log In</Link>
              <Link to="/auth/register?trial=pro&trial_days=14" className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg transition-all shadow-sm shadow-blue-600/20">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Mobile: Theme Toggle + Log In + Hamburger */}
            <div className="flex md:hidden items-center gap-1">
              <ThemeToggle />
              <Link to="/auth/login" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white px-3 py-2 rounded-lg transition-colors">
                Log In
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-neutral-100 dark:border-white/8 py-3 space-y-1">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors">Pricing</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors">Contact</a>
              <div className="pt-2 pb-1">
                <Link
                  to="/auth/register?trial=pro&trial_days=14"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-600/20"
                >
                  Start 14-Day Free Trial <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Light mode bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:hidden" />
        {/* Dark mode bg — deep space with glows */}
        <div className="absolute inset-0 hidden dark:block bg-[#0d0d18]">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-40 bg-blue-500/10 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-14 sm:py-24 lg:py-36">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 text-xs sm:text-sm font-medium mb-5 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" /> AI-Powered Social Media Management
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-heading text-neutral-900 dark:text-white leading-tight tracking-tight">
              Create, Schedule &amp; Publish <span className="text-blue-500 dark:text-blue-400">Everywhere</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-2xl mx-auto">
              {settings.site_tagline || 'SmmtAI helps you craft stunning content with AI, design eye-catching visuals, and publish to all your social platforms — all from one dashboard.'}
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link
                to="/auth/register?trial=pro&trial_days=14"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 text-sm sm:text-base"
              >
                Start 14-Day Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white dark:bg-white/8 hover:bg-neutral-50 dark:hover:bg-white/12 active:scale-95 text-neutral-700 dark:text-neutral-200 font-semibold rounded-xl transition-all border border-neutral-200 dark:border-white/10 text-sm sm:text-base backdrop-blur-sm"
              >
                See Features
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-400 dark:text-neutral-500">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> No upfront payment</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> 14-day Pro trial</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-500" /> Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-neutral-50 dark:bg-[#0a0a14] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900 dark:text-white">Everything you need to grow your social presence</h2>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">Powerful tools that save you time and help you create better content across every platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white dark:bg-[#14141f] rounded-2xl p-6 sm:p-8 border border-neutral-100 dark:border-white/8 hover:border-blue-200 dark:hover:border-blue-500/40 hover:shadow-lg dark:hover:shadow-blue-500/5 transition-all group">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 rounded-xl flex items-center justify-center mb-5 transition-colors">
                  <f.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Powerhouse Features Showcase */}
      <section className="py-20 sm:py-28 bg-white dark:bg-[#0d0d18] border-y border-neutral-100 dark:border-white/8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-3 border-none">Next-Gen Workspace</span>
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900 dark:text-white">Unleash the full power of SmmtAI</h2>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">Discover SmmtAI's newest advanced modules that turn social media management into a seamless, high-converting process.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
            {[
              {
                icon: Bot,
                title: 'Interactive AI Chat Assistant',
                description: 'Talk to your virtual AI marketing manager. Brainstorm campaign ideas, generate full captions, request compliance checks, and schedule your posts directly within our interactive chat workspace.'
              },
              {
                icon: PenSquare,
                title: 'AI Humanizer & Caption Rewriter',
                description: 'Banish robotic tones forever. Our intelligent humanizer rewrites and refines your text to sound completely natural, friendly, and authentic, boosting algorithmic reach and authentic reader engagement.'
              },
              {
                icon: Palette,
                title: 'Canvas Visual Design Studio',
                description: 'Craft beautiful graphics and visually engaging posts directly within SMMT. Enjoy full template layouts, drag-and-drop layers, visual filters, and a built-in instant background removal utility.'
              },
              {
                icon: Users,
                title: 'Workspace Collaboration & Approval Workflows',
                description: 'Manage distinct brands or client accounts in dedicated multi-tenant workspaces. Set up structured workflows with specialized roles (Owner, Manager, Reviewer) and a secure approval queue.'
              }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4 sm:gap-6 p-6 sm:p-8 rounded-2xl bg-neutral-50 dark:bg-[#141420] border border-neutral-100 dark:border-white/5 transition-all hover:border-blue-500/25">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28 bg-white dark:bg-[#0d0d18] transition-colors duration-300">
        <PricingSection planConfig={planConfig} />
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-700 dark:to-[#1a0a3a] relative overflow-hidden">
        <div className="absolute inset-0 hidden dark:block">
          <div className="absolute top-0 left-1/3 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white">Ready to supercharge your social media?</h2>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">Join thousands of creators and teams who use SmmtAI to save time, create better content, and grow their audience.</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth/register?trial=pro&trial_days=14" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white hover:bg-blue-50 text-blue-700 font-medium rounded-xl transition-all shadow-lg text-base">
              Start 14-Day Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/auth/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-white/30 hover:border-white/60 text-white font-medium rounded-xl transition-all text-base hover:bg-white/5">
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* Detailed Plan Comparison Table */}
      <section className="py-20 sm:py-28 bg-white dark:bg-[#0d0d18] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900 dark:text-white">Compare plans in detail</h2>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">Everything you need to know to make the best decision for your social growth.</p>
          </div>
          
          <div className="overflow-x-auto border border-neutral-100 dark:border-white/10 rounded-2xl shadow-sm bg-neutral-50/50 dark:bg-[#141420]/50 backdrop-blur-sm">
            {/* ── Dynamic Compare Table (reads planConfig) ── */}
            {(() => {
              const TIERS = ['basic', 'pro', 'business', 'enterprise'] as const;
              const gl = (t: string, k: string): string => {
                const v = (planConfig as any)?.[t]?.[k] ?? (planConfig as any)?.pricing?.[t]?.[k] ?? (SUBSCRIPTION_LIMITS as any)?.[t]?.[k];
                if (v == null || v === Infinity || v === '__INFINITY__') return 'Unlimited';
                if (k === 'analyticsDays') return v === 0 ? 'Full' : v + ' days';
                return typeof v === 'number' ? v.toLocaleString() : String(v);
              };
              const fp = (t: string): string => {
                if (t === 'enterprise') {
                  const ep = (planConfig as any)?.enterprise?.monthlyPrice ?? (planConfig as any)?.pricing?.enterprise?.monthlyPrice;
                  if (ep === 0) return 'Custom';
                  return '$' + (ep ?? 99) + '/mo';
                }
                const p = (planConfig as any)?.[t]?.monthlyPrice ?? (planConfig as any)?.pricing?.[t]?.monthlyPrice ?? ({ basic: 5, pro: 19, business: 49 } as Record<string,number>)[t];
                return p != null ? ('$' + p + '/mo') : '—';
              };
              const gp = (t: string): string[] => {
                const a = (planConfig as any)?.[t]?.platforms;
                if (Array.isArray(a) && a.length) return a;
                const b = (planConfig as any)?.platforms?.[t];
                if (Array.isArray(b) && b.length) return b;
                if (typeof b === 'string' && b.trim()) return b.trim().split(/s+/);
                const d: Record<string,string[]> = {
                  basic:['entreprenrs','chrxstians','iohah','facebook'],
                  pro:['entreprenrs','chrxstians','iohah','facebook','instagram','twitter','youtube','pinterest'],
                  business:['entreprenrs','chrxstians','iohah','facebook','instagram','twitter','youtube','tiktok','linkedin','pinterest','bluesky','mastodon','telegram'],
                  enterprise:['entreprenrs','chrxstians','iohah','facebook','instagram','twitter','youtube','tiktok','linkedin','pinterest','bluesky','mastodon','telegram'],
                };
                return d[t] ?? [];
              };
              const Y = () => <Check className="w-4 h-4 mx-auto text-green-500" />;
              const N = () => <span className="text-neutral-400">—</span>;
              const rows: Array<{label:string; render:(t:string)=>React.ReactNode}> = [
                {label:'Price', render: t => fp(t)},
                {label:'Social Accounts', render: t => gl(t,'socialAccounts')},
                {label:'Posts / Month', render: t => gl(t,'postsPerMonth')},
                {label:'AI Generations / Month', render: t => gl(t,'aiGenerationsPerMonth')},
                {label:'Templates / Month', render: t => gl(t,'templatesPerMonth')},
                {label:'Team Members', render: t => gl(t,'teamMembers')},
                {label:'Analytics History', render: t => gl(t,'analyticsDays')},
                {label:'Platforms', render: t => (
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {gp(t).map(id => (PLATFORMS as Record<string,{name?:string}>)[id]?.name ?? id).join(', ')}
                  </span>
                )},
                {label:'Visual Design Studio', render: _t => <Y />},
                {label:'AI Humanizer & Rewriter', render: t => t==='basic' ? <N /> : <Y />},
                {label:'Workspace Roles', render: t => t==='basic' ? <N /> : <Y />},
                {label:'Approval Flows', render: t => t==='basic' ? <N /> : <Y />},
                {label:'Dedicated Support', render: t => t==='enterprise' ? <Y /> : <N />},
              ];
              return (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/3 text-[10px] uppercase tracking-widest text-neutral-500">
                      <th className="p-4 sm:p-5 font-semibold">Feature</th>
                      {TIERS.map(t => (
                        <th key={t} className={'p-4 sm:p-5 text-center font-semibold capitalize' + (t==='pro' ? ' text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-500/5' : '')}>
                          {t.charAt(0).toUpperCase()+t.slice(1)}
                          {t==='pro' && <span className="ml-1 px-1 py-0.5 bg-blue-600 text-white rounded text-[8px] align-middle">Popular</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm divide-y divide-neutral-100 dark:divide-white/8">
                    {rows.map(({label,render}) => (
                      <tr key={label} className="hover:bg-neutral-50/50 dark:hover:bg-white/3 transition-colors">
                        <td className="p-4 sm:p-5 font-medium text-neutral-800 dark:text-neutral-200">{label}</td>
                        {TIERS.map(t => (
                          <td key={t} className={'p-4 sm:p-5 text-center'+(t==='pro'?' bg-blue-50/10 dark:bg-blue-500/5 font-semibold':'')}>
                            {render(t)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 sm:py-28 bg-neutral-50 dark:bg-[#0a0a14] transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900 dark:text-white">Get in touch</h2>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">Have questions? We'd love to hear from you.</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#14141f] rounded-2xl p-6 border border-neutral-100 dark:border-white/8 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Email Support</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">support@smmtai.com</p>
            </div>
            <div className="bg-white dark:bg-[#14141f] rounded-2xl p-6 border border-neutral-100 dark:border-white/8 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Sales</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">sales@smmtai.com</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
