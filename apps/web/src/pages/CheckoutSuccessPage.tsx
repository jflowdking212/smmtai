import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card } from '@/components/ui';
import { Sparkles, CheckCircle2, Mail } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useEffect } from 'react';
import { api } from '@/lib/api';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { settings } = useSiteSettings();

  useEffect(() => {
    const rawPixelId = settings.fb_pixel_id;
    if (!rawPixelId) return;
    const pixelIdStr = String(rawPixelId);
    const pixelIdMatch = pixelIdStr.match(/\d{10,18}/);
    if (!pixelIdMatch) {
      console.warn("Invalid Facebook Pixel ID format:", rawPixelId);
      return;
    }
    const pixelId = pixelIdMatch[0];

    if (!window.fbq) {
      (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod
            ? n.callMethod.apply(n, arguments)
            : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(
        window,
        document,
        'script',
        'https://connect.facebook.net/en_US/fbevents.js'
      );
    }

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');

    if (sessionId) {
      api.billing.getCheckoutSession(sessionId)
        .then((res) => {
          const { amount, currency } = res.data;
          window.fbq('track', 'Purchase', {
            value: amount,
            currency: currency || 'USD',
          });
        })
        .catch((err) => {
          console.error('Failed to retrieve checkout details for FB Pixel tracking:', err);
          window.fbq('track', 'Purchase', {
            value: 0.00,
            currency: 'USD',
          });
        });
    } else {
      window.fbq('track', 'Purchase', {
        value: 0.00,
        currency: 'USD',
      });
    }
  }, [settings.fb_pixel_id, sessionId]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-3">
          {settings.site_logo ? (
            <img src={settings.site_logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
          ) : (
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="font-heading font-bold text-xl text-neutral-900">{settings.site_title || 'SmmtAI'}</span>
        </div>

        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-success-600" />
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Payment confirmed</h1>
          <p className="text-sm text-neutral-500">
            Your subscription is now processing. We&apos;ve created your account and sent a welcome email with instructions to set your password and sign in.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
            <Mail className="w-4 h-4" />
            Check your inbox (and spam folder) for the setup email.
          </div>
          {sessionId && (
            <p className="text-[11px] text-neutral-400 break-all">Session: {sessionId}</p>
          )}
          <div className="pt-2">
            <Link to="/auth/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </div>
          <div>
            <Link to="/" className="text-xs text-neutral-500 hover:underline">
              Back to home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

