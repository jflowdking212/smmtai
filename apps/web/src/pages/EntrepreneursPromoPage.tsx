import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { api } from '@/lib/api';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';
import {
  Sparkles, Check, ArrowRight, ShieldCheck, Flame,
  Users, Bot, RefreshCw, Zap, CheckCircle2, AlertTriangle
} from 'lucide-react';

export function EntrepreneursPromoPage() {
  const [searchParams] = useSearchParams();
  const { settings } = useSiteSettings();
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});

  // Fetch live plans and limits from admin config
  useEffect(() => {
    let active = true;
    api.site.getPublicPlans()
      .then((res) => { if (active) setPlanConfig(res.data); })
      .catch(() => { /* ignore */ });
    return () => { active = false; };
  }, []);

  // Dynamic limits resolver from DB overrides or shared defaults
  const getLimit = (tier: string, key: string, isDays = false) => {
    const val = (planConfig as any)?.[tier]?.[key] ?? (SUBSCRIPTION_LIMITS as any)[tier as SubscriptionTier]?.[key];
    if (val === Infinity || val === '__INFINITY__' || val === 'Unlimited') return 'Unlimited';
    if (isDays) return `${val} days`;
    if (typeof val === 'number') return val.toLocaleString();
    return val ? String(val) : 'Unlimited';
  };

  // Grab UTM parameters from URL for ad conversion tracking
  const utmParams = useMemo(() => {
    const params: Record<string, string> = {};
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    keys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params[key] = value;
    });
    return params;
  }, [searchParams]);

  // Safely grab settings variables with optional chaining to prevent any white screen runtime errors
  const badgeText = settings?.promo_badge || 'Happy Entrepreneurs Day — Exclusive Offer';
  const headline = settings?.promo_headline || 'Happy Entrepreneurs Day — Your Exclusive Offer Awaits';
  const subheadline = settings?.promo_subheadline || 'Get 60% off SMMTAI and take full control of your social media — at a price that makes sense for every entrepreneur.';
  
  const proDiscountPrice = settings?.promo_pro_discounted_price || '10';
  const proOriginalPrice = settings?.promo_pro_original_price || '25';
  const bizDiscountPrice = settings?.promo_biz_discounted_price || '20';
  const bizOriginalPrice = settings?.promo_biz_original_price || '50';
  
  const proCoupon = settings?.promo_pro_coupon || 'ENTREPRENEURS60PRO';
  const bizCoupon = settings?.promo_biz_coupon || 'ENTREPRENEURS60BIZ';
  
  const disclaimerText = settings?.promo_disclaimer || 'Discount applies exclusively when you subscribe for a minimum of six months. The checkout defaults to the six-month plan. Selecting any period less than six months will invalidate and remove the 60% discount automatically.';
  const primaryCtaText = settings?.promo_primary_cta || 'Claim 60% Off Now — Entrepreneurs Day Deal';
  const secondaryCtaText = settings?.promo_secondary_cta || 'Try Pro Free for 14 Days — No Credit Card Needed';
  const secondaryTrialDays = settings?.promo_secondary_trial_days || '14';
  
  const trustItems = useMemo(() => {
    const raw = settings?.promo_trust_bar || 'All Features Included,Cancel Anytime After Six Months,Trusted by Entrepreneurs Worldwide';
    return raw.split(',').map(item => item.trim()).filter(Boolean);
  }, [settings?.promo_trust_bar]);
  
  const footerText = settings?.promo_footer || 'This offer is exclusive to Entrepreneurs Day SMMTAI.com';

  const getCheckoutUrl = (tier: 'pro' | 'business') => {
    const params = new URLSearchParams();
    params.set('priceKey', `${tier}_6month`);
    params.set('coupon', tier === 'pro' ? proCoupon : bizCoupon);
    Object.entries(utmParams).forEach(([k, v]) => params.set(k, v));
    return `/checkout?${params.toString()}`;
  };

  const getTrialUrl = () => {
    const params = new URLSearchParams();
    params.set('trial', 'pro');
    params.set('trial_days', String(secondaryTrialDays));
    Object.entries(utmParams).forEach(([k, v]) => params.set(k, v));
    return `/auth/register?${params.toString()}`;
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-x-hidden font-sans relative">
      {/* Background radial gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-200/50 dark:bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-violet-200/50 dark:bg-violet-900/20 rounded-full blur-[150px] pointer-events-none" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] mask-image-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 pt-8 pb-4 flex justify-center items-center">
        <Link to="/" className="flex items-center gap-2.5 group">
          {settings?.site_logo ? (
            <img src={settings.site_logo} alt="SMMTAI" className="h-10 w-auto object-contain" />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-50 dark:to-slate-300 bg-clip-text text-transparent font-heading">
            SMMTAI
          </span>
        </Link>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 pt-10 pb-20 space-y-16">
        <section className="text-center space-y-6 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 backdrop-blur-md">
            <Flame className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-semibold tracking-wider text-violet-700 dark:text-violet-300 uppercase">
              {badgeText}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] font-heading">
            <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-50 dark:to-slate-300 bg-clip-text text-transparent block">
              Happy Entrepreneurs Day
            </span>
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent block mt-2">
              Your Exclusive Offer Awaits
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
            {subheadline}
          </p>
        </section>

        {/* Pricing Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Pro Card */}
          <Card className="p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl relative backdrop-blur-md hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-2xl transition-all duration-300 group flex flex-col justify-between">
            <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              60% OFF
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pro Plan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Perfect for entrepreneurs & growing creators</p>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  ${proDiscountPrice}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
                <span className="text-sm text-slate-400 dark:text-slate-500 line-through">
                  ${proOriginalPrice}/mo
                </span>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-start gap-2 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed font-bold">
                  Important: Requires 6-month minimum. Checkout defaults to the 6-month selection to secure this rate. Selecting a shorter period will remove the 60% discount.
                </p>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Features included:</p>
                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span><strong>{getLimit('pro', 'socialAccounts')}</strong> Connected Social Accounts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span><strong>{getLimit('pro', 'postsPerMonth')}</strong> Posts per Month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span><strong>{getLimit('pro', 'aiGenerationsPerMonth')}</strong> AI generations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span><strong>{getLimit('pro', 'teamMembers')}</strong> Team seats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Interactive AI Chatbot & Rewriter tools</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <a href={getCheckoutUrl('pro')}>
                <Button className="w-full py-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2">
                  {primaryCtaText}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </Card>

          {/* Business Card */}
          <Card className="p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl relative backdrop-blur-md hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-2xl transition-all duration-300 group flex flex-col justify-between">
            <div className="absolute top-4 right-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              60% OFF
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Business Plan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">For agencies, startups, & established teams</p>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  ${bizDiscountPrice}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
                <span className="text-sm text-slate-400 dark:text-slate-500 line-through">
                  ${bizOriginalPrice}/mo
                </span>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-start gap-2 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed font-bold">
                  Important: Requires 6-month minimum. Checkout defaults to the 6-month selection to secure this rate. Selecting a shorter period will remove the 60% discount.
                </p>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Features included:</p>
                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span><strong>{getLimit('business', 'socialAccounts')}</strong> Connected Social Accounts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span><strong>{getLimit('business', 'postsPerMonth')}</strong> Posts per Month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span><strong>{getLimit('business', 'aiGenerationsPerMonth')}</strong> AI generations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span><strong>{getLimit('business', 'teamMembers')}</strong> Team seats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span>White-label reporting & custom brand assets</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <a href={getCheckoutUrl('business')}>
                <Button className="w-full py-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2">
                  {primaryCtaText}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </Card>
        </section>

        {/* Invalidation Disclaimer */}
        <section className="max-w-3xl mx-auto text-center space-y-6">
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 border-2 border-red-500 max-w-2xl mx-auto shadow-md">
            <p className="text-base sm:text-lg text-red-700 dark:text-red-400 font-extrabold leading-relaxed uppercase">
              ⚠️ BILLING NOTICE: {disclaimerText}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-widest">or try first</span>
            <a href={getTrialUrl()} className="inline-block">
              <Button variant="secondary" className="px-8 py-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm font-semibold text-xs tracking-wide">
                {secondaryCtaText}
              </Button>
            </a>
          </div>
        </section>

        {/* Features Block */}
        <section className="space-y-10 pt-10 border-t border-slate-200 dark:border-slate-800">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white">Built for High-Growth Startups & Creators</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto">Access the latest social media automation capabilities designed to drive organic growth.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Advanced Team Collaboration</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Connect your workspace members, assign specific roles, and collaborate on scheduled calendars simultaneously with zero friction.
              </p>
            </Card>

            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Interactive AI Copilot</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Prompt our fine-tuned social media AI directly to instantly draft caption matrices, extract hashtags, structure hooks, and generate engaging copy.
              </p>
            </Card>

            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Rewriter & Humanizing AI</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Perfect your tone. Rewrite paragraphs to increase engaging flow, adjust reading complexity, and bypass standard AI detection engines.
              </p>
            </Card>
          </div>
        </section>

        {/* Dynamic Comparison Matrix */}
        <section className="space-y-8 pt-10 border-t border-slate-200 dark:border-slate-800">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white">Compare SMMTAI Plans</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto">Compare core features and pick the option that perfectly scales with your brand.</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 uppercase tracking-widest text-[10px]">
                  <th className="p-4 sm:p-5 font-semibold">Features</th>
                  <th className="p-4 sm:p-5 font-semibold text-center">Basic</th>
                  <th className="p-4 sm:p-5 font-semibold text-center text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">Pro (Offer)</th>
                  <th className="p-4 sm:p-5 font-semibold text-center text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20">Business (Offer)</th>
                  <th className="p-4 sm:p-5 font-semibold text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">Monthly Price</td>
                  <td className="p-4 text-center">${getLimit('basic', 'monthlyPrice')}</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20">${proDiscountPrice} <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through font-normal">${proOriginalPrice}</span></td>
                  <td className="p-4 text-center text-violet-700 dark:text-violet-400 font-bold bg-violet-50 dark:bg-violet-900/20">${bizDiscountPrice} <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through font-normal">${bizOriginalPrice}</span></td>
                  <td className="p-4 text-center font-medium">Custom</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">Social Accounts</td>
                  <td className="p-4 text-center">{getLimit('basic', 'socialAccounts')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-blue-50 dark:bg-blue-900/20">{getLimit('pro', 'socialAccounts')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-violet-50 dark:bg-violet-900/20">{getLimit('business', 'socialAccounts')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100">{getLimit('enterprise', 'socialAccounts')}</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">Monthly Posts</td>
                  <td className="p-4 text-center">{getLimit('basic', 'postsPerMonth')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-blue-50 dark:bg-blue-900/20">{getLimit('pro', 'postsPerMonth')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-violet-50 dark:bg-violet-900/20 font-semibold">{getLimit('business', 'postsPerMonth')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 font-semibold">{getLimit('enterprise', 'postsPerMonth')}</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">AI generations</td>
                  <td className="p-4 text-center">{getLimit('basic', 'aiGenerationsPerMonth')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-blue-50 dark:bg-blue-900/20">{getLimit('pro', 'aiGenerationsPerMonth')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-violet-50 dark:bg-violet-900/20 font-semibold">{getLimit('business', 'aiGenerationsPerMonth')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 font-semibold">{getLimit('enterprise', 'aiGenerationsPerMonth')}</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">Team Seats</td>
                  <td className="p-4 text-center">{getLimit('basic', 'teamMembers')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-blue-50 dark:bg-blue-900/20">{getLimit('pro', 'teamMembers')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-violet-50 dark:bg-violet-900/20">{getLimit('business', 'teamMembers')}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100">{getLimit('enterprise', 'teamMembers')}</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">AI Chatbot</td>
                  <td className="p-4 text-center">Standard</td>
                  <td className="p-4 text-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"><CheckCircle2 className="w-4 h-4 mx-auto" /></td>
                  <td className="p-4 text-center text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20"><CheckCircle2 className="w-4 h-4 mx-auto" /></td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-4 h-4 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">Rewriter & Humanizer</td>
                  <td className="p-4 text-center">—</td>
                  <td className="p-4 text-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"><CheckCircle2 className="w-4 h-4 mx-auto" /></td>
                  <td className="p-4 text-center text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20"><CheckCircle2 className="w-4 h-4 mx-auto" /></td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-4 h-4 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">Analytics History</td>
                  <td className="p-4 text-center">{getLimit('basic', 'analyticsDays', true)}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-blue-50 dark:bg-blue-900/20">{getLimit('pro', 'analyticsDays', true)}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100 bg-violet-50 dark:bg-violet-900/20">{getLimit('business', 'analyticsDays', true)}</td>
                  <td className="p-4 text-center text-slate-900 dark:text-slate-100">{getLimit('enterprise', 'analyticsDays', true)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Trust bar */}
        <section className="pt-10 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-slate-600 dark:text-slate-400">
            {trustItems.map((item: string, index: number) => (
              <div key={index} className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
        <p>{footerText}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">&copy; {new Date().getFullYear()} SMMTAI.com. All rights reserved.</p>
      </footer>
    </div>
  );
}
