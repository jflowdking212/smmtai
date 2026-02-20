import { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';
import {
  BookOpen, Search, MessageSquare, Video,
  ChevronRight, ChevronDown, ExternalLink, HelpCircle,
  PenSquare, Calendar, BarChart3, Link2,
  Palette, Sparkles, Shield, Zap, Share2, FileText, Tag,
} from 'lucide-react';

interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  isActive: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Getting Started': <Zap className="w-5 h-5" />,
  'Features': <Sparkles className="w-5 h-5" />,
  'Integrations': <Link2 className="w-5 h-5" />,
  'Social Media Guides': <Share2 className="w-5 h-5" />,
  'Account & Billing': <Shield className="w-5 h-5" />,
  'Troubleshooting': <HelpCircle className="w-5 h-5" />,
  'FAQ': <MessageSquare className="w-5 h-5" />,
  'Tutorials': <Video className="w-5 h-5" />,
  'Documentation': <BookOpen className="w-5 h-5" />,
};

const STATIC_FAQ = [
  { q: 'How many social accounts can I connect?', a: 'Depends on your plan: Free (3), Pro (15), Business (unlimited).' },
  { q: 'Does EE PostMind post directly or via third-party?', a: 'We post directly via official platform APIs — no intermediaries.' },
  { q: 'Can I schedule posts in different time zones?', a: 'Yes! Set your default timezone in Settings or override per-post in the scheduler.' },
  { q: 'Is my data secure?', a: 'All data is encrypted at rest and in transit. OAuth tokens are stored encrypted. We never store your social media passwords.' },
  { q: 'How does the AI assistant work?', a: 'We use OpenAI GPT models to generate captions, hashtags, and content suggestions based on your brand voice and audience.' },
  { q: 'How do I reconnect an expired social account?', a: 'Go to Connections, click the disconnected account, and follow the re-authorization flow. Tokens refresh automatically when possible.' },
  { q: 'Can I manage multiple brands or clients?', a: 'Yes! Create separate workspaces for each brand. Business and Enterprise plans support multiple workspaces with team roles.' },
];

// Quick-action sections with embedded educational content
const QUICK_SECTIONS = [
  {
    icon: <BookOpen className="w-6 h-6" />,
    label: 'Documentation',
    sub: 'Guides & tutorials',
    color: 'brand-blue',
    items: [
      { title: 'Quick Start Guide', desc: 'Learn the basics of EE PostMind in 5 minutes — connect accounts, create posts, and schedule content.' },
      { title: 'Connecting Social Accounts', desc: 'Step-by-step guide to link your Facebook, Instagram, Twitter/X, LinkedIn, TikTok, and other platforms.' },
      { title: 'Your First Post', desc: 'Create, preview, and publish your first post across multiple platforms simultaneously.' },
      { title: 'Post Composer', desc: 'Write platform-specific captions, add media, preview layouts, and publish or schedule posts.' },
      { title: 'Content Calendar', desc: 'View scheduled posts in month or week view, drag-and-drop to reschedule, and manage your content pipeline.' },
      { title: 'Design Editor', desc: 'Create stunning graphics with the built-in editor — templates, shapes, text, images, and more.' },
    ],
  },
  {
    icon: <Video className="w-6 h-6" />,
    label: 'Video Tutorials',
    sub: 'Watch & learn',
    color: 'purple-600',
    items: [
      { title: 'Getting Started with EE PostMind', desc: 'A walkthrough of the dashboard, navigation, and core features to get you up and running.' },
      { title: 'How to Schedule Posts', desc: 'Learn how to compose, schedule, and manage posts across multiple platforms from a single view.' },
      { title: 'Using the AI Assistant', desc: 'Generate captions, hashtags, and content ideas using AI. Configure brand voice and audience personas.' },
      { title: 'Analytics & Reporting', desc: 'Track engagement, reach, and performance metrics. Get AI-driven insights and recommendations.' },
      { title: 'Managing Team & Workspaces', desc: 'Invite team members, assign roles, and organize content by workspace for multiple brands or clients.' },
    ],
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    label: 'Community',
    sub: 'Ask questions',
    color: 'green-600',
    items: [
      { title: 'Best Practices for Posting', desc: 'Community-curated tips on optimal posting times, caption length, and engagement strategies per platform.' },
      { title: 'Content Ideas & Inspiration', desc: 'Browse trending content formats, seasonal campaigns, and creative post ideas shared by other users.' },
      { title: 'Platform Updates & News', desc: 'Stay informed about social media API changes, new feature launches, and platform policy updates.' },
      { title: 'Feature Requests', desc: 'Vote on upcoming features, suggest improvements, and see what the community wants next.' },
    ],
  },
  {
    icon: <HelpCircle className="w-6 h-6" />,
    label: 'Contact Support',
    sub: 'Get help',
    color: 'orange-500',
    items: [
      { title: 'Post Publishing Failures', desc: 'Common reasons why posts fail to publish and how to resolve them — token expiry, API limits, media issues.' },
      { title: 'Connection Issues', desc: 'Steps to reconnect disconnected accounts and troubleshoot OAuth authentication problems.' },
      { title: 'Billing & Plan Changes', desc: 'How to upgrade, downgrade, or cancel your plan. View billing history and download invoices.' },
      { title: 'Platform API Setup', desc: 'Configure API keys and OAuth credentials for each social media platform integration.' },
    ],
  },
];

export function HelpPage() {
  const [search, setSearch] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [activeKbCategory, setActiveKbCategory] = useState<string>('All');

  useEffect(() => {
    api.chat.getKnowledge({ isActive: 'true' })
      .then((res) => setKbArticles(res.data || []))
      .catch(() => {})
      .finally(() => setKbLoading(false));
  }, []);

  const kbCategories = ['All', ...Array.from(new Set(kbArticles.map((a) => a.category || 'General').filter(Boolean)))];

  const filteredKb = kbArticles.filter((a) => {
    const matchesCategory = activeKbCategory === 'All' || (a.category || 'General') === activeKbCategory;
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredFaq = STATIC_FAQ.filter(
    (f) => !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">Help Center</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Find answers, learn features, and get the most out of EE PostMind.</p>

        <div className="mt-4 max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search articles, guides, and FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
        </div>
      </div>

      {/* Resource sections — expandable cards with real content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_SECTIONS.map((section, idx) => {
          const isExpanded = expandedSection === idx;
          const sectionItems = section.items.filter(
            (item) => !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase())
          );
          if (search && sectionItems.length === 0) return null;

          return (
            <Card
              key={section.label}
              className={`overflow-hidden transition-all ${isExpanded ? 'md:col-span-2' : ''}`}
            >
              <button
                onClick={() => setExpandedSection(isExpanded ? null : idx)}
                className="w-full p-5 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
              >
                <div className={`w-12 h-12 rounded-xl bg-${section.color}/10 flex items-center justify-center text-${section.color} shrink-0`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{section.label}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{section.sub} · {sectionItems.length} articles</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-neutral-100 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-700">
                  {sectionItems.map((item, i) => (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <FileText className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.title}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Knowledge Base articles from admin */}
      {!kbLoading && kbArticles.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-semibold text-neutral-800 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-blue" /> Knowledge Base
          </h2>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {kbCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveKbCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${activeKbCategory === cat ? 'bg-brand-blue text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {filteredKb.length === 0 && (
              <p className="text-sm text-neutral-400 text-center py-6">No articles found.</p>
            )}
            {filteredKb.map((article) => (
              <Card
                key={article.id}
                className="overflow-hidden hover:border-brand-blue/20 transition-colors cursor-pointer"
                onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
              >
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
                    {CATEGORY_ICONS[article.category || ''] || <FileText className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{article.title}</h3>
                      {article.category && <Badge variant="default" className="text-[10px]">{article.category}</Badge>}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{article.content.substring(0, 200)}{article.content.length > 200 ? '…' : ''}</p>
                    {article.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {article.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
                            <Tag className="w-2.5 h-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 text-neutral-300 shrink-0 mt-1 transition-transform ${expandedArticle === article.id ? 'rotate-90' : ''}`} />
                </div>
                {expandedArticle === article.id && (
                  <div className="px-4 pb-4 border-t border-neutral-100 dark:border-neutral-700 pt-3">
                    <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{article.content}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {kbLoading && (
        <div className="text-center py-6">
          <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 mt-2">Loading articles…</p>
        </div>
      )}

      {/* FAQ */}
      {filteredFaq.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-semibold text-neutral-800 dark:text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {filteredFaq.map((faq, i) => (
              <Card
                key={i}
                className="overflow-hidden cursor-pointer"
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                <div className="p-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{faq.q}</p>
                  <ChevronRight className={`w-4 h-4 text-neutral-400 transition-transform ${expandedFaq === i ? 'rotate-90' : ''}`} />
                </div>
                {expandedFaq === i && (
                  <div className="px-4 pb-4 text-sm text-neutral-600 dark:text-neutral-300 border-t border-neutral-100 dark:border-neutral-700 pt-3">
                    {faq.a}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <Card className="p-6 text-center bg-gradient-to-r from-brand-blue/5 to-transparent border-brand-blue/20">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Still need help?</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Our support team is available Monday–Friday, 9 AM–6 PM EST.</p>
        <div className="flex justify-center gap-3 mt-3">
          <Button size="sm" onClick={() => window.dispatchEvent(new Event('open-chatbot'))}><MessageSquare className="w-3.5 h-3.5" /> Chat with Us</Button>
          <a href="mailto:support@smmt.entreprenreducation.com">
            <Button variant="secondary" size="sm"><ExternalLink className="w-3.5 h-3.5" /> Email Support</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
