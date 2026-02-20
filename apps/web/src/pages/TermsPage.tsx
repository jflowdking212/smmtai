import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Sparkles } from 'lucide-react';

export function TermsPage() {
  const { settings } = useSiteSettings();
  const siteName = settings.site_title || 'Postmind';

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <Link to="/" className="text-sm text-brand-blue hover:underline">
          &larr; Back to {siteName}
        </Link>

        <div className="flex items-center gap-2">
          {settings.site_logo ? (
            <img src={settings.site_logo} alt={siteName} className="w-8 h-8 object-contain rounded-lg" />
          ) : (
            <Sparkles className="w-7 h-7 text-blue-500" />
          )}
          <h1 className="text-3xl font-heading font-bold text-neutral-900">Terms &amp; Conditions</h1>
        </div>

        <div className="space-y-4 text-sm text-neutral-700 leading-relaxed">
          <p>
            This page includes important information about how we store and retain media uploaded for social posts through {siteName}.
          </p>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">Media retention</h2>
            <p>
              To optimize storage costs, post attachments are retained for a limited time after a post is published:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Images</strong>: up to <strong>30 days</strong> after posting</li>
              <li><strong>Videos</strong>: up to <strong>20 days</strong> after posting</li>
            </ul>
            <p>
              After the retention period, the media files may be permanently deleted from our storage.
              Your published social post remains available on the social platform (Facebook, Instagram, X, etc.),
              and our system keeps a reference to the published post details.
            </p>
            <p className="text-xs text-neutral-500">
              This retention policy applies to <strong>post media</strong> only and does not apply to site assets like your logo, favicon, or other branding images.
            </p>
          </div>

          <p className="text-xs text-neutral-500">
            We may update these terms from time to time. Continued use of the service indicates acceptance of the latest version.
          </p>
        </div>
      </div>
    </div>
  );
}
