import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { LegalPageLayout, LegalSection } from '@/components/LegalPageLayout';
import {
  BookOpen, UserPlus, CreditCard, ShieldCheck, FileText, Image,
  Sparkles, Link2, Scale, AlertTriangle, Shield, Pencil, Gavel,
  Mail, RefreshCw, Globe,
} from 'lucide-react';

export function TermsPage() {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'EE PostMind';

  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle={`The rules and guidelines that govern your use of the ${siteName} platform.`}
      icon="terms"
      lastUpdated="20 February 2026"
    >
      <LegalSection number="1" title="Introduction" icon={<BookOpen className="w-4 h-4" />}>
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
      </LegalSection>

      <LegalSection number="2" title="Definitions" icon={<BookOpen className="w-4 h-4" />}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>"Account"</strong> means your registered user account on the Service.</li>
          <li><strong>"Content"</strong> means any text, images, videos, graphics, or other materials you upload, post, or transmit through the Service.</li>
          <li><strong>"Subscription"</strong> means the paid or free plan under which you access the Service.</li>
          <li><strong>"User"</strong> means any individual who accesses the Service, whether registered or not.</li>
          <li><strong>"Workspace"</strong> means a collaborative space within the Service where users manage social media accounts and content.</li>
        </ul>
      </LegalSection>

      <LegalSection number="3" title="Account Registration" icon={<UserPlus className="w-4 h-4" />}>
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
      </LegalSection>

      <LegalSection number="4" title="Subscriptions & Billing" icon={<CreditCard className="w-4 h-4" />}>
        <p>
          The Service offers various subscription plans (Free, Pro, Business, Enterprise) with different features and limits.
          Paid plans are billed on a monthly or annual basis. Prices are displayed in US dollars unless otherwise stated.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Annual subscriptions may be offered at a discounted rate as set by the administrator.</li>
          <li>Subscription fees are non-refundable except where required by applicable law or at our sole discretion.</li>
          <li>We reserve the right to modify pricing with 30 days' advance notice to existing subscribers.</li>
          <li>If payment fails, your account may be downgraded to the Free tier after a grace period.</li>
        </ul>
        <p>
          You may upgrade, downgrade, or cancel your subscription at any time through the Billing section.
          Downgrades take effect at the end of the current billing period.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Acceptable Use" icon={<ShieldCheck className="w-4 h-4" />}>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Violate any applicable law, regulation, or third-party rights.</li>
          <li>Post, upload, or distribute content that is defamatory, obscene, threatening, harassing, or otherwise objectionable.</li>
          <li>Distribute spam, unsolicited messages, or bulk automated content through connected social platforms.</li>
          <li>Attempt to gain unauthorised access to the Service, other user accounts, or connected systems.</li>
          <li>Reverse-engineer, decompile, or disassemble the Service or its underlying technology.</li>
          <li>Use the Service to infringe any intellectual property rights.</li>
          <li>Use automated means (bots, scrapers) to access the Service except through our official API.</li>
        </ul>
        <p>We reserve the right to remove content and suspend accounts that violate this policy without prior notice.</p>
      </LegalSection>

      <LegalSection number="6" title="User Content" icon={<FileText className="w-4 h-4" />}>
        <p>
          You retain ownership of all Content you upload to the Service. By uploading Content, you grant us a limited,
          non-exclusive, royalty-free licence to store, process, and transmit your Content solely for the purpose of
          providing the Service (e.g., scheduling posts to your connected social media accounts).
        </p>
        <p>
          You are solely responsible for all Content you post and for ensuring it complies with applicable laws and the
          terms of service of connected social media platforms.
        </p>
      </LegalSection>

      <LegalSection number="7" title="Media Retention" icon={<Image className="w-4 h-4" />}>
        <p>To optimise storage costs, post attachments are retained for a limited time after a post is published:</p>
        <div className="grid grid-cols-2 gap-3 my-2">
          <div className="rounded-xl bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">30</p>
            <p className="text-xs text-blue-600/70 font-medium">days for images</p>
          </div>
          <div className="rounded-xl bg-purple-50 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">20</p>
            <p className="text-xs text-purple-600/70 font-medium">days for videos</p>
          </div>
        </div>
        <p>
          After the retention period, media files may be permanently deleted from our storage.
          Your published social post remains available on the destination platform. This policy
          applies to post media only and does not apply to site assets (logo, favicon, branding images).
        </p>
      </LegalSection>

      <LegalSection number="8" title="AI-Generated Content" icon={<Sparkles className="w-4 h-4" />}>
        <p>
          The Service includes AI-powered features (caption generation, hashtag suggestions, content ideas).
          AI-generated content is provided "as is" and may not always be accurate, appropriate, or suitable for your purpose.
          You are responsible for reviewing and editing AI-generated content before publishing.
        </p>
        <p>
          We do not guarantee the originality of AI-generated content and disclaim any liability for claims arising
          from its use, including intellectual property disputes.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Third-Party Integrations" icon={<Link2 className="w-4 h-4" />}>
        <p>
          The Service connects to third-party social media platforms (Facebook, Instagram, X/Twitter, LinkedIn,
          TikTok, YouTube, Pinterest, and others). Your use of these integrations is subject to the respective
          platform's terms of service and privacy policies.
        </p>
        <p>
          We are not responsible for changes to third-party APIs, service disruptions, or the actions of third-party
          platforms that may affect the functionality of the Service.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Intellectual Property" icon={<Scale className="w-4 h-4" />}>
        <p>
          The Service, including its software, design, logos, and documentation, is the intellectual property of
          EntreprenrEducation and is protected by copyright, trademark, and other intellectual property laws.
          You may not reproduce, distribute, or create derivative works from any part of the Service without
          our prior written consent.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Limitation of Liability" icon={<AlertTriangle className="w-4 h-4" />}>
        <p>
          To the maximum extent permitted by law, EntreprenrEducation shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunities
          arising from your use of the Service.
        </p>
        <p>
          Our total aggregate liability for any claims arising from or related to the Service shall not exceed the
          amount you paid to us in the twelve (12) months preceding the claim.
        </p>
      </LegalSection>

      <LegalSection number="12" title="Indemnification" icon={<Shield className="w-4 h-4" />}>
        <p>
          You agree to indemnify and hold harmless EntreprenrEducation, its officers, directors, employees, and agents
          from any claims, losses, liabilities, damages, costs, and expenses (including legal fees) arising from your
          use of the Service, your Content, or your violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection number="13" title="Termination" icon={<Pencil className="w-4 h-4" />}>
        <p>
          You may terminate your Account at any time by contacting us at{' '}
          <a href="mailto:contact@entreprenreducation.com" className="text-brand-blue hover:underline">contact@entreprenreducation.com</a>.
          We may suspend or terminate your Account if you breach these Terms, with or without notice.
        </p>
        <p>
          Upon termination, your right to use the Service ceases immediately. We may retain certain data as required
          by law or for legitimate business purposes.
        </p>
      </LegalSection>

      <LegalSection number="14" title="Modifications to Terms" icon={<RefreshCw className="w-4 h-4" />}>
        <p>
          We reserve the right to update these Terms at any time. Material changes will be communicated via email
          or through a notice on the Service. Continued use of the Service after changes take effect constitutes
          acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection number="15" title="Governing Law & Disputes" icon={<Gavel className="w-4 h-4" />}>
        <p>
          These Terms are governed by and construed in accordance with the laws of England and Wales.
          Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.
        </p>
      </LegalSection>

      <LegalSection number="16" title="Contact" icon={<Mail className="w-4 h-4" />}>
        <p>If you have questions about these Terms, please contact us:</p>
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
