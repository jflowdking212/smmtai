import { useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import {
  BookOpen, Search, MessageSquare, Video,
  ChevronRight, ExternalLink, HelpCircle,
  PenSquare, Calendar, BarChart3, Link2,
  Palette, Sparkles, Shield, Zap,
} from 'lucide-react';

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
}

const CATEGORIES = ['Getting Started', 'Features', 'Integrations', 'Account & Billing', 'Troubleshooting'];

const ARTICLES: HelpArticle[] = [
  { id: 'gs-1', title: 'Quick Start Guide', description: 'Learn the basics of EE PostMind in 5 minutes — connect accounts, create posts, and schedule content.', category: 'Getting Started', icon: <Zap className="w-5 h-5" /> },
  { id: 'gs-2', title: 'Connecting Social Media Accounts', description: 'Step-by-step guide to link your Facebook, Instagram, Twitter/X, LinkedIn, TikTok, and other platforms.', category: 'Getting Started', icon: <Link2 className="w-5 h-5" /> },
  { id: 'gs-3', title: 'Your First Post', description: 'Create, preview, and publish your first post across multiple platforms simultaneously.', category: 'Getting Started', icon: <PenSquare className="w-5 h-5" /> },
  { id: 'f-1', title: 'Post Composer', description: 'Write platform-specific captions, add media, preview layouts, and publish or schedule posts.', category: 'Features', icon: <PenSquare className="w-5 h-5" /> },
  { id: 'f-2', title: 'Content Calendar', description: 'View scheduled posts in month or week view, drag-and-drop to reschedule, and manage your content pipeline.', category: 'Features', icon: <Calendar className="w-5 h-5" /> },
  { id: 'f-3', title: 'Design Editor', description: 'Create stunning graphics with the built-in Fabric.js editor — templates, shapes, text, images, and more.', category: 'Features', icon: <Palette className="w-5 h-5" /> },
  { id: 'f-4', title: 'AI Assistant', description: 'Generate captions, hashtags, and content ideas using AI. Configure brand voice and audience personas.', category: 'Features', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'f-5', title: 'Analytics Dashboard', description: 'Track engagement, reach, and performance metrics. Get AI-driven insights and recommendations.', category: 'Features', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'i-1', title: 'Platform API Setup', description: 'Configure API keys and OAuth credentials for each social media platform integration.', category: 'Integrations', icon: <Link2 className="w-5 h-5" /> },
  { id: 'i-2', title: 'Webhook Notifications', description: 'Set up webhook endpoints to receive real-time notifications about post status changes.', category: 'Integrations', icon: <Zap className="w-5 h-5" /> },
  { id: 'ab-1', title: 'Managing Your Subscription', description: 'Upgrade, downgrade, or cancel your plan. View billing history and download invoices.', category: 'Account & Billing', icon: <Shield className="w-5 h-5" /> },
  { id: 'ab-2', title: 'Team Management', description: 'Invite team members, assign roles (Admin, Editor, Viewer), and manage workspace permissions.', category: 'Account & Billing', icon: <Shield className="w-5 h-5" /> },
  { id: 't-1', title: 'Post Publishing Failures', description: 'Common reasons why posts fail to publish and how to resolve them — token expiry, API limits, media issues.', category: 'Troubleshooting', icon: <HelpCircle className="w-5 h-5" /> },
  { id: 't-2', title: 'Connection Issues', description: 'Steps to reconnect disconnected accounts and troubleshoot OAuth authentication problems.', category: 'Troubleshooting', icon: <HelpCircle className="w-5 h-5" /> },
];

const FAQ = [
  { q: 'How many social accounts can I connect?', a: 'Depends on your plan: Free (3), Pro (15), Business (unlimited).' },
  { q: 'Does EE PostMind post directly or via third-party?', a: 'We post directly via official platform APIs — no intermediaries.' },
  { q: 'Can I schedule posts in different time zones?', a: 'Yes! Set your default timezone in Settings or override per-post in the scheduler.' },
  { q: 'Is my data secure?', a: 'All data is encrypted at rest and in transit. OAuth tokens are stored encrypted. We never store your social media passwords.' },
  { q: 'How does the AI assistant work?', a: 'We use OpenAI GPT models to generate captions, hashtags, and content suggestions based on your brand voice and audience.' },
];

export function HelpPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Getting Started');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filtered = ARTICLES.filter((a) => {
    const matchesCategory = a.category === activeCategory;
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-heading font-bold text-neutral-900">Help Center</h1>
        <p className="text-sm text-neutral-500 mt-1">Find answers, learn features, and get the most out of EE PostMind.</p>

        {/* Search */}
        <div className="mt-4 max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search help articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <BookOpen className="w-5 h-5" />, label: 'Documentation', sub: 'Guides & tutorials' },
          { icon: <Video className="w-5 h-5" />, label: 'Video Tutorials', sub: 'Watch & learn' },
          { icon: <MessageSquare className="w-5 h-5" />, label: 'Community', sub: 'Ask questions' },
          { icon: <HelpCircle className="w-5 h-5" />, label: 'Contact Support', sub: 'Get help' },
        ].map((link) => (
          <Card key={link.label} className="p-4 hover:border-brand-blue/30 transition-colors cursor-pointer group">
            <div className="text-brand-blue mb-2">{link.icon}</div>
            <p className="text-sm font-medium text-neutral-800 group-hover:text-brand-blue">{link.label}</p>
            <p className="text-xs text-neutral-500">{link.sub}</p>
          </Card>
        ))}
      </div>

      {/* Category tabs + articles */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${activeCategory === cat ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {filtered.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-8">No articles found.</p>
          )}
          {filtered.map((article) => (
            <Card key={article.id} className="p-4 hover:border-brand-blue/20 transition-colors cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
                  {article.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-neutral-800 group-hover:text-brand-blue">{article.title}</h3>
                    <Badge variant="default" className="text-[10px]">{article.category}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{article.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-brand-blue shrink-0 mt-1" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-neutral-800 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQ.map((faq, i) => (
            <Card
              key={i}
              className="overflow-hidden cursor-pointer"
              onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
            >
              <div className="p-4 flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-800">{faq.q}</p>
                <ChevronRight className={`w-4 h-4 text-neutral-400 transition-transform ${expandedFaq === i ? 'rotate-90' : ''}`} />
              </div>
              {expandedFaq === i && (
                <div className="px-4 pb-4 text-sm text-neutral-600 border-t border-neutral-100 pt-3">
                  {faq.a}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Contact */}
      <Card className="p-6 text-center bg-gradient-to-r from-brand-blue/5 to-transparent border-brand-blue/20">
        <h3 className="text-sm font-semibold text-neutral-800">Still need help?</h3>
        <p className="text-xs text-neutral-500 mt-1">Our support team is available Monday–Friday, 9 AM–6 PM EST.</p>
        <div className="flex justify-center gap-3 mt-3">
          <Button size="sm"><MessageSquare className="w-3.5 h-3.5" /> Chat with Us</Button>
          <Button variant="secondary" size="sm"><ExternalLink className="w-3.5 h-3.5" /> Email Support</Button>
        </div>
      </Card>
    </div>
  );
}
