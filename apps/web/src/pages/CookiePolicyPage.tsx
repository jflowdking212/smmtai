import { useSiteSettings } from '@/hooks/useSiteSettings';
import { LegalPageLayout, LegalSection } from '@/components/LegalPageLayout';
import {
  BookOpen, Cookie, Shield, Settings, Clock,
  Mail, Globe, RefreshCw,
} from 'lucide-react';

export function CookiePolicyPage() {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'EE PostMind';

  return (
    <LegalPageLayout
      title="Cookie Policy"
      subtitle={`How ${siteName} uses cookies and similar technologies.`}
      icon="cookies"
      lastUpdated="20 February 2026"
    >
      <LegalSection number="1" title="What Are Cookies" icon={<BookOpen className="w-4 h-4" />}>
        <p>
          Cookies are small text files stored on your device when you visit a website. They help the
          website remember your preferences and improve your browsing experience. {siteName} uses cookies
          and similar technologies to operate and enhance the Service.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Cookies We Use" icon={<Cookie className="w-4 h-4" />}>
        <p>We use the following types of cookies:</p>
        <div className="space-y-3 mt-2">
          <div className="rounded-xl bg-green-50 p-4">
            <p className="font-semibold text-green-800 mb-1">Essential Cookies</p>
            <p className="text-sm text-green-700">
              Required for the Service to function. These include authentication tokens, session identifiers,
              and CSRF protection tokens. They cannot be disabled.
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="font-semibold text-blue-800 mb-1">Functional Cookies</p>
            <p className="text-sm text-blue-700">
              Remember your preferences such as language, timezone, and UI settings to provide a personalised experience.
            </p>
          </div>
          <div className="rounded-xl bg-purple-50 p-4">
            <p className="font-semibold text-purple-800 mb-1">Analytics Cookies</p>
            <p className="text-sm text-purple-700">
              Help us understand how users interact with the Service so we can improve features and performance.
              These cookies collect aggregated, anonymous data.
            </p>
          </div>
        </div>
      </LegalSection>

      <LegalSection number="3" title="Third-Party Cookies" icon={<Shield className="w-4 h-4" />}>
        <p>
          Some cookies may be set by third-party services we use, such as payment processors (Stripe)
          and social media platforms you connect to the Service. These cookies are governed by the
          respective third party's privacy and cookie policies.
        </p>
      </LegalSection>

      <LegalSection number="4" title="Managing Cookies" icon={<Settings className="w-4 h-4" />}>
        <p>
          You can control and manage cookies through your browser settings. Most browsers allow you to:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>View and delete existing cookies.</li>
          <li>Block all or certain types of cookies.</li>
          <li>Set preferences for specific websites.</li>
        </ul>
        <p>
          Please note that disabling essential cookies may prevent you from using certain features of the Service,
          including logging in and managing your account.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Cookie Retention" icon={<Clock className="w-4 h-4" />}>
        <p>Cookie retention periods vary by type:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Session cookies:</strong> Deleted when you close your browser.</li>
          <li><strong>Authentication cookies:</strong> Retained for up to 7 days to keep you logged in.</li>
          <li><strong>Preference cookies:</strong> Retained for up to 1 year.</li>
          <li><strong>Analytics cookies:</strong> Retained for up to 2 years.</li>
        </ul>
      </LegalSection>

      <LegalSection number="6" title="Changes to This Policy" icon={<RefreshCw className="w-4 h-4" />}>
        <p>
          We may update this Cookie Policy from time to time to reflect changes in our practices or
          applicable laws. We will notify you of significant changes through the Service.
        </p>
      </LegalSection>

      <LegalSection number="7" title="Contact" icon={<Mail className="w-4 h-4" />}>
        <p>If you have questions about our use of cookies, please contact us:</p>
        <div className="rounded-xl bg-neutral-50 p-4 space-y-1 mt-2">
          <p className="font-medium text-neutral-900">EntreprenrEducation (Private Limited)</p>
          <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-neutral-400" /> Registered in the United Kingdom</p>
          <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-neutral-400" />
            <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>
          </p>
        </div>
      </LegalSection>
    </LegalPageLayout>
  );
}
