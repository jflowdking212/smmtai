import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { api } from '@/lib/api';
import {
  Sparkles, ArrowRight, Check, Zap, CreditCard, Building2, Crown,
  PenSquare, Calendar, BarChart3, Palette, Link2, Bot, Shield, Globe, Users,
} from 'lucide-react';

const DEFAULT_PRICES: Record<string, number> = { Basic: 0, Pro: 19, Business: 49, Enterprise: 0 };
const DEFAULT_YEARLY_DISCOUNT = 30;
const TIER_MAP: Record<string, string> = { Basic: 'basic', Pro: 'pro', Business: 'business', Enterprise: 'enterprise' };

const plans = [
  {
    name: 'Basic', monthlyPrice: 0, description: 'Get started with the basics', icon: Zap, popular: false,
    platforms: ['Entreprenrs', 'Chrxstians', 'Iohah', 'Facebook'],
    features: ['4 social accounts', '30 posts/month', '5 AI generations', '10 templates/month', '1 team member', '7-day analytics'],
  },
  {
    name: 'Pro', monthlyPrice: 19, description: 'For growing creators & teams', icon: CreditCard, popular: true,
    platforms: ['Everything in Basic', 'Instagram', 'X (Twitter)', 'YouTube', 'Pinterest'],
    features: ['8 social accounts', '200 posts/month', '100 AI generations', '50 templates/month', '3 team members', '30-day analytics'],
  },
  {
    name: 'Business', monthlyPrice: 49, description: 'For agencies & larger teams', icon: Building2, popular: false,
    platforms: ['Everything in Pro', 'TikTok', 'LinkedIn', 'Bluesky', 'Mastodon', 'Telegram'],
    features: ['25 social accounts', 'Unlimited posts', '500 AI generations', 'Unlimited templates', '10 team members', '90-day analytics'],
  },
  {
    name: 'Enterprise', monthlyPrice: 0, description: 'Dedicated support & custom limits', icon: Crown, popular: false, custom: true,
    platforms: ['All 13 platforms'],
    features: ['Unlimited accounts', 'Unlimited posts', 'Unlimited AI', 'Unlimited templates', 'Unlimited team', 'Full analytics history', 'Dedicated support', 'Custom integrations'],
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

function PricingSection() {
  const [yearly, setYearly] = useState(false);
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    let active = true;
    api.site.getPublicPlans()
      .then((res) => { if (active) setPlanConfig(res.data); })
      .catch(() => { /* use defaults */ });
    return () => { active = false; };
  }, []);

  function getMonthlyPrice(planName: string): number {
    const tier = TIER_MAP[planName];
    return planConfig?.pricing?.[tier]?.monthlyPrice ?? DEFAULT_PRICES[planName];
  }

  function getYearlyDiscount(planName: string): number {
    const tier = TIER_MAP[planName];
    return planConfig?.pricing?.[tier]?.yearlyDiscount ?? planConfig?.yearlyDiscount ?? DEFAULT_YEARLY_DISCOUNT;
  }

  function formatPrice(monthlyPrice: number, yearlyDiscountPct: number): { display: string; period: string; originalYearly?: string } {
    if (monthlyPrice === 0) return { display: '$0', period: '/forever' };
    if (yearly) {
      const fullYearly = +(monthlyPrice * 12).toFixed(2);
      const discountedYearly = +(fullYearly * (1 - yearlyDiscountPct / 100)).toFixed(2);
      return {
        display: `$${Number.isInteger(discountedYearly) ? discountedYearly : discountedYearly.toFixed(2)}`,
        period: '/year',
        originalYearly: `$${Number.isInteger(fullYearly) ? fullYearly : fullYearly.toFixed(2)}/year`,
      };
    }
    return { display: `$${monthlyPrice}`, period: '/month' };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900">Simple, transparent pricing</h2>
        <p className="mt-4 text-lg text-neutral-600">Start free and scale as you grow. No hidden fees.</p>
      </div>

      {/* Monthly / Yearly Toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!yearly ? 'text-neutral-900' : 'text-neutral-400'}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly(!yearly)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${yearly ? 'bg-blue-600' : 'bg-neutral-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${yearly ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${yearly ? 'text-neutral-900' : 'text-neutral-400'}`}>
          Yearly <span className="text-green-600 font-semibold">(Save {getYearlyDiscount('Pro')}%)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {plans.map((plan) => {
          const monthlyPrice = getMonthlyPrice(plan.name);
          const yearlyDiscount = getYearlyDiscount(plan.name);

          return (
          <div key={plan.name}
            className={`relative bg-white rounded-2xl p-6 sm:p-8 border-2 transition-all hover:shadow-lg ${
              plan.popular ? 'border-blue-600 shadow-lg shadow-blue-600/10' : 'border-neutral-100'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                Most Popular
              </div>
            )}
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <plan.icon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
            <p className="text-sm text-neutral-500 mt-1">{plan.description}</p>
            <div className="mt-4 mb-2">
              {plan.custom ? (
                <span className="text-4xl font-bold text-neutral-900">Custom</span>
              ) : (() => {
                const price = formatPrice(monthlyPrice, yearlyDiscount);
                return (
                  <>
                    <span className="text-4xl font-bold text-neutral-900">{price.display}</span>
                    <span className="text-sm text-neutral-500">{price.period}</span>
                    {price.originalYearly && (
                      <span className="block text-xs text-neutral-400 line-through">{price.originalYearly}</span>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Platform badges */}
            <div className="flex flex-wrap gap-1 mb-4">
              {plan.platforms.map((p) => (
                <span key={p} className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                  {p}
                </span>
              ))}
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-neutral-700">
                  <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link to="/auth/register"
              className={`block w-full text-center py-2.5 rounded-lg font-medium text-sm transition-all ${
                plan.popular
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
              }`}
            >
              {plan.custom ? 'Contact Sales' : 'Get Started'}
            </Link>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function LandingPage() {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'Postmind';

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            {settings.site_logo ? (
              <img src={settings.site_logo} alt={siteName} className="w-8 h-8 object-contain" />
            ) : (
              <Sparkles className="w-7 h-7 text-blue-600" />
            )}
            <span className="text-xl font-bold font-heading text-neutral-900">{siteName}</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">Pricing</a>
            <a href="#contact" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth/login" className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors px-4 py-2">
              Log In
            </Link>
            <Link to="/auth/register" className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" /> AI-Powered Social Media Management
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-neutral-900 leading-tight">
              Create, Schedule & Publish <span className="text-blue-600">Everywhere</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-neutral-600 leading-relaxed max-w-2xl mx-auto">
              {settings.site_tagline || 'Postmind helps you craft stunning content with AI, design eye-catching visuals, and publish to all your social platforms — all from one dashboard.'}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 text-base">
                Start Free Today <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#features" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white hover:bg-neutral-50 text-neutral-700 font-medium rounded-xl transition-all border border-neutral-200 text-base">
                See Features
              </a>
            </div>
            <p className="mt-4 text-sm text-neutral-500">No credit card required · Free forever plan</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900">Everything you need to grow your social presence</h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">Powerful tools that save you time and help you create better content across every platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-100 hover:border-blue-100 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center mb-5 transition-colors">
                  <f.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">{f.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28">
        <PricingSection />
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white">Ready to supercharge your social media?</h2>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">Join thousands of creators and teams who use Postmind to save time, create better content, and grow their audience.</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white hover:bg-neutral-50 text-blue-700 font-medium rounded-xl transition-all shadow-lg text-base">
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/auth/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-white/30 hover:border-white/50 text-white font-medium rounded-xl transition-all text-base">
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 sm:py-28 bg-neutral-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-neutral-900">Get in touch</h2>
          <p className="mt-4 text-lg text-neutral-600">Have questions? We'd love to hear from you.</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-neutral-100">
              <h3 className="font-semibold text-neutral-900 mb-2">Email Support</h3>
              <p className="text-sm text-neutral-500">support@postmind.app</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-neutral-100">
              <h3 className="font-semibold text-neutral-900 mb-2">Sales</h3>
              <p className="text-sm text-neutral-500">sales@postmind.app</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
