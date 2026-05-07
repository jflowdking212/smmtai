import { useSiteSettings } from '@/hooks/useSiteSettings';
import { LegalPageLayout, LegalSection } from '@/components/LegalPageLayout';
import {
  BookOpen, Database, Share2, Shield, UserCheck, Clock,
  Mail, Globe, Cookie, Baby, RefreshCw, Trash2,
} from 'lucide-react';

export function PrivacyPolicyPage() {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'EE PostMind';

  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle={`How ${siteName} collects, uses, and protects your personal data.`}
      icon="privacy"
      lastUpdated="24 February 2026"
    >
      <LegalSection number="1" title="Introduction" icon={<BookOpen className="w-4 h-4" />}>
        <p>
          This Privacy Policy explains how EntreprenrEducation ("Company", "we", "us", or "our") collects,
          uses, discloses, and safeguards your information when you use the {siteName} platform ("Service").
          By using the Service, you consent to the data practices described in this policy.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Information We Collect" icon={<Database className="w-4 h-4" />}>
        <p>We may collect the following types of information:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Account Information:</strong> Name, email address, and password when you register.</li>
          <li><strong>Profile Data:</strong> Avatar, bio, timezone, and preferences you provide.</li>
          <li><strong>Social Media Data:</strong> Account tokens and profile information from platforms you connect (Facebook, Instagram, X/Twitter, LinkedIn, etc.).</li>
          <li><strong>Usage Data:</strong> Pages visited, features used, actions taken, and timestamps.</li>
          <li><strong>Content:</strong> Posts, images, videos, and other materials you create or upload.</li>
          <li><strong>Device &amp; Log Data:</strong> IP address, browser type, operating system, and referring URLs.</li>
          <li><strong>Payment Information:</strong> Billing details processed securely through our payment provider (Stripe). We do not store full card numbers.</li>
        </ul>
      </LegalSection>

      <LegalSection number="3" title="How We Use Your Information" icon={<UserCheck className="w-4 h-4" />}>
        <p>We use collected information to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Provide, maintain, and improve the Service.</li>
          <li>Process transactions and manage your subscription.</li>
          <li>Schedule and publish content to your connected social media accounts.</li>
          <li>Generate AI-powered content suggestions and analytics.</li>
          <li>Send service-related communications (e.g., billing receipts, security alerts).</li>
          <li>Respond to support requests and enquiries.</li>
          <li>Detect and prevent fraud, abuse, or security incidents.</li>
        </ul>
      </LegalSection>

      <LegalSection number="4" title="Sharing Your Information" icon={<Share2 className="w-4 h-4" />}>
        <p>We do not sell your personal data. We may share information with:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Social Media Platforms:</strong> To publish content on your behalf via their APIs.</li>
          <li><strong>Service Providers:</strong> Third-party services that help us operate (e.g., hosting, email, payment processing).</li>
          <li><strong>Legal Obligations:</strong> When required by law, regulation, or legal process.</li>
          <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
        </ul>
      </LegalSection>

      <LegalSection number="5" title="Data Security" icon={<Shield className="w-4 h-4" />}>
        <p>
          We implement appropriate technical and organisational measures to protect your personal data,
          including encryption in transit (TLS/SSL), secure password hashing, and access controls.
          However, no method of transmission over the internet is 100% secure. We cannot guarantee
          absolute security.
        </p>
      </LegalSection>

      <LegalSection number="6" title="Data Retention" icon={<Clock className="w-4 h-4" />}>
        <p>
          We retain your personal data for as long as your account is active or as needed to provide the Service.
          Post media attachments are retained for 30 days (images) or 20 days (videos) after publication.
          Upon account deletion, we will remove your data within 30 days, except where retention is required by law.
        </p>
      </LegalSection>

      <LegalSection number="7" title="Your Rights" icon={<UserCheck className="w-4 h-4" />}>
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data ("right to be forgotten").</li>
          <li>Object to or restrict processing of your data.</li>
          <li>Request data portability.</li>
          <li>Withdraw consent at any time.</li>
        </ul>
        <p>
          To exercise these rights, contact us at{' '}
          <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>.
        </p>
      </LegalSection>

      <LegalSection number="8" title="Data Deletion" icon={<Trash2 className="w-4 h-4" />}>
        <p>
          You can request deletion of your personal data at any time. When you delete your account or
          request data removal, we will permanently delete all associated data including:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your account profile and login credentials.</li>
          <li>Connected social media account tokens and metadata.</li>
          <li>Posts, drafts, scheduled content, and media files.</li>
          <li>Analytics data and usage history.</li>
          <li>Workspace memberships and team associations.</li>
        </ul>
        <p className="mt-3"><strong>How to request data deletion:</strong></p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>From your account:</strong> Go to Settings → Account → Delete Account.</li>
          <li><strong>By email:</strong> Send a request to{' '}
            <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>{' '}
            with the subject line "Data Deletion Request" and include the email address associated with your account.
          </li>
          <li><strong>Facebook users:</strong> If you connected via Facebook Login, you can also remove {siteName} from your{' '}
            <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">Facebook App Settings</a>.
          </li>
        </ul>
        <p className="mt-3">
          Data deletion requests are processed within 30 days. Some data may be retained where required
          by law (e.g., transaction records for tax compliance) but will no longer be associated with your identity.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Cookies" icon={<Cookie className="w-4 h-4" />}>
        <p>
          We use essential cookies for authentication and session management. We may also use analytics
          cookies to understand how users interact with the Service. For more details, see our{' '}
          <a href="/cookies" className="text-brand-blue hover:underline">Cookie Policy</a>.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Children's Privacy" icon={<Baby className="w-4 h-4" />}>
        <p>
          The Service is not intended for individuals under 18 years of age. We do not knowingly collect
          personal data from children. If we become aware that we have collected data from a child,
          we will take steps to delete it promptly.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Changes to This Policy" icon={<RefreshCw className="w-4 h-4" />}>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated
          via email or through a notice on the Service. Continued use after changes take effect
          constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection number="12" title="Contact" icon={<Mail className="w-4 h-4" />}>
        <p>If you have questions about this Privacy Policy, please contact us:</p>
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
