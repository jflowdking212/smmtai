import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Sparkles } from 'lucide-react';

export function TermsPage() {
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
          <h1 className="text-3xl font-heading font-bold text-neutral-900">Terms &amp; Conditions</h1>
        </div>

        <p className="text-xs text-neutral-500">Last updated: 20 February 2026</p>

        <div className="space-y-6 text-sm text-neutral-700 leading-relaxed">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">1. Introduction</h2>
            <p>
              These Terms and Conditions ("Terms") govern your access to and use of the {siteName} platform
              ("Service"), operated by EntreprenrEducation, a private limited company registered in the United Kingdom
              ("Company", "we", "us", or "our"). By accessing or using the Service, you agree to be bound by these Terms.
              If you do not agree, you must not use the Service.
            </p>
            <p>
              {siteName} is a subsidiary product of EntreprenrEducation. For any enquiries, contact us at{' '}
              <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">2. Definitions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>"Account"</strong> means your registered user account on the Service.</li>
              <li><strong>"Content"</strong> means any text, images, videos, graphics, or other materials you upload, post, or transmit through the Service.</li>
              <li><strong>"Subscription"</strong> means the paid or free plan under which you access the Service.</li>
              <li><strong>"User"</strong> means any individual who accesses the Service, whether registered or not.</li>
              <li><strong>"Workspace"</strong> means a collaborative space within the Service where users manage social media accounts and content.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">3. Account Registration</h2>
            <p>
              To use the Service, you must create an Account by providing accurate, current, and complete information.
              You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your Account.
            </p>
            <p>
              You must be at least 18 years of age to create an Account. By registering, you represent and warrant that you meet this requirement.
            </p>
            <p>
              We reserve the right to suspend or terminate Accounts that violate these Terms or that we reasonably believe
              are being used for fraudulent or malicious purposes.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">4. Subscriptions &amp; Billing</h2>
            <p>
              The Service offers various subscription plans (Free, Pro, Business, Enterprise) with different features and limits.
              Paid plans are billed on a monthly or annual basis. Prices are displayed in US dollars unless otherwise stated.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Annual subscriptions may be offered at a discounted rate as set by the administrator.</li>
              <li>Subscription fees are non-refundable except where required by applicable law or at our sole discretion.</li>
              <li>We reserve the right to modify pricing with 30 days' advance notice to existing subscribers.</li>
              <li>If payment fails, your account may be downgraded to the Free tier after a grace period.</li>
            </ul>
            <p>
              You may upgrade, downgrade, or cancel your subscription at any time through the Billing section.
              Downgrades take effect at the end of the current billing period.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Violate any applicable law, regulation, or third-party rights.</li>
              <li>Post, upload, or distribute content that is defamatory, obscene, threatening, harassing, or otherwise objectionable.</li>
              <li>Distribute spam, unsolicited messages, or bulk automated content through connected social platforms.</li>
              <li>Attempt to gain unauthorised access to the Service, other user accounts, or connected systems.</li>
              <li>Reverse-engineer, decompile, or disassemble the Service or its underlying technology.</li>
              <li>Use the Service to infringe any intellectual property rights.</li>
              <li>Use automated means (bots, scrapers) to access the Service except through our official API.</li>
            </ul>
            <p>
              We reserve the right to remove content and suspend accounts that violate this policy without prior notice.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">6. User Content</h2>
            <p>
              You retain ownership of all Content you upload to the Service. By uploading Content, you grant us a limited,
              non-exclusive, royalty-free licence to store, process, and transmit your Content solely for the purpose of
              providing the Service (e.g., scheduling posts to your connected social media accounts).
            </p>
            <p>
              You are solely responsible for all Content you post and for ensuring it complies with applicable laws and the
              terms of service of connected social media platforms.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">7. Media Retention</h2>
            <p>
              To optimise storage costs, post attachments are retained for a limited time after a post is published:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Images</strong>: up to <strong>30 days</strong> after posting.</li>
              <li><strong>Videos</strong>: up to <strong>20 days</strong> after posting.</li>
            </ul>
            <p>
              After the retention period, media files may be permanently deleted from our storage.
              Your published social post remains available on the destination platform. This retention policy
              applies to post media only and does not apply to site assets (logo, favicon, branding images).
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">8. AI-Generated Content</h2>
            <p>
              The Service includes AI-powered features (caption generation, hashtag suggestions, content ideas).
              AI-generated content is provided "as is" and may not always be accurate, appropriate, or suitable for your purpose.
              You are responsible for reviewing and editing AI-generated content before publishing.
            </p>
            <p>
              We do not guarantee the originality of AI-generated content and disclaim any liability for claims arising
              from its use, including intellectual property disputes.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">9. Third-Party Integrations</h2>
            <p>
              The Service connects to third-party social media platforms (Facebook, Instagram, X/Twitter, LinkedIn,
              TikTok, YouTube, Pinterest, and others). Your use of these integrations is subject to the respective
              platform's terms of service and privacy policies.
            </p>
            <p>
              We are not responsible for changes to third-party APIs, service disruptions, or the actions of third-party
              platforms that may affect the functionality of the Service.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">10. Intellectual Property</h2>
            <p>
              The Service, including its software, design, logos, and documentation, is the intellectual property of
              EntreprenrEducation and is protected by copyright, trademark, and other intellectual property laws.
              You may not reproduce, distribute, or create derivative works from any part of the Service without
              our prior written consent.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, EntreprenrEducation shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunities
              arising from your use of the Service.
            </p>
            <p>
              Our total aggregate liability for any claims arising from or related to the Service shall not exceed the
              amount you paid to us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless EntreprenrEducation, its officers, directors, employees, and agents
              from any claims, losses, liabilities, damages, costs, and expenses (including legal fees) arising from your
              use of the Service, your Content, or your violation of these Terms.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">13. Termination</h2>
            <p>
              You may terminate your Account at any time by contacting us at{' '}
              <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>.
              We may suspend or terminate your Account if you breach these Terms, with or without notice.
            </p>
            <p>
              Upon termination, your right to use the Service ceases immediately. We may retain certain data as required
              by law or for legitimate business purposes.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">14. Modifications to Terms</h2>
            <p>
              We reserve the right to update these Terms at any time. Material changes will be communicated via email
              or through a notice on the Service. Continued use of the Service after changes take effect constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">15. Governing Law &amp; Disputes</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of England and Wales.
              Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">16. Contact</h2>
            <p>
              If you have questions about these Terms, please contact us:
            </p>
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
