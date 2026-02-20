/**
 * Seed the EE PostMind knowledge base with comprehensive articles.
 * Run: node scripts/seed-kb.mjs <email> <password>
 */

const API_BASE = 'http://localhost:4016/api/v1';

async function getToken() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.argv[2], password: process.argv[3] }),
  });
  const data = await res.json();
  if (!data.data?.accessToken) {
    console.error('Login failed. Usage: node scripts/seed-kb.mjs <email> <password>');
    console.error('Response:', data);
    process.exit(1);
  }
  return data.data.accessToken;
}

const coreArticles = [
  {
    title: 'What is EE PostMind?',
    content: `EE PostMind is an AI-powered social media management platform that helps creators, teams, and agencies create, schedule, and publish content across 13+ social media platforms from a single dashboard.\n\nKey features include:\n• AI Content Generation — Generate captions, hashtags, blog posts, and content ideas using advanced AI models\n• Visual Design Editor — Create stunning graphics with a built-in Fabric.js editor (templates, shapes, text, images)\n• Smart Scheduling — Plan and schedule posts with an intuitive calendar view, optimal time suggestions\n• Multi-Platform Publishing — Publish simultaneously to Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest, Threads, Mastodon, Bluesky, Tumblr, Reddit, and Google Business Profile\n• Analytics Dashboard — Track engagement, reach, impressions, and growth across all channels\n• Team Collaboration — Invite team members, assign roles (Admin, Editor, Viewer), manage approval workflows\n• AI Chatbot Assistant — Get instant help and answers from our AI-powered chatbot\n• Knowledge Base — Comprehensive guides and tutorials for all features\n\nEE PostMind is designed to save you time and help you grow your social media presence with intelligent automation and beautiful content creation tools.`,
    category: 'General',
    tags: ['overview', 'about', 'what is', 'features', 'platform', 'introduction', 'ee postmind'],
    priority: 10,
  },
  {
    title: 'EE PostMind Pricing Plans',
    content: `EE PostMind offers four pricing tiers:\n\nFree Plan — $0/forever: 3 social accounts, 30 posts/month, 10 AI generations, 1 team member, 7-day analytics, basic templates, email support.\n\nPro Plan — $19/month: 10 social accounts, 300 posts/month, 100 AI generations, 3 team members, 30-day analytics, all templates, priority support, content calendar, hashtag suggestions.\n\nBusiness Plan — $49/month: 25 social accounts, unlimited posts, 500 AI generations, 10 team members, 90-day analytics, custom branding, advanced analytics, API access, dedicated account manager.\n\nEnterprise Plan — Custom pricing: Unlimited everything, custom integrations, dedicated support, SLA guarantees, on-premise deployment option.\n\nAll plans include a 14-day free trial. No credit card required for the Free plan. Upgrade or downgrade any time from the Billing page.`,
    category: 'General',
    tags: ['pricing', 'plans', 'cost', 'subscription', 'free', 'pro', 'business', 'enterprise', 'billing', 'upgrade', 'how much', 'price'],
    priority: 9,
  },
  {
    title: 'Getting Started with EE PostMind',
    content: `Get started with EE PostMind in 5 simple steps:\n\nStep 1: Create Your Account — Sign up with email or use Google/GitHub OAuth. Verify your email.\n\nStep 2: Set Up Your Workspace — Your workspace is created automatically after login. Customize in Settings.\n\nStep 3: Connect Social Media Accounts — Go to Connections, click "Add Connection", select a platform, follow the OAuth flow.\n\nStep 4: Create Your First Post — Navigate to Compose, write your caption (or use AI), add media, select platforms, publish or schedule.\n\nStep 5: Monitor Performance — Check Analytics for engagement, reach, and growth. Dashboard shows recent activity.\n\nQuick Tips: Use AI Assistant for content ideas. Set your timezone in Settings → Profile. Use Templates to save reusable formats. Check Calendar for content overview.`,
    category: 'Getting Started',
    tags: ['getting started', 'quick start', 'setup', 'first steps', 'beginner', 'tutorial', 'how to start', 'new user', 'onboarding'],
    priority: 9,
  },
  {
    title: 'Dashboard Overview',
    content: `The EE PostMind Dashboard is your command center:\n\nRecent Posts — View latest published and scheduled posts with engagement metrics.\nQuick Stats — Total posts, engagement rate, follower growth, connected accounts at a glance.\nUpcoming Scheduled — Posts scheduled for the next 7 days.\nQuick Actions — Buttons to compose, view calendar, or check analytics.\nActivity Feed — Recent actions and notifications.\n\nThe Dashboard updates in real-time. Click any post to view details or edit it. Use sidebar navigation to access all features.`,
    category: 'Features',
    tags: ['dashboard', 'home', 'overview', 'stats', 'activity', 'main page'],
    priority: 7,
  },
  {
    title: 'Navigating EE PostMind',
    content: `EE PostMind sidebar navigation sections:\n\n• Dashboard — Overview of your social media activity\n• Compose — Create new posts with AI assistance\n• Post History — View all past and scheduled posts\n• Calendar — Visual content calendar (month/week view)\n• Analytics — Performance metrics and insights\n• Connections — Manage linked social media accounts\n• Templates — Save and reuse post templates\n• AI Assistant — AI-powered content generation tools\n• Conversations — View and manage chat conversations (admin)\n• Knowledge Base — Manage chatbot knowledge articles (admin)\n• Settings — Profile, notifications, security, appearance, admin\n• Billing — Subscription management and invoices\n• Help — Knowledge base, FAQ, and support\n\nThe sidebar can be collapsed for more screen space. On mobile, use the hamburger menu.`,
    category: 'Features',
    tags: ['navigation', 'sidebar', 'menu', 'where to find', 'how to navigate', 'layout', 'find feature'],
    priority: 6,
  },
  {
    title: 'Composing Posts',
    content: `Create and publish content on the Compose page:\n\nWriting Your Post: Enter caption in the editor. Use AI button to generate captions, hashtags, or rewrite text. Add media (images, videos) by clicking upload or dragging files. Preview how post looks on each platform.\n\nPlatform Selection and Limits:\n• Twitter/X: 280 chars, 4 images or 1 video\n• Instagram: 2,200 chars, up to 10 images/videos\n• Facebook: 63,206 chars, images/videos\n• LinkedIn: 3,000 chars, images/videos/documents\n• TikTok: Video only, up to 10 minutes\n• YouTube: Video with title and description\n• Pinterest: Image with 500-char description\n\nPublishing Options: Publish Now (immediate), Schedule (pick date/time), Save as Draft.\n\nAI Features: Generate Caption, Suggest Hashtags, Rewrite (professional/casual/funny), Translate to other languages.`,
    category: 'Features',
    tags: ['compose', 'create post', 'write', 'publish', 'schedule', 'caption', 'content creation', 'new post', 'how to post', 'make a post'],
    priority: 8,
  },
  {
    title: 'AI Content Generation',
    content: `EE PostMind AI Assistant helps create better content faster:\n\nCaption Generator — Describe your topic, AI generates platform-optimized captions. Specify tone (professional, casual, humorous, inspiring), length, target platform, emojis/hashtags, brand voice.\n\nHashtag Suggestions — Enter topic, get relevant trending hashtags sorted by popularity.\n\nContent Ideas — AI suggests post topics, trending topics, content calendar ideas, holiday/event content.\n\nImage Generation — Describe what you want, AI creates images in various styles.\n\nText Rewriting — Paste text, AI rewrites in different tones, expands, condenses, or adapts for platforms.\n\nUsage Limits: Free 10/month, Pro 100/month, Business 500/month, Enterprise unlimited.\n\nAccess from sidebar (AI Assistant) or use AI button while composing posts.`,
    category: 'Features',
    tags: ['ai', 'artificial intelligence', 'generate', 'content', 'caption', 'hashtags', 'ideas', 'rewrite', 'gpt', 'openai', 'assistant', 'ai writer', 'auto generate'],
    priority: 8,
  },
  {
    title: 'Scheduling Posts',
    content: `Schedule posts to publish automatically:\n\nHow to Schedule: Create post in Compose, click "Schedule" instead of "Publish Now", select date/time, choose timezone, click "Schedule Post".\n\nBest Times by Platform:\n• Facebook: 1-4 PM weekdays\n• Instagram: 11 AM-1 PM and 7-9 PM\n• Twitter/X: 8-10 AM and 6-9 PM\n• LinkedIn: 7-8 AM and 5-6 PM weekdays\n• TikTok: 7-9 AM and 7-11 PM\n• Pinterest: 8-11 PM weekends\n\nManaging Scheduled Posts: View in Post History (filter "Scheduled"). Use Calendar view for visual overview. Drag and drop in Calendar to reschedule. Click to edit or cancel.\n\nRecurring Posts: Set repeat schedule (daily, weekly, monthly) for evergreen content.\n\nQueue System: Add to queue, EE PostMind publishes at pre-set optimal times.`,
    category: 'Features',
    tags: ['schedule', 'scheduling', 'calendar', 'when to post', 'best time', 'queue', 'recurring', 'auto post', 'timer', 'plan', 'automate'],
    priority: 8,
  },
  {
    title: 'Design Editor',
    content: `EE PostMind includes a powerful visual design editor:\n\nCanvas Presets: Instagram Post 1080×1080, Instagram Story 1080×1920, Facebook 1200×630, Twitter 1200×675, LinkedIn 1200×627, Pinterest 1000×1500, YouTube Thumbnail 1280×720, TikTok 1080×1920.\n\nDesign Tools: Text (fonts, colors, sizes, shadow), Shapes (rectangles, circles, lines, arrows), Images (upload or stock), Layers (arrange elements), Alignment (snap to grid, center), Templates (pre-designed), Undo/Redo, Export (PNG, JPEG, PDF).\n\nTips: Use consistent brand colors. Keep text readable. Leave space for platform UI. Use grid/alignment for professional layouts.`,
    category: 'Features',
    tags: ['design', 'editor', 'create image', 'graphic', 'canvas', 'template', 'visual', 'image editor', 'photo editor'],
    priority: 7,
  },
  {
    title: 'Analytics Dashboard',
    content: `Track performance with EE PostMind Analytics:\n\nOverview Metrics: Total reach, engagement rate, follower growth, post performance.\n\nPlatform Breakdown: Impressions, reach, engagement per post. Audience demographics. Best content types. Growth trends.\n\nTime-Based: Daily, weekly, monthly views. Compare periods. Identify trends. Export as PDF/CSV.\n\nAI Insights: Best posting times for YOUR audience. Best content types. Top hashtags. Optimal posting frequency.\n\nRetention: Free 7 days, Pro 30 days, Business 90 days, Enterprise unlimited.`,
    category: 'Features',
    tags: ['analytics', 'metrics', 'performance', 'engagement', 'reach', 'impressions', 'followers', 'growth', 'insights', 'reports', 'statistics', 'data', 'stats'],
    priority: 7,
  },
  {
    title: 'Using Templates',
    content: `Templates help maintain consistency and save time:\n\nCreating: Go to Templates, click "Create Template", enter name/description/content, add variables like {{product_name}}, {{date}}, save.\n\nUsing: In Compose, click "Use Template", select template, fill in variables, customize, publish/schedule.\n\nCategories: Product announcements, blog promotions, events, testimonials, behind-the-scenes, tips, seasonal content.\n\nTips: Create platform-specific versions. Use for recurring content. Save best posts as templates. Share with team.`,
    category: 'Features',
    tags: ['templates', 'reuse', 'save', 'template', 'placeholder', 'preset', 'brand consistency'],
    priority: 6,
  },
  {
    title: 'Team Collaboration',
    content: `EE PostMind supports team collaboration:\n\nRoles: Owner (full access + billing), Admin (manage content/connections/team), Editor (create/edit/schedule posts), Viewer (read-only).\n\nInviting: Settings → Team → Invite Member → enter email + select role.\n\nApproval Workflows (Business/Enterprise): Editors submit for review, Admins approve/reject with comments.\n\nLimits: Free 1 member, Pro 3, Business 10, Enterprise unlimited.\n\nWorkspace: Each workspace has own connections, posts, analytics. Business/Enterprise support multiple workspaces for different brands/clients.`,
    category: 'Features',
    tags: ['team', 'collaboration', 'invite', 'roles', 'permissions', 'workspace', 'members', 'approval', 'admin', 'editor', 'viewer', 'add user', 'invite member'],
    priority: 7,
  },
  {
    title: 'Connecting Social Media Accounts — Overview',
    content: `EE PostMind supports 13 platforms. To connect:\n\n1. Go to Connections\n2. Click "Add Connection"\n3. Select platform\n4. Follow OAuth flow\n5. Grant permissions\n\nSupported: Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest, Threads, Mastodon, Bluesky, Tumblr, Reddit, Google Business Profile.\n\nLimits: Free 3 accounts, Pro 10, Business 25, Enterprise unlimited.\n\nTroubleshooting: "Disconnected" → click to re-authorize. Tokens auto-refresh when possible. Need admin access for business pages.`,
    category: 'Connections',
    tags: ['connect', 'connection', 'social media', 'link account', 'add account', 'platforms', 'oauth', 'authorize', 'how many accounts'],
    priority: 9,
  },
  {
    title: 'Connecting Facebook',
    content: `Connect Facebook to EE PostMind:\n\nPrereqs: Facebook account with admin access to the Page.\n\nSteps: Connections → Add Connection → Facebook → Connect → Log in → Select Pages → Grant permissions (pages_manage_posts, pages_read_engagement, pages_manage_metadata, pages_read_user_content) → Done.\n\nCapabilities: Text, photos, videos, links, Stories. Schedule posts. View engagement.\n\nSpecs: Text up to 63,206 chars. Up to 10 images. Videos up to 240 min/10GB. Recommended image: 1200×630.\n\nTips: Post 1-4 PM weekdays. MP4/MOV format for video.\n\nTroubleshooting: "Permission denied" → need Page admin. "Token expired" → re-authorize. "Page not found" → ensure published/active.`,
    category: 'Connections',
    tags: ['facebook', 'fb', 'meta', 'page', 'connect facebook', 'facebook api', 'facebook page', 'facebook group'],
    priority: 8,
  },
  {
    title: 'Connecting Instagram',
    content: `Connect Instagram to EE PostMind:\n\nPrereqs: Instagram Business or Creator account. Facebook Page linked to Instagram (required by Meta's API).\n\nConvert to Business: Instagram → Settings → Account → Switch to Professional → Choose Business/Creator → Connect Facebook Page.\n\nSteps: Connections → Add Connection → Instagram → Connect (via Facebook login) → Select linked Facebook Page → Grant permissions (instagram_basic, instagram_content_publish, instagram_manage_insights) → Select Instagram account → Confirm.\n\nCapabilities: Single images, carousels (up to 10), Reels. Schedule posts. View insights.\n\nSpecs: Images 1080×1080/1080×1350/1080×566. Videos 3-90s (Reels). Caption 2,200 chars. 30 hashtags max.\n\nTips: 1080px minimum width. Post Reels for max reach. Best times 11 AM-1 PM and 7-9 PM.\n\nTroubleshooting: "Not found" → needs Business/Creator account linked to Facebook Page. Same ratio for carousel images.`,
    category: 'Connections',
    tags: ['instagram', 'ig', 'insta', 'connect instagram', 'instagram api', 'reels', 'carousel', 'stories', 'instagram business'],
    priority: 8,
  },
  {
    title: 'Connecting Twitter/X',
    content: `Connect Twitter/X to EE PostMind:\n\nPrereqs: Twitter/X account. API access from developer.twitter.com.\n\nAPI Setup: developer.twitter.com → sign up → create Project/App → set callback URL → generate API Key/Secret/Access Token → enable OAuth 2.0 with PKCE.\n\nSteps: Connections → Add Connection → Twitter → Authorize → Grant permissions (tweet.read, tweet.write, users.read, offline.access).\n\nCapabilities: Tweets with text, images, videos, polls. Schedule. Threads. Engagement metrics.\n\nSpecs: 280 chars (premium 4,000). 4 images max (5MB each). Videos MP4 up to 2:20/512MB. GIFs 15MB. Polls 2-4 options.\n\nTips: 1-2 hashtags. Images get 2x engagement. Best times 8-10 AM and 6-9 PM.\n\nTroubleshooting: "Rate limit" → wait 15 min. "Auth failed" → regenerate keys. "Too long" → check char count with links.`,
    category: 'Connections',
    tags: ['twitter', 'x', 'tweet', 'connect twitter', 'twitter api', 'x api', 'tweets', 'threads', 'elon'],
    priority: 8,
  },
  {
    title: 'Connecting LinkedIn',
    content: `Connect LinkedIn to EE PostMind:\n\nPrereqs: LinkedIn account. For Company Pages: admin access required.\n\nSteps: Connections → Add Connection → LinkedIn → Connect → Log in → Grant permissions (r_liteprofile, r_organization_social, w_member_social, w_organization_social) → Select personal/company pages.\n\nCapabilities: Text, articles, images, videos, PDF documents (carousel). Schedule. Analytics.\n\nSpecs: 3,000 chars. Images 1200×627. Videos 3s-10min/5GB. PDF up to 300 pages.\n\nTips: Professional tone. Post 7-8 AM and 5-6 PM weekdays. PDF carousels get highest engagement. Tag people/companies.\n\nTroubleshooting: "Company page not found" → need admin access. "Rate limited" → 100 API calls/day.`,
    category: 'Connections',
    tags: ['linkedin', 'li', 'connect linkedin', 'linkedin api', 'company page', 'professional', 'linkedin post', 'business network'],
    priority: 8,
  },
  {
    title: 'Connecting TikTok',
    content: `Connect TikTok to EE PostMind:\n\nPrereqs: TikTok account. Developer Account at developers.tiktok.com. Content Posting API access (requires approval, 1-3 days).\n\nAPI Setup: developers.tiktok.com → create app → add Content Posting API → submit for review → get Client Key/Secret → set redirect URI.\n\nSteps: Connections → Add Connection → TikTok → Connect → Log in → Authorize (video.publish, video.list, user.info.basic).\n\nCapabilities: Upload/publish videos. Schedule. View performance.\n\nSpecs: Video only. MP4/WebM. 3s-10min. Max 4GB. Min 720p, recommended 1080×1920 (9:16).\n\nTips: Vertical 9:16 best. Under 60s for max engagement. Trending sounds/hashtags. Post 1-3x daily. Best times 7-9 AM and 7-11 PM.\n\nTroubleshooting: "App not approved" → wait for review. "Upload failed" → check format/size.`,
    category: 'Connections',
    tags: ['tiktok', 'tt', 'connect tiktok', 'tiktok api', 'video', 'short video', 'tiktok developer', 'viral'],
    priority: 8,
  },
  {
    title: 'Connecting YouTube',
    content: `Connect YouTube to EE PostMind:\n\nPrereqs: Google account with YouTube channel. Google Cloud project with YouTube Data API v3.\n\nAPI Setup: console.cloud.google.com → create project → enable YouTube Data API v3 → create OAuth 2.0 credentials → add callback URL → configure consent screen.\n\nSteps: Connections → Add Connection → YouTube → Connect → Log in to Google → Select channel → Grant permissions (youtube.upload, youtube.readonly, youtube).\n\nCapabilities: Upload videos with titles/descriptions/tags. Schedule. Set privacy. View analytics. Manage thumbnails.\n\nSpecs: MP4 recommended. Max 256GB/12hrs. Thumbnail 1280×720. Title 100 chars. Description 5,000 chars.\n\nTips: Custom thumbnails increase CTR 90%. Keywords in title/description. Consistent schedule. Best times Thursday-Friday afternoons.\n\nTroubleshooting: "Quota exceeded" → daily limits, wait for reset. "Channel not found" → ensure active YouTube channel.`,
    category: 'Connections',
    tags: ['youtube', 'yt', 'connect youtube', 'youtube api', 'video upload', 'google', 'youtube channel', 'vlog'],
    priority: 8,
  },
  {
    title: 'Connecting Pinterest',
    content: `Connect Pinterest to EE PostMind:\n\nPrereqs: Pinterest Business account (business.pinterest.com). Developer App (developers.pinterest.com).\n\nAPI Setup: developers.pinterest.com → create app → add callback URL → get App ID/Secret → request Content API access.\n\nSteps: Connections → Add Connection → Pinterest → Connect → Log in → Authorize (boards:read, pins:read, pins:write) → Select boards.\n\nCapabilities: Create pins with images/titles/descriptions/links. Schedule. Post to boards. Analytics.\n\nSpecs: Images 1000×1500 (2:3 ratio). Video 4s-15min. Title 100 chars. Description 500 chars.\n\nTips: Vertical 2:3 images best. Keywords in descriptions. Rich pins. Pin 5-15/day. Best times 8-11 PM weekends.\n\nTroubleshooting: "Board not found" → check not archived. "Rate limited" → spread posting.`,
    category: 'Connections',
    tags: ['pinterest', 'pin', 'connect pinterest', 'pinterest api', 'boards', 'pins', 'visual', 'inspiration'],
    priority: 7,
  },
  {
    title: 'Connecting Threads',
    content: `Connect Threads to EE PostMind:\n\nPrereqs: Threads account linked to Instagram. Threads API access through Meta developer platform.\n\nSteps: Connections → Add Connection → Threads → Connect via Meta OAuth → Grant posting/reading permissions.\n\nCapabilities: Text posts, image posts, link posts. Schedule. Engagement metrics.\n\nSpecs: 500 chars. Up to 10 images. Links auto-preview. @username mentions.\n\nTips: Conversational content works best. Cross-post from Twitter/X. Engage with replies.\n\nTroubleshooting: "Not found" → needs active Threads linked to Instagram. "API denied" → check Meta developer dashboard.`,
    category: 'Connections',
    tags: ['threads', 'meta threads', 'connect threads', 'threads api', 'instagram threads'],
    priority: 7,
  },
  {
    title: 'Connecting Mastodon',
    content: `Connect Mastodon to EE PostMind:\n\nPrereqs: Mastodon account on any instance.\n\nSteps: Connections → Add Connection → Mastodon → Enter instance URL (e.g. mastodon.social) → Connect → Log in → Authorize.\n\nCapabilities: Toots (posts) with text, images, polls. Schedule. Content warnings. Post visibility (public, unlisted, followers-only, direct).\n\nSpecs: 500 chars (varies by instance). Up to 4 images. Polls 2-4 options.\n\nTips: Use content warnings for sensitive topics. Hashtags important for discovery. Engage with community. Respect instance rules.\n\nTroubleshooting: "Instance not found" → check URL. "Auth failed" → some instances block third-party apps.`,
    category: 'Connections',
    tags: ['mastodon', 'fediverse', 'toot', 'connect mastodon', 'mastodon api', 'decentralized', 'instance'],
    priority: 6,
  },
  {
    title: 'Connecting Bluesky',
    content: `Connect Bluesky to EE PostMind:\n\nPrereqs: Bluesky account (bsky.app). App Password from Bluesky settings.\n\nSteps: Connections → Add Connection → Bluesky → Enter handle (e.g. username.bsky.social) → Go to Bluesky Settings → App Passwords → Create → Enter in EE PostMind → Connect.\n\nCapabilities: Posts with text, images, links. Schedule. Engagement metrics.\n\nSpecs: 300 chars. Up to 4 images. Links auto-embed. @handle mentions.\n\nTips: Posts are public by default (AT Protocol). Custom feeds for audiences. Hashtags in text.\n\nTroubleshooting: "Invalid credentials" → regenerate app password. "Handle not found" → include full handle with domain.`,
    category: 'Connections',
    tags: ['bluesky', 'bsky', 'at protocol', 'connect bluesky', 'bluesky api', 'skeet', 'app password'],
    priority: 6,
  },
  {
    title: 'Connecting Tumblr',
    content: `Connect Tumblr to EE PostMind:\n\nPrereqs: Tumblr account. API credentials from tumblr.com/oauth/apps.\n\nAPI Setup: tumblr.com/oauth/apps → Register app → Set callback URL → Get Consumer Key/Secret.\n\nSteps: Connections → Add Connection → Tumblr → Connect → Log in → Authorize.\n\nCapabilities: Text, photo, quote, link, chat, audio, video posts. Post to specific blogs. Schedule. Tags.\n\nSpecs: No text limit. Photos up to 10MB. Up to 30 tags.\n\nTips: Creative/visual content works best. Use tags extensively. Queue for consistency.\n\nTroubleshooting: "Blog not found" → check name/active. "Auth failed" → regenerate API keys.`,
    category: 'Connections',
    tags: ['tumblr', 'blog', 'connect tumblr', 'tumblr api', 'microblogging', 'creative'],
    priority: 6,
  },
  {
    title: 'Connecting Reddit',
    content: `Connect Reddit to EE PostMind:\n\nPrereqs: Reddit account. API access from reddit.com/prefs/apps.\n\nAPI Setup: reddit.com/prefs/apps → Create App → Choose "web app" → Set redirect URI → Note Client ID/Secret.\n\nSteps: Connections → Add Connection → Reddit → Connect → Log in → Authorize (submit, identity, read).\n\nCapabilities: Text posts, link posts to subreddits. Schedule. View performance.\n\nSpecs: Title 300 chars. Text 40,000 chars. Subreddit-specific flair.\n\nTips: Follow subreddit rules. Don't over-promote. Post 6-8 AM and 12-2 PM EST. Engage in comments.\n\nTroubleshooting: "Sub not found" → check spelling, not private. "Rate limited" → 1 post/10 min for new accounts. "Removed" → check sub rules.`,
    category: 'Connections',
    tags: ['reddit', 'subreddit', 'connect reddit', 'reddit api', 'upvote', 'post to reddit'],
    priority: 6,
  },
  {
    title: 'Connecting Google Business Profile',
    content: `Connect Google Business Profile to EE PostMind:\n\nPrereqs: Verified Google Business Profile. Google Cloud project with Business Profile API.\n\nAPI Setup: console.cloud.google.com → Enable Business Profile API → Create OAuth 2.0 credentials → Add callback URL.\n\nSteps: Connections → Add Connection → Google Business → Connect → Log in → Select business → Grant permissions.\n\nCapabilities: Google Business posts (What's New, Offers, Events). Schedule. CTA buttons (Learn More, Book, Order). Analytics.\n\nSpecs: 1,500 chars. Images min 250×250, rec 1200×900. Offers with coupon codes.\n\nTips: Post regularly for local SEO. Use offers/events. Include photos. Best for local/brick-and-mortar businesses.\n\nTroubleshooting: "Not found" → ensure verified. "API not enabled" → enable in Cloud Console. "Rejected" → avoid promotional language.`,
    category: 'Connections',
    tags: ['google business', 'gmb', 'google my business', 'local', 'connect google business', 'google business profile', 'gbp', 'maps', 'local seo'],
    priority: 7,
  },
  {
    title: 'Account Settings',
    content: `Manage your EE PostMind account in Settings:\n\nProfile: Update name, email (requires verification), timezone, avatar, bio.\n\nSecurity: Change password, enable 2FA, view active sessions, download data (GDPR), delete account.\n\nNotifications: Post published, post failed, upcoming scheduled, weekly/monthly analytics digest, team activity.\n\nAppearance: Light/Dark/System mode, accent colors, compact/comfortable layout.\n\nAdmin (Owner only): Upload site logo/favicon, set site title/tagline, configure SEO, SMTP email config, cloud storage settings.`,
    category: 'Account',
    tags: ['settings', 'account', 'profile', 'security', 'password', 'notifications', 'appearance', 'dark mode', 'timezone', '2fa', 'change password'],
    priority: 7,
  },
  {
    title: 'Post Publishing Failures',
    content: `Common reasons posts fail and how to fix:\n\n1. Token Expired — Re-authorize in Connections.\n2. API Rate Limit — Wait 15-60 min. Limits: Twitter 300 tweets/3hrs, Instagram 25/hr, LinkedIn 100/day, Facebook 200/hr.\n3. Content Violations — Review platform guidelines. Issues: prohibited words, copyrighted media, spam, blacklisted URLs.\n4. Media Issues — File too large, wrong format, corrupt, dimensions too small.\n5. Permissions Changed — Disconnect and reconnect account.\n6. Server Timeout — Platform API temporarily down; auto-retry up to 3 times.\n\nCheck Post History for specific error messages. Try text-only post to isolate issue. Contact support with error message and post ID.`,
    category: 'Troubleshooting',
    tags: ['error', 'failed', 'not posting', 'publish error', 'troubleshoot', 'fix', 'broken', 'not working', 'problem', 'why did my post fail'],
    priority: 8,
  },
  {
    title: 'Connection Problems',
    content: `Fix social media connection issues:\n\nDisconnected Account: Click → Reconnect → Re-authorize. If still fails, remove and re-add.\n\nCan't See Page: Facebook/Instagram need Page admin. LinkedIn need Company Page admin. YouTube need channel. Google Business need verification.\n\nPermission Denied: Platform updated permissions. Remove connection completely, re-add granting all permissions.\n\nWorks But Posts Fail: Check account still active. Check page not restricted. Check platform API status pages.\n\nAPI Status Pages: Facebook developers.facebook.com/status, Twitter api.twitterstat.us, LinkedIn linkedin.statuspage.io, YouTube status.cloud.google.com.`,
    category: 'Troubleshooting',
    tags: ['disconnected', 'reconnect', 'connection error', 'permission', 'cannot connect', 'oauth failed', 'token', 'expired', 'link broken'],
    priority: 8,
  },
  {
    title: 'Billing & Subscription Management',
    content: `Manage subscriptions from the Billing page:\n\nView Plan: Billing shows current plan, usage, renewal date.\n\nUpgrade: Billing → Upgrade → select plan → enter payment (Stripe) → features available immediately.\n\nDowngrade: Billing → Change Plan → select lower plan → changes at end of billing cycle → excess accounts paused (not deleted).\n\nCancel: Billing → Cancel → access continues until period end → drops to Free → data kept 90 days.\n\nPayment: Credit/debit cards via Stripe. Receipts emailed. Invoices downloadable.\n\nRefund: Contact support within 14 days for full refund.`,
    category: 'Account',
    tags: ['billing', 'payment', 'subscription', 'upgrade', 'downgrade', 'cancel', 'invoice', 'refund', 'stripe', 'plan change', 'pricing', 'money'],
    priority: 7,
  },
  {
    title: 'Media Upload Guidelines',
    content: `Media support in EE PostMind:\n\nImage Formats: JPEG, PNG, GIF (animated), WebP.\nVideo Formats: MP4 (recommended), MOV, AVI, WebM.\n\nUpload Limit: 25MB per file.\n\nRecommended Sizes: Facebook 1200×630, Instagram Feed 1080×1080 or 1080×1350, Stories/Reels 1080×1920, Twitter 1200×675, LinkedIn 1200×627, Pinterest 1000×1500, YouTube Thumbnail 1280×720, TikTok 1080×1920.\n\nTips: High-resolution images. Compress large files. Design mobile-first. Preview on each platform before publishing.\n\nCloud Storage: Admins can configure Wasabi or DigitalOcean Spaces in Settings → Admin → Cloud Storage. If not configured, files stored locally.`,
    category: 'Features',
    tags: ['upload', 'image', 'video', 'media', 'photo', 'file', 'size limit', 'format', 'dimensions', 'resolution', 'picture', 'how to upload'],
    priority: 7,
  },
  {
    title: 'Contact Support',
    content: `Need help? Contact EE PostMind support:\n\nAI Chatbot: Click chat icon (bottom-right corner) on any page for instant AI help. Answers questions, troubleshoots, guides you.\n\nEmail: support@smmt.entreprenreducation.com — response within 24 hours on business days.\n\nHelp Center: Sidebar → Help for guides, tutorials, connection guides, FAQ, troubleshooting.\n\nLive Support: Monday–Friday, 9 AM–6 PM EST.\n\nEnterprise: Dedicated support rep via direct email/phone.\n\nWhen contacting include: account email, issue description, screenshots, error messages, affected platform/feature, steps to reproduce.`,
    category: 'General',
    tags: ['support', 'help', 'contact', 'email', 'chat', 'customer service', 'issue', 'problem', 'question', 'talk to someone', 'human', 'agent', 'reach out', 'phone'],
    priority: 9,
  },
  {
    title: 'Managing Post History',
    content: `Post History shows all posts:\n\nStatuses: Published (success), Scheduled (queued), Draft (saved), Failed (error — click for details), Partially Published (some platforms failed).\n\nFiltering: By status, platform, date range, search by content.\n\nActions: Edit draft/scheduled. Reschedule. Delete (from EE PostMind only). Retry failed. View metrics. Duplicate post.\n\nBulk Actions: Select multiple to delete, reschedule, or export as CSV.`,
    category: 'Features',
    tags: ['post history', 'posts', 'status', 'published', 'scheduled', 'draft', 'failed', 'manage posts', 'edit post', 'delete post', 'my posts', 'view posts'],
    priority: 6,
  },
  {
    title: 'Tips and Best Practices',
    content: `Tips for using EE PostMind effectively:\n\nGeneral: Collapse sidebar for space. Dark mode for eye strain. Set timezone in Profile. Use templates. Check Analytics weekly.\n\nContent: Write for mobile. Include call-to-action. Use AI for A/B testing captions. Post consistently.\n\nPlatform Tips:\n• Instagram Reels get 2x more reach than static\n• Twitter images get 150% more retweets\n• LinkedIn PDF carousels get highest engagement\n• Facebook video gets 6x more than photos\n• TikTok first 3 seconds are critical\n• Pinterest vertical 2:3 performs best\n• YouTube custom thumbnails increase CTR 90%\n\nWorkflow: Batch create weekly. Use Calendar to spot gaps. Review failed posts daily. Archive old templates.`,
    category: 'General',
    tags: ['tips', 'shortcuts', 'productivity', 'workflow', 'best practices', 'advice', 'recommendations', 'how to use', 'improve', 'optimize'],
    priority: 5,
  },
];

const platformProfiles = [
  {
    name: 'Facebook',
    slug: 'facebook',
    format: 'Images: JPG/PNG (1200×630 recommended). Videos: MP4/MOV up to 10GB and 240 minutes.',
    characterLimit: 'Up to 63,206 characters for feed posts.',
    cadence: '1-2 quality posts per day, with a mix of video, image, and link posts.',
    bestTimes: 'Weekdays between 1 PM and 4 PM in your audience timezone.',
    analyticsFocus: 'Shares, comments, link clicks, and watch time on videos.',
    troubleshooting: 'Most failures come from missing Page admin rights, removed permissions, or expired page tokens.',
  },
  {
    name: 'Instagram',
    slug: 'instagram',
    format: 'Feed images at 1080×1080 or 1080×1350. Reels/video in MP4, 9:16 preferred.',
    characterLimit: 'Captions up to 2,200 characters and up to 30 hashtags.',
    cadence: '1 feed post daily plus 3-5 stories per week and 2-4 reels weekly.',
    bestTimes: 'Late morning (11 AM-1 PM) and evening (7 PM-9 PM).',
    analyticsFocus: 'Reach, saves, shares, reel watch-through rate, and profile actions.',
    troubleshooting: 'Publishing often fails when the account is personal (not Business/Creator) or no Facebook Page is linked.',
  },
  {
    name: 'Twitter/X',
    slug: 'twitter-x',
    format: 'Text posts with up to 4 images, or one MP4 video up to 2:20 in most tiers.',
    characterLimit: 'Up to 280 characters for standard accounts.',
    cadence: '3-5 short posts per day, mixing original posts, replies, and threads.',
    bestTimes: 'Morning (8 AM-10 AM) and early evening (6 PM-9 PM).',
    analyticsFocus: 'Impressions, engagement rate, link clicks, and profile visits.',
    troubleshooting: 'Frequent issues include app permission drift, rate limits, and over-length text after URL expansion.',
  },
  {
    name: 'LinkedIn',
    slug: 'linkedin',
    format: 'Images at 1200×627, short videos (3s-10m), and PDF docs for carousel posts.',
    characterLimit: 'Up to 3,000 characters for post body text.',
    cadence: '3-5 posts per week focused on thought leadership and proof points.',
    bestTimes: 'Business-hour windows (7 AM-8 AM and 5 PM-6 PM weekdays).',
    analyticsFocus: 'CTR, comments from target personas, and follower growth by role/industry.',
    troubleshooting: 'Most connection errors happen when the user is not an admin on the company page.',
  },
  {
    name: 'TikTok',
    slug: 'tiktok',
    format: 'Vertical MP4/WebM videos (1080×1920 preferred), 3 seconds to 10 minutes.',
    characterLimit: 'Caption text is short-form; lead with hooks and concise tags.',
    cadence: '1-3 videos per day with rapid creative iteration.',
    bestTimes: 'Early morning (7 AM-9 AM) and night (7 PM-11 PM).',
    analyticsFocus: 'Average watch time, completion rate, and shares.',
    troubleshooting: 'Common failures include unapproved app scopes, oversized uploads, and invalid video codecs.',
  },
  {
    name: 'YouTube',
    slug: 'youtube',
    format: 'MP4 videos (up to 256GB/12h) with thumbnail at 1280×720.',
    characterLimit: 'Titles up to 100 characters; descriptions up to 5,000.',
    cadence: '1-3 long videos weekly or a steady Shorts cadence for discovery.',
    bestTimes: 'Late afternoon to evening, especially Thursday through Sunday.',
    analyticsFocus: 'CTR, average view duration, retention curve, and subscriber conversion.',
    troubleshooting: 'Quota exhaustion, channel mismatch, and missing upload scopes are the most common blockers.',
  },
  {
    name: 'Pinterest',
    slug: 'pinterest',
    format: 'Vertical images (1000×1500 preferred) and videos up to 15 minutes.',
    characterLimit: 'Titles up to 100 chars and descriptions up to 500 chars.',
    cadence: '5-15 fresh pins daily spread across relevant boards.',
    bestTimes: 'Evenings and weekends perform well for discovery-driven niches.',
    analyticsFocus: 'Outbound clicks, saves, top board performance, and monthly viewers.',
    troubleshooting: 'Posting errors usually come from archived boards, mismatched aspect ratios, or API throttling.',
  },
  {
    name: 'Threads',
    slug: 'threads',
    format: 'Short text with links and image sets (up to 10 images).',
    characterLimit: 'Up to 500 characters per post.',
    cadence: '1-3 conversational posts daily with active reply participation.',
    bestTimes: 'Lunch-time and evening windows based on audience activity.',
    analyticsFocus: 'Replies, reposts, profile taps, and conversation depth.',
    troubleshooting: 'Connection breaks usually trace to Instagram linkage issues or revoked Meta permissions.',
  },
  {
    name: 'Mastodon',
    slug: 'mastodon',
    format: 'Short text posts with up to 4 images or polls based on instance settings.',
    characterLimit: 'Typically 500 characters, but varies by instance.',
    cadence: '1-2 community-first posts daily with active reply etiquette.',
    bestTimes: 'Depends on instance geography; test and refine using engagement by hour.',
    analyticsFocus: 'Boosts, favourites, replies, and hashtag discovery.',
    troubleshooting: 'Common issues are incorrect instance URLs, blocked apps, or expired OAuth tokens on strict instances.',
  },
  {
    name: 'Bluesky',
    slug: 'bluesky',
    format: 'Text-forward posts with up to 4 images and automatic link embeds.',
    characterLimit: 'Up to 300 characters per post.',
    cadence: '2-4 concise posts daily plus replies in niche communities.',
    bestTimes: 'Morning and late afternoon windows for tech-heavy audiences.',
    analyticsFocus: 'Likes, reposts, replies, and profile follows.',
    troubleshooting: 'Most auth errors are caused by invalid app passwords or incomplete handles.',
  },
  {
    name: 'Tumblr',
    slug: 'tumblr',
    format: 'Supports text, photo, quote, link, audio, and video post types.',
    characterLimit: 'No strict text limit for most post types.',
    cadence: '1-3 posts daily, using tags aggressively for discovery.',
    bestTimes: 'Evening posting windows and fandom/event peaks.',
    analyticsFocus: 'Notes, reblogs, click-throughs, and tagged discovery.',
    troubleshooting: 'Frequent failures involve blog selection mismatch or stale OAuth app credentials.',
  },
  {
    name: 'Reddit',
    slug: 'reddit',
    format: 'Title + text/link posts with subreddit-specific formatting and flair requirements.',
    characterLimit: 'Titles up to 300 chars and body text up to 40,000 chars.',
    cadence: 'Low-volume, high-context posting (often 3-7 posts per week per subreddit).',
    bestTimes: 'Subreddit-specific, often mornings and early afternoons in target region.',
    analyticsFocus: 'Upvote ratio, comment depth, CTR on links, and moderation outcomes.',
    troubleshooting: 'Removals and publish failures typically come from subreddit rule violations or account age/karma limits.',
  },
  {
    name: 'Google Business Profile',
    slug: 'google-business-profile',
    format: 'Image-first local updates with offers/events and CTA buttons.',
    characterLimit: 'Post copy up to 1,500 characters.',
    cadence: '2-4 local updates per week, with additional event/offer posts as needed.',
    bestTimes: 'Weekday mornings and pre-visit windows for local intent.',
    analyticsFocus: 'Calls, direction requests, website clicks, and photo views.',
    troubleshooting: 'Publishing issues usually come from unverified locations, suspended profiles, or policy-sensitive wording.',
  },
];

function buildPlatformDeepDiveArticles(profile) {
  const platformTag = profile.name.toLowerCase();

  return [
    {
      title: `${profile.name} Content Specs & Publishing Checklist`,
      content: `Use this checklist before publishing to ${profile.name} from EE PostMind.\n\nFormat requirements: ${profile.format}\nCharacter limits: ${profile.characterLimit}\n\nPublishing checklist:\n1. Confirm your media dimensions and file size match platform requirements.\n2. Write a platform-native opener that hooks in the first sentence.\n3. Add CTA language that matches campaign goals (click, comment, save, or reply).\n4. Preview post formatting in EE PostMind before publishing.\n5. Validate links, mentions, hashtags, and brand/legal constraints.\n\nExecution workflow in EE PostMind: Compose → select ${profile.name} → upload media → run preview → Publish Now or Schedule.`,
      category: 'Connections',
      tags: [profile.slug, platformTag, 'content specs', 'dimensions', 'publishing checklist', 'format requirements'],
      priority: 6,
    },
    {
      title: `${profile.name} Growth Strategy in EE PostMind`,
      content: `Use this framework to grow consistently on ${profile.name}.\n\nRecommended cadence: ${profile.cadence}\nBest posting windows: ${profile.bestTimes}\n\nContent mix recommendation:\n• 40% educational/value content\n• 30% social proof or community stories\n• 20% product/service promotions\n• 10% experiments (new formats, trends, hooks)\n\nOptimization loop:\n1. Plan weekly themes in Calendar.\n2. Schedule content in batches.\n3. Compare performance by post type and posting hour.\n4. Double down on top performers and retire weak formats.\n\nUse tags and labels in EE PostMind to track each campaign and compare outcomes by objective.`,
      category: 'Features',
      tags: [profile.slug, platformTag, 'growth strategy', 'engagement strategy', 'content plan', 'posting frequency'],
      priority: 6,
    },
    {
      title: `${profile.name} Analytics Playbook`,
      content: `Track the right KPIs for ${profile.name} so your decisions are data-backed.\n\nPrimary metrics: ${profile.analyticsFocus}\n\nWeekly review process:\n1. Open Analytics and filter by ${profile.name}.\n2. Rank top posts by engagement rate and saves/shares.\n3. Compare performance by content type (image, video, text, carousel, etc.).\n4. Identify best publishing windows from historical engagement.\n5. Export findings and update next week's calendar.\n\nMonthly checkpoint:\n• Review follower trend and audience quality.\n• Evaluate campaign ROI using link clicks or conversions.\n• Record top creative patterns to reuse in templates.`,
      category: 'Analytics',
      tags: [profile.slug, platformTag, 'analytics', 'metrics', 'kpi', 'performance tracking', 'reporting'],
      priority: 6,
    },
    {
      title: `Troubleshooting ${profile.name} Connection and Publishing`,
      content: `If ${profile.name} posts fail, use this recovery sequence.\n\nMost common cause: ${profile.troubleshooting}\n\nFix flow:\n1. Reconnect the account from Connections and approve all requested scopes.\n2. Publish a short text-only test post to isolate media-related issues.\n3. Verify account role permissions and business/page ownership.\n4. Confirm media format and duration/size limits.\n5. Retry the original post and review Post History error details.\n\nEscalation checklist for support:\n• Workspace name and connected account\n• Post ID and scheduled/publish timestamp\n• Exact error message\n• Sample media file details`,
      category: 'Troubleshooting',
      tags: [profile.slug, platformTag, 'troubleshooting', 'publish failed', 'connection issue', 'api errors'],
      priority: 6,
    },
  ];
}

function buildGuideContent({ overview, steps, metrics, pitfalls }) {
  return `${overview}\n\nImplementation steps:\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\nWhat to monitor:\n${metrics.map((metric) => `• ${metric}`).join('\n')}\n\nCommon mistakes to avoid:\n${pitfalls.map((pitfall) => `• ${pitfall}`).join('\n')}`;
}

const advancedGuideDefinitions = [
  {
    title: 'Building a 30-Day Content Calendar',
    category: 'Getting Started',
    tags: ['content calendar', '30 day plan', 'monthly planning', 'scheduling workflow', 'editorial calendar'],
    priority: 7,
    overview: 'A monthly calendar keeps publishing consistent and prevents last-minute posting.',
    steps: [
      'Choose 3-5 content pillars aligned to your brand goals.',
      'Map campaign dates, product moments, and seasonal events for the month.',
      'Draft weekly post themes and assign target platforms for each theme.',
      'Batch-schedule approved posts in Calendar and leave 15-20% room for reactive content.',
    ],
    metrics: ['Publishing consistency by week', 'Engagement rate by content pillar', 'Completion rate of planned vs posted content'],
    pitfalls: ['Overfilling the calendar with promotional posts', 'Ignoring platform-specific content formatting', 'Not reserving space for trend-based posts'],
  },
  {
    title: 'Weekly Batch Content Production Workflow',
    category: 'Features',
    tags: ['batch create', 'content production', 'workflow', 'weekly process', 'efficiency'],
    priority: 7,
    overview: 'Batching content creation reduces context switching and improves quality control.',
    steps: [
      'Reserve one strategy block, one writing block, and one design block each week.',
      'Generate first drafts with AI prompts aligned to brand voice rules.',
      'Design all media assets in one editor session using reusable templates.',
      'Queue final posts for approval and schedule the week in a single session.',
    ],
    metrics: ['Average time to produce one week of posts', 'Approval turnaround time', 'Draft-to-publish conversion rate'],
    pitfalls: ['Creating content without campaign objectives', 'Skipping final QA before scheduling', 'Mixing too many topics in one batch'],
  },
  {
    title: 'Using Content Pillars to Stay Consistent',
    category: 'General',
    tags: ['content pillars', 'content strategy', 'brand consistency', 'topic planning'],
    priority: 7,
    overview: 'Content pillars define your recurring themes so audiences know what to expect.',
    steps: [
      'Select pillar categories such as education, proof, product, and community.',
      'Assign each planned post to one pillar and label it in EE PostMind.',
      'Balance pillar distribution weekly to avoid repetitive messaging.',
      'Review quarterly to refresh underperforming or outdated pillars.',
    ],
    metrics: ['Engagement rate per pillar', 'Follower growth by pillar mix', 'Retention of recurring content series'],
    pitfalls: ['Using too many pillars to stay focused', 'Posting random topics without categorization', 'Failing to retire weak themes'],
  },
  {
    title: 'Cross-Posting Without Looking Duplicative',
    category: 'Features',
    tags: ['cross posting', 'multi platform', 'repurpose', 'platform optimization', 'adapt content'],
    priority: 7,
    overview: 'Cross-posting works best when one core idea is adapted to each platform style.',
    steps: [
      'Write one source message and define the core CTA.',
      'Adapt hook, format, and length for each selected platform.',
      'Use EE PostMind previews to validate platform-specific rendering.',
      'Stagger publish times to avoid simultaneous duplicate drops.',
    ],
    metrics: ['Engagement parity across platforms', 'CTR by platform variant', 'Content reuse efficiency'],
    pitfalls: ['Using identical copy everywhere', 'Ignoring platform-specific media ratios', 'Publishing all channels at the same minute'],
  },
  {
    title: 'Repurposing Long-Form Content Into Social Posts',
    category: 'Features',
    tags: ['repurposing', 'blog to social', 'content atomization', 'distribution'],
    priority: 7,
    overview: 'One long-form asset can generate multiple social posts when broken into key insights.',
    steps: [
      'Extract 5-10 key points, quotes, or data snippets from the source asset.',
      'Create multiple post formats: short text, carousel outline, reel script, and thread.',
      'Schedule snippets over 2-4 weeks with different hooks and CTAs.',
      'Link back to the original long-form piece with tracked URLs.',
    ],
    metrics: ['Traffic back to source content', 'Engagement by repurposed format', 'Average lifespan of one source asset'],
    pitfalls: ['Posting all snippets in one week', 'Reusing headlines without new angles', 'Skipping link attribution'],
  },
  {
    title: 'Approval Workflow Best Practices for Teams',
    category: 'Collaboration',
    tags: ['approval workflow', 'team process', 'review cycle', 'content governance'],
    priority: 7,
    overview: 'A structured approval flow keeps quality high while preventing publishing bottlenecks.',
    steps: [
      'Define role responsibilities for draft, review, and final approval.',
      'Set SLA windows for reviewers based on campaign urgency.',
      'Use clear approval comments tied to copy, design, and compliance checks.',
      'Track rejected reasons and update templates to reduce repeat errors.',
    ],
    metrics: ['Average review turnaround', 'First-pass approval rate', 'Rejected post reasons by category'],
    pitfalls: ['Assigning too many approvers', 'Review feedback without actionable edits', 'No documented approval criteria'],
  },
  {
    title: 'Managing Multi-Brand Workspaces',
    category: 'Collaboration',
    tags: ['multi brand', 'workspace management', 'agency workflow', 'client separation'],
    priority: 7,
    overview: 'Separate workspaces protect brand integrity and keep reporting clean for each client or business unit.',
    steps: [
      'Create dedicated workspaces per brand, region, or client account.',
      'Apply naming standards for campaigns, templates, and media folders.',
      'Restrict team roles so members only access relevant workspaces.',
      'Export analytics per workspace for clear stakeholder reporting.',
    ],
    metrics: ['Cross-brand publishing errors', 'Workspace-level engagement trends', 'Team access audit results'],
    pitfalls: ['Sharing templates across unrelated brands without editing', 'Overlapping account connections', 'Weak naming conventions'],
  },
  {
    title: 'Creating Brand Voice Rules for AI Content',
    category: 'Features',
    tags: ['brand voice', 'ai prompts', 'tone consistency', 'style guide'],
    priority: 7,
    overview: 'AI outputs improve significantly when brand voice rules are explicit and reusable.',
    steps: [
      'Document voice attributes such as tone, vocabulary, and do-not-use phrases.',
      'Save prompt templates that include audience, objective, and CTA patterns.',
      'Create approved examples of strong and weak outputs for reference.',
      'Review generated drafts weekly and refine prompts based on outcomes.',
    ],
    metrics: ['AI draft acceptance rate', 'Manual edit time per draft', 'Consistency score across channels'],
    pitfalls: ['Using vague prompts without context', 'No banned phrase list', 'Changing tone per post without strategy'],
  },
  {
    title: 'Prompt Engineering for Better Captions',
    category: 'Features',
    tags: ['prompt engineering', 'caption generation', 'ai assistant', 'copywriting'],
    priority: 7,
    overview: 'Strong prompts turn generic AI captions into platform-ready, conversion-focused copy.',
    steps: [
      'Include platform, audience, objective, and desired tone in each prompt.',
      'Provide product details, differentiators, and specific CTA instructions.',
      'Generate 3-5 variants and select the best hook + CTA combination.',
      'Run quick A/B tests on caption variants in similar posting windows.',
    ],
    metrics: ['Engagement lift vs baseline captions', 'Click-through rate by variant', 'Saved prompt reuse frequency'],
    pitfalls: ['Missing CTA direction in prompt', 'Publishing first output without edits', 'Ignoring platform length constraints'],
  },
  {
    title: 'Hashtag Research and Rotation Strategy',
    category: 'Features',
    tags: ['hashtags', 'discovery strategy', 'keyword clusters', 'reach optimization'],
    priority: 6,
    overview: 'Hashtag rotation prevents repetitive patterns and improves discoverability across topics.',
    steps: [
      'Build hashtag sets by intent: broad, niche, branded, and campaign-specific.',
      'Rotate sets based on content pillar and target audience segment.',
      'Track performance by hashtag set in post labels or notes.',
      'Refresh underperforming sets monthly using trend and competitor checks.',
    ],
    metrics: ['Reach from hashtag discovery', 'Engagement rate by hashtag set', 'Top performing branded tags'],
    pitfalls: ['Using identical hashtag blocks every time', 'Overloading captions with irrelevant tags', 'Not retiring low-performance tags'],
  },
  {
    title: 'A/B Testing Captions and Creative',
    category: 'Analytics',
    tags: ['ab testing', 'caption test', 'creative test', 'optimization'],
    priority: 7,
    overview: 'Controlled A/B tests reveal which message and creative combinations drive higher engagement.',
    steps: [
      'Test one variable at a time (hook, CTA, image style, or length).',
      'Publish variants to similar audience windows and platform contexts.',
      'Use clear naming labels so variants are easy to compare in reports.',
      'Adopt winners and archive lessons in template notes.',
    ],
    metrics: ['Relative lift in engagement rate', 'CTR differences between variants', 'Statistical reliability by sample size'],
    pitfalls: ['Changing multiple variables per test', 'Unequal posting windows', 'Ending tests too early'],
  },
  {
    title: 'Product Launch Social Campaign Checklist',
    category: 'Getting Started',
    tags: ['product launch', 'campaign planning', 'launch checklist', 'go to market'],
    priority: 8,
    overview: 'Launch campaigns perform best with phased messaging before, during, and after release.',
    steps: [
      'Define launch phases: teaser, reveal, proof, and urgency.',
      'Map asset requirements for each platform and phase.',
      'Schedule support content: FAQs, testimonials, and demos.',
      'Set real-time monitoring for comments and support questions on launch day.',
    ],
    metrics: ['Launch-week reach and engagement', 'Traffic/conversion from launch CTAs', 'Sentiment trend in comments and replies'],
    pitfalls: ['Only posting on launch day', 'No contingency plan for FAQs/issues', 'Weak CTA alignment to landing pages'],
  },
  {
    title: 'Seasonal Campaign Planning Playbook',
    category: 'General',
    tags: ['seasonal campaign', 'holiday content', 'campaign calendar', 'planning'],
    priority: 6,
    overview: 'Seasonal campaigns need early planning so messaging and creative are ready before demand peaks.',
    steps: [
      'Build a seasonal calendar with key dates relevant to your audience.',
      'Design reusable template sets for holiday and event variants.',
      'Draft platform-specific copies at least two weeks before campaign start.',
      'Schedule posts in waves and monitor performance daily during peak periods.',
    ],
    metrics: ['Campaign-period engagement uplift', 'Conversion trend by event date', 'Template reuse efficiency'],
    pitfalls: ['Preparing creative too late', 'Using generic messaging for every event', 'Ignoring post-campaign analysis'],
  },
  {
    title: 'Setting Up an Evergreen Content Queue',
    category: 'Features',
    tags: ['evergreen content', 'queue', 'automation', 'always on content'],
    priority: 6,
    overview: 'Evergreen queues keep channels active while your team focuses on campaigns and real-time content.',
    steps: [
      'Identify timeless topics that stay relevant for 3-12 months.',
      'Create reusable template variants for each evergreen topic.',
      'Assign queue slots by platform and rotate content every few weeks.',
      'Audit queue posts monthly to remove outdated references.',
    ],
    metrics: ['Queue fill rate', 'Evergreen post engagement stability', 'Reduction in content gaps'],
    pitfalls: ['Leaving stale offers in queue', 'No balance between evergreen and timely posts', 'Using only one format repeatedly'],
  },
  {
    title: 'Time Zone Scheduling for Global Audiences',
    category: 'Features',
    tags: ['time zone', 'global scheduling', 'international audience', 'posting windows'],
    priority: 6,
    overview: 'Global audiences need region-aware scheduling to maximize visibility and engagement.',
    steps: [
      'Segment audiences by region and language priority.',
      'Create region-specific scheduling windows in Calendar.',
      'Duplicate and localize top-performing posts for each region.',
      'Review engagement by local hour and rebalance schedules monthly.',
    ],
    metrics: ['Engagement by region and local hour', 'Follower growth by geography', 'Performance of localized variants'],
    pitfalls: ['Using one timezone for all audiences', 'Not localizing cultural references', 'Ignoring daylight savings changes'],
  },
  {
    title: 'UTM Tracking and Link Attribution',
    category: 'Analytics',
    tags: ['utm', 'tracking', 'link attribution', 'campaign analytics', 'roi'],
    priority: 7,
    overview: 'UTM parameters connect social posts to website outcomes so ROI can be measured accurately.',
    steps: [
      'Define a naming convention for source, medium, campaign, and content.',
      'Attach UTM links to all conversion-focused posts.',
      'Store link variants in templates for consistent reuse.',
      'Compare campaign performance in web analytics and EE PostMind reports.',
    ],
    metrics: ['Sessions and conversions by campaign', 'Revenue or lead quality by source', 'CTR consistency across platforms'],
    pitfalls: ['Inconsistent UTM naming', 'Broken links from manual edits', 'No campaign-level attribution review'],
  },
  {
    title: 'Reach vs Impressions vs Engagement Explained',
    category: 'Analytics',
    tags: ['reach', 'impressions', 'engagement', 'metrics basics', 'analytics definitions'],
    priority: 6,
    overview: 'Understanding metric definitions prevents reporting mistakes and improves decision quality.',
    steps: [
      'Use reach to estimate unique audience exposure.',
      'Use impressions to understand total content visibility frequency.',
      'Use engagement metrics to evaluate audience interaction quality.',
      'Review all three together before changing strategy.',
    ],
    metrics: ['Reach-to-impression ratio', 'Engagement rate by reach', 'Trend shifts after content changes'],
    pitfalls: ['Treating impressions as unique viewers', 'Optimizing only for vanity metrics', 'Comparing metrics without timeframe consistency'],
  },
  {
    title: 'Executive Reporting with Analytics Exports',
    category: 'Analytics',
    tags: ['executive report', 'monthly report', 'stakeholder update', 'analytics export'],
    priority: 6,
    overview: 'Executive reporting should translate social activity into business outcomes and clear next actions.',
    steps: [
      'Export monthly analytics by platform and campaign labels.',
      'Summarize wins, misses, and notable trend changes in plain language.',
      'Tie social metrics to business KPIs like leads, trials, or sales.',
      'Present a short action plan for the next cycle with measurable targets.',
    ],
    metrics: ['Goal attainment by KPI', 'Top campaign contribution', 'Month-over-month trend shifts'],
    pitfalls: ['Overloading reports with raw charts', 'No actionable recommendations', 'Missing business context for metric changes'],
  },
  {
    title: 'Recovering from Engagement Drops',
    category: 'Troubleshooting',
    tags: ['engagement drop', 'performance decline', 'diagnostics', 'recovery plan'],
    priority: 7,
    overview: 'When engagement declines, diagnose format, timing, audience, and message fit before changing everything.',
    steps: [
      'Compare recent low performers against historical top posts by format and topic.',
      'Check posting frequency changes, timing drift, and audience overlap.',
      'Run quick content experiments with new hooks and CTAs.',
      'Reintroduce proven formats while testing one new variable at a time.',
    ],
    metrics: ['Engagement recovery rate over 2-4 weeks', 'Performance delta of experimental posts', 'Reach stability during recovery'],
    pitfalls: ['Making multiple major changes at once', 'Stopping tests too quickly', 'Ignoring audience feedback in comments'],
  },
  {
    title: 'Accessibility Checklist for Social Content',
    category: 'General',
    tags: ['accessibility', 'alt text', 'captions', 'inclusive content', 'a11y'],
    priority: 6,
    overview: 'Accessible content broadens reach and improves user experience across all audiences.',
    steps: [
      'Add descriptive alt text for all images whenever the platform supports it.',
      'Use subtitles/captions for videos and avoid audio-only key context.',
      'Maintain readable contrast and legible text sizes in creatives.',
      'Avoid jargon-only messaging and use clear, concise sentence structure.',
    ],
    metrics: ['Completion rates on captioned videos', 'Engagement from accessibility-improved posts', 'Reduction in usability complaints'],
    pitfalls: ['Decorative alt text with no context', 'Embedding tiny text into graphics', 'Assuming users always watch with sound'],
  },
  {
    title: 'Account Security Hardening Guide',
    category: 'Account',
    tags: ['security', 'account protection', 'session control', 'permissions', 'best practices'],
    priority: 7,
    overview: 'Security hardening protects connected social accounts and reduces risk from compromised credentials.',
    steps: [
      'Enable two-factor authentication for all team members.',
      'Review active sessions and remove unknown devices regularly.',
      'Limit admin roles to essential users and audit permissions monthly.',
      'Rotate sensitive credentials and app secrets on a fixed schedule.',
    ],
    metrics: ['2FA adoption rate', 'Permission audit findings', 'Security incident count'],
    pitfalls: ['Sharing admin credentials', 'No offboarding access checklist', 'Leaving dormant sessions active'],
  },
  {
    title: 'Invoice and Subscription Operations Playbook',
    category: 'Account',
    tags: ['billing operations', 'invoice management', 'subscription admin', 'finance workflow'],
    priority: 6,
    overview: 'A billing operations routine prevents service interruptions and keeps finance reporting accurate.',
    steps: [
      'Set recurring reminders for renewal dates and plan usage checks.',
      'Download and archive monthly invoices in a centralized folder.',
      'Track seat/account usage before renewal to right-size your plan.',
      'Escalate failed payments immediately to avoid feature interruptions.',
    ],
    metrics: ['On-time invoice reconciliation', 'Plan utilization vs limits', 'Billing issue resolution time'],
    pitfalls: ['Ignoring usage alerts near plan limits', 'No owner for billing reviews', 'Missing invoice records for audits'],
  },
];

const platformDeepDiveArticles = platformProfiles.flatMap(buildPlatformDeepDiveArticles);
const advancedGuides = advancedGuideDefinitions.map(({ overview, steps, metrics, pitfalls, ...article }) => ({
  ...article,
  content: buildGuideContent({ overview, steps, metrics, pitfalls }),
}));

const articles = [...coreArticles, ...platformDeepDiveArticles, ...advancedGuides];

async function main() {
  if (!process.argv[2] || !process.argv[3]) {
    console.error('Usage: node scripts/seed-kb.mjs <email> <password>');
    process.exit(1);
  }
  console.log('Getting auth token...');
  const token = await getToken();
  console.log('Authenticated');

  console.log(`Importing ${articles.length} knowledge base articles...`);

  const res = await fetch(`${API_BASE}/chat/knowledge/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ entries: articles }),
  });

  const data = await res.json();
  if (data.success !== false) {
    console.log(`Imported ${data.data?.imported || 0}/${data.data?.total || 0} articles`);
    if (data.data?.errors) console.log('Errors:', JSON.stringify(data.data.errors, null, 2));
  } else {
    console.error('Import failed:', data);
  }
}

main().catch(console.error);
