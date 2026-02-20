import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Sparkles } from 'lucide-react';

export function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-heading font-bold text-neutral-900">Privacy Policy</h1>
        </div>

        <p className="text-xs text-neutral-500">Last updated: 20 February 2026</p>

        <div className="space-y-6 text-sm text-neutral-700 leading-relaxed">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">1. Introduction</h2>
            <p>
              This Privacy Policy explains how EntreprenrEducation ("Company", "we", "us", or "our"), a private limited
              company registered in the United Kingdom, collects, uses, stores, and protects your personal data when you
              use the {siteName} platform ("Service").
            </p>
            <p>
              {siteName} is a subsidiary product of EntreprenrEducation. We are committed to protecting your privacy and
              complying with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
            <p>
              For any privacy-related enquiries, contact us at{' '}
              <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">2. Data Controller</h2>
            <p>
              EntreprenrEducation is the data controller responsible for the personal data collected through the Service.
            </p>
            <ul className="list-none space-y-1">
              <li><strong>Company:</strong> EntreprenrEducation (Private Limited)</li>
              <li><strong>Registered in:</strong> United Kingdom</li>
              <li><strong>Contact:</strong>{' '}
                <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">3. Information We Collect</h2>

            <h3 className="text-sm font-semibold text-neutral-800">3.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> Name, email address, and password when you register.</li>
              <li><strong>Profile information:</strong> Avatar, timezone, and preferences you set in your account.</li>
              <li><strong>Content:</strong> Posts, captions, images, videos, and other media you upload or create.</li>
              <li><strong>Billing information:</strong> Payment details processed securely through Stripe. We do not store full card numbers on our servers.</li>
              <li><strong>Communications:</strong> Messages and support enquiries you send through the Service.</li>
            </ul>

            <h3 className="text-sm font-semibold text-neutral-800">3.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Usage data:</strong> Pages visited, features used, scheduling activity, and interaction patterns.</li>
              <li><strong>Device information:</strong> Browser type, operating system, IP address, and device identifiers.</li>
              <li><strong>Log data:</strong> Access times, error logs, and API request metadata.</li>
              <li><strong>Cookies and similar technologies:</strong> See our <Link to="/cookies" className="text-brand-blue hover:underline">Cookie Policy</Link> for details.</li>
            </ul>

            <h3 className="text-sm font-semibold text-neutral-800">3.3 Information from Third Parties</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Social media platforms:</strong> When you connect your social accounts, we receive profile information, page/account details, and OAuth tokens as authorised by you.</li>
              <li><strong>Analytics from connected platforms:</strong> Engagement metrics, follower counts, and post performance data from your connected social accounts.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">4. How We Use Your Information</h2>
            <p>We use your personal data for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Provide the Service:</strong> Create and manage your account, schedule and publish posts, and deliver AI-powered features.</li>
              <li><strong>Process payments:</strong> Manage subscriptions, billing, and invoices.</li>
              <li><strong>Improve the Service:</strong> Analyse usage patterns, fix bugs, and develop new features.</li>
              <li><strong>Communicate with you:</strong> Send account notifications, billing alerts, service updates, and respond to support requests.</li>
              <li><strong>Ensure security:</strong> Detect and prevent fraud, abuse, and unauthorised access.</li>
              <li><strong>Comply with legal obligations:</strong> Fulfil legal, regulatory, and compliance requirements.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">5. Legal Basis for Processing</h2>
            <p>Under UK GDPR, we process your data based on the following legal grounds:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contract performance:</strong> Processing necessary to provide the Service you subscribed to.</li>
              <li><strong>Legitimate interests:</strong> Improving the Service, preventing fraud, and ensuring platform security.</li>
              <li><strong>Consent:</strong> Where you have given explicit consent, such as for marketing communications.</li>
              <li><strong>Legal obligation:</strong> Where we are legally required to process your data.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">6. Data Sharing &amp; Third Parties</h2>
            <p>We do not sell your personal data. We may share your information with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Social media platforms:</strong> To publish content on your behalf as authorised by you (Facebook, Instagram, X/Twitter, LinkedIn, TikTok, YouTube, Pinterest, etc.).</li>
              <li><strong>Payment processors:</strong> Stripe processes payments securely. See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Stripe's Privacy Policy</a>.</li>
              <li><strong>AI service providers:</strong> OpenAI processes text for AI-powered features. Content is sent only when you use AI features.</li>
              <li><strong>Cloud infrastructure:</strong> Hosting, storage, and email delivery providers that process data on our behalf under strict data processing agreements.</li>
              <li><strong>Legal authorities:</strong> When required by law, regulation, legal process, or enforceable governmental request.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">7. Data Security</h2>
            <p>We implement appropriate technical and organisational measures to protect your data, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Encryption of data in transit (TLS/SSL) and at rest.</li>
              <li>Encrypted storage of OAuth tokens and API credentials.</li>
              <li>Password hashing using bcrypt with appropriate cost factors.</li>
              <li>Role-based access controls and audit logging for administrative actions.</li>
              <li>Regular security reviews and updates.</li>
            </ul>
            <p>
              No system is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">8. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> Retained for as long as your account is active. Deleted upon account closure, subject to legal retention requirements.</li>
              <li><strong>Post media:</strong> Images retained for up to 30 days after publishing; videos for up to 20 days. Published post references are retained longer.</li>
              <li><strong>Usage and analytics data:</strong> Retained for up to 24 months for service improvement purposes.</li>
              <li><strong>Billing records:</strong> Retained as required by tax and financial regulations (typically 6 years).</li>
              <li><strong>Audit logs:</strong> Administrative action logs retained for 12 months.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">9. International Data Transfers</h2>
            <p>
              Your data may be processed in countries outside the United Kingdom where our hosting infrastructure and
              third-party service providers operate. Where data is transferred outside the UK, we ensure appropriate
              safeguards are in place, including Standard Contractual Clauses (SCCs) or adequacy decisions.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">10. Your Rights</h2>
            <p>Under UK GDPR, you have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Right of access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to rectification:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Right to erasure:</strong> Request deletion of your data ("right to be forgotten").</li>
              <li><strong>Right to restrict processing:</strong> Request that we limit how we use your data.</li>
              <li><strong>Right to data portability:</strong> Receive your data in a structured, commonly used format.</li>
              <li><strong>Right to object:</strong> Object to processing based on legitimate interests or for marketing.</li>
              <li><strong>Right to withdraw consent:</strong> Where processing is based on consent, withdraw it at any time.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">11. Children's Privacy</h2>
            <p>
              The Service is not intended for individuals under 18 years of age. We do not knowingly collect personal
              data from children. If you believe a child has provided us with personal data, please contact us and we
              will promptly delete it.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated via email or
              through a prominent notice on the Service. We encourage you to review this page periodically.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">13. Complaints</h2>
            <p>
              If you are unhappy with how we handle your personal data, you have the right to lodge a complaint with
              the UK Information Commissioner's Office (ICO):
            </p>
            <ul className="list-none space-y-1">
              <li><strong>Website:</strong>{' '}
                <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">ico.org.uk</a>
              </li>
              <li><strong>Phone:</strong> 0303 123 1113</li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">14. Contact</h2>
            <p>For privacy-related enquiries:</p>
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
