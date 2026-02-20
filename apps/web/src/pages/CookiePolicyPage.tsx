import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Sparkles } from 'lucide-react';

export function CookiePolicyPage() {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'EE PostMind';

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <Link to="/" className="text-sm text-brand-blue hover:underline">&larr; Back to {siteName}</Link>

        <div className="flex items-center gap-2">
          {settings.site_logo ? (
            <img src={settings.site_logo} alt={siteName} className="w-8 h-8 object-contain rounded-lg" />
          ) : (
            <Sparkles className="w-7 h-7 text-blue-500" />
          )}
          <h1 className="text-3xl font-heading font-bold text-neutral-900">Cookie Policy</h1>
        </div>

        <p className="text-xs text-neutral-500">Last updated: 20 February 2026</p>

        <div className="space-y-6 text-sm text-neutral-700 leading-relaxed">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">1. Introduction</h2>
            <p>
              This Cookie Policy explains how EntreprenrEducation ("Company", "we", "us", or "our"), operating the
              {' '}{siteName} platform ("Service"), uses cookies and similar technologies. This policy should be read
              alongside our <Link to="/privacy" className="text-brand-blue hover:underline">Privacy Policy</Link>.
            </p>
            <p>
              {siteName} is a subsidiary product of EntreprenrEducation, a private limited company registered in the United Kingdom.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">2. What Are Cookies?</h2>
            <p>
              Cookies are small text files placed on your device (computer, tablet, or mobile) when you visit a website.
              They are widely used to make websites work efficiently, provide a better user experience, and supply
              information to website owners.
            </p>
            <p>
              Similar technologies include local storage, session storage, and web beacons, which function in comparable ways.
              References to "cookies" in this policy include all such technologies.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">3. How We Use Cookies</h2>
            <p>We use cookies for the following purposes:</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 pr-3 font-semibold text-neutral-800">Category</th>
                    <th className="text-left py-2 pr-3 font-semibold text-neutral-800">Purpose</th>
                    <th className="text-left py-2 font-semibold text-neutral-800">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="py-2 pr-3 font-medium">Strictly Necessary</td>
                    <td className="py-2 pr-3">Authentication, security, and core functionality</td>
                    <td className="py-2">Session / 30 days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-medium">Functional</td>
                    <td className="py-2 pr-3">Remember preferences (theme, language, timezone)</td>
                    <td className="py-2">1 year</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-medium">Performance</td>
                    <td className="py-2 pr-3">Understand how users interact with the Service</td>
                    <td className="py-2">Up to 24 months</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">4. Cookies We Use</h2>

            <h3 className="text-sm font-semibold text-neutral-800">4.1 Strictly Necessary Cookies</h3>
            <p>These cookies are essential for the Service to function. Without them, you cannot use core features.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 pr-3 font-semibold text-neutral-800">Cookie Name</th>
                    <th className="text-left py-2 pr-3 font-semibold text-neutral-800">Purpose</th>
                    <th className="text-left py-2 font-semibold text-neutral-800">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs">refresh_token</td>
                    <td className="py-2 pr-3">Maintains your authenticated session securely</td>
                    <td className="py-2">30 days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs">csrf_token</td>
                    <td className="py-2 pr-3">Protects against cross-site request forgery attacks</td>
                    <td className="py-2">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-semibold text-neutral-800">4.2 Functional Cookies</h3>
            <p>These cookies remember your choices and preferences to enhance your experience.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 pr-3 font-semibold text-neutral-800">Cookie / Storage Key</th>
                    <th className="text-left py-2 pr-3 font-semibold text-neutral-800">Purpose</th>
                    <th className="text-left py-2 font-semibold text-neutral-800">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs">postmind_theme</td>
                    <td className="py-2 pr-3">Stores your preferred colour theme (light/dark)</td>
                    <td className="py-2">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs">postmind_sidebar</td>
                    <td className="py-2 pr-3">Remembers sidebar collapsed/expanded state</td>
                    <td className="py-2">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs">postmind_auth</td>
                    <td className="py-2 pr-3">Stores authentication state for session restoration</td>
                    <td className="py-2">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-semibold text-neutral-800">4.3 Performance Cookies</h3>
            <p>
              These cookies help us understand how visitors interact with the Service by collecting anonymous
              information about page views, feature usage, and error rates.
            </p>
            <p>
              We do not currently use third-party analytics services (such as Google Analytics). All performance
              data is collected and processed internally.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">5. Third-Party Cookies</h2>
            <p>
              When you connect social media accounts through the Service, the respective platforms may set their own
              cookies during the OAuth authorisation flow. These cookies are governed by the privacy and cookie policies
              of each platform:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Meta (Facebook/Instagram) — <a href="https://www.facebook.com/policies/cookies/" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Cookie Policy</a></li>
              <li>X (Twitter) — <a href="https://twitter.com/en/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Privacy Policy</a></li>
              <li>LinkedIn — <a href="https://www.linkedin.com/legal/cookie-policy" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Cookie Policy</a></li>
              <li>Google (YouTube) — <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Cookie Policy</a></li>
              <li>TikTok — <a href="https://www.tiktok.com/legal/cookie-policy" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Cookie Policy</a></li>
              <li>Pinterest — <a href="https://policy.pinterest.com/en-gb/cookies" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Cookie Policy</a></li>
            </ul>
            <p>
              Stripe, our payment processor, may also set cookies during the checkout process. See{' '}
              <a href="https://stripe.com/cookies-policy" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Stripe's Cookie Policy</a>.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">6. Managing Cookies</h2>
            <p>
              You can control and manage cookies in several ways:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Browser settings:</strong> Most browsers allow you to view, manage, and delete cookies through
                their settings. Consult your browser's help documentation for instructions.
              </li>
              <li>
                <strong>Clearing local storage:</strong> You can clear local storage data through your browser's
                developer tools or privacy settings.
              </li>
            </ul>
            <p>
              <strong>Please note:</strong> Blocking or deleting strictly necessary cookies may prevent the Service
              from functioning correctly. You may be unable to log in or use core features if these cookies are disabled.
            </p>

            <h3 className="text-sm font-semibold text-neutral-800">Browser-Specific Instructions</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Apple Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Microsoft Edge</a></li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">7. Do Not Track</h2>
            <p>
              Some browsers offer a "Do Not Track" (DNT) setting. As there is currently no industry-standard response
              to DNT signals, we do not alter our data collection practices based on DNT signals. We will update this
              policy if a standard is established.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">8. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our
              data practices. Changes will be posted on this page with an updated "Last updated" date.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">9. Contact</h2>
            <p>If you have questions about our use of cookies, please contact us:</p>
            <ul className="list-none space-y-1">
              <li><strong>Company:</strong> EntreprenrEducation (Private Limited)</li>
              <li><strong>Registered in:</strong> United Kingdom</li>
              <li><strong>Email:</strong>{' '}
                <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
