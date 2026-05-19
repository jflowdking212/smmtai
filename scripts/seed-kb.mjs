/**
 * Seed the SmmtAI knowledge base with comprehensive articles.
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
    title: 'What is SmmtAI?',
    content: `SmmtAI is a Social Media Management Tool AI that helps creators, teams, and agencies create, schedule, and publish content across connected platforms from a single dashboard.\n\nKey features include:\n• AI Content Generation — Generate captions, hashtags, blog posts, and content ideas using advanced AI models\n• Visual Design Editor — Create stunning graphics with a built-in Fabric.js editor (templates, shapes, text, images)\n• Smart Scheduling — Plan and schedule posts with an intuitive calendar view, optimal time suggestions\n• Multi-Platform Publishing — Publish to Facebook, Instagram, TikTok, LinkedIn, Twitter/X, YouTube, Pinterest, Bluesky, Mastodon, Telegram, Entreprenrs, Chrxstians, and Iohah\n• Analytics Dashboard — Track engagement, reach, impressions, and growth across all channels\n• Team Collaboration — Invite team members, assign roles (Admin, Editor, Viewer), manage approval workflows\n• AI Chatbot Assistant — Get instant help and answers from our AI-powered chatbot\n• Knowledge Base — Comprehensive guides and tutorials for all features\n\nSmmtAI is designed to save you time and help you grow your social media presence with intelligent automation and beautiful content creation tools.`,
    category: 'General',
    tags: ['overview', 'about', 'what is', 'features', 'platform', 'introduction', 'ee smmtai'],
    priority: 10,
  },
  {
    title: 'SmmtAI Pricing Plans',
    content: `SmmtAI offers four pricing tiers:\n\nFree Plan — $0/forever: 3 social accounts, 30 posts/month, 10 AI generations, 1 team member, 7-day analytics, basic templates, email support.\n\nPro Plan — $19/month: 10 social accounts, 300 posts/month, 100 AI generations, 3 team members, 30-day analytics, all templates, priority support, content calendar, hashtag suggestions.\n\nBusiness Plan — $49/month: 25 social accounts, unlimited posts, 500 AI generations, 10 team members, 90-day analytics, custom branding, advanced analytics, API access, dedicated account manager.\n\nEnterprise Plan — Custom pricing: Unlimited everything, custom integrations, dedicated support, SLA guarantees, on-premise deployment option.\n\nAll plans include a 14-day free trial. No credit card required for the Free plan. Upgrade or downgrade any time from the Billing page.`,
    category: 'General',
    tags: ['pricing', 'plans', 'cost', 'subscription', 'free', 'pro', 'business', 'enterprise', 'billing', 'upgrade', 'how much', 'price'],
    priority: 9,
  },
  {
    title: 'Getting Started with SmmtAI',
    content: `Get started with SmmtAI in 5 simple steps:\n\nStep 1: Create Your Account — Sign up with email or use Google/GitHub OAuth. Verify your email.\n\nStep 2: Set Up Your Workspace — Your workspace is created automatically after login. Customize in Settings.\n\nStep 3: Connect Social Media Accounts — Go to Connections, click "Add Connection", select a platform, follow the OAuth flow.\n\nStep 4: Create Your First Post — Navigate to Compose, write your caption (or use AI), add media, select platforms, publish or schedule.\n\nStep 5: Monitor Performance — Check Analytics for engagement, reach, and growth. Dashboard shows recent activity.\n\nQuick Tips: Use AI Assistant for content ideas. Set your timezone in Settings → Profile. Use Templates to save reusable formats. Check Calendar for content overview.`,
    category: 'Getting Started',
    tags: ['getting started', 'quick start', 'setup', 'first steps', 'beginner', 'tutorial', 'how to start', 'new user', 'onboarding'],
    priority: 9,
  },
  {
    title: 'Dashboard Overview',
    content: `The SmmtAI Dashboard is your command center:\n\nRecent Posts — View latest published and scheduled posts with engagement metrics.\nQuick Stats — Total posts, engagement rate, follower growth, connected accounts at a glance.\nUpcoming Scheduled — Posts scheduled for the next 7 days.\nQuick Actions — Buttons to compose, view calendar, or check analytics.\nActivity Feed — Recent actions and notifications.\n\nThe Dashboard updates in real-time. Click any post to view details or edit it. Use sidebar navigation to access all features.`,
    category: 'Features',
    tags: ['dashboard', 'home', 'overview', 'stats', 'activity', 'main page'],
    priority: 7,
  },
  {
    title: 'Navigating SmmtAI',
    content: `SmmtAI sidebar navigation sections:\n\n• Dashboard — Overview of your social media activity\n• Compose — Create new posts with AI assistance\n• Post History — View all past and scheduled posts\n• Calendar — Visual content calendar (month/week view)\n• Analytics — Performance metrics and insights\n• Connections — Manage linked social media accounts\n• Templates — Save and reuse post templates\n• AI Assistant — AI-powered content generation tools\n• Conversations — View and manage chat conversations (admin)\n• Knowledge Base — Manage chatbot knowledge articles (admin)\n• Settings — Profile, notifications, security, appearance, admin\n• Billing — Subscription management and invoices\n• Help — Knowledge base, FAQ, and support\n\nThe sidebar can be collapsed for more screen space. On mobile, use the hamburger menu.`,
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
    content: `SmmtAI AI Assistant helps create better content faster:\n\nCaption Generator — Describe your topic, AI generates platform-optimized captions. Specify tone (professional, casual, humorous, inspiring), length, target platform, emojis/hashtags, brand voice.\n\nHashtag Suggestions — Enter topic, get relevant trending hashtags sorted by popularity.\n\nContent Ideas — AI suggests post topics, trending topics, content calendar ideas, holiday/event content.\n\nImage Generation — Describe what you want, AI creates images in various styles.\n\nText Rewriting — Paste text, AI rewrites in different tones, expands, condenses, or adapts for platforms.\n\nUsage Limits: Free 10/month, Pro 100/month, Business 500/month, Enterprise unlimited.\n\nAccess from sidebar (AI Assistant) or use AI button while composing posts.`,
    category: 'Features',
    tags: ['ai', 'artificial intelligence', 'generate', 'content', 'caption', 'hashtags', 'ideas', 'rewrite', 'gpt', 'openai', 'assistant', 'ai writer', 'auto generate'],
    priority: 8,
  },
  {
    title: 'Scheduling Posts',
    content: `Schedule posts to publish automatically:\n\nHow to Schedule: Create post in Compose, click "Schedule" instead of "Publish Now", select date/time, choose timezone, click "Schedule Post".\n\nBest Times by Platform:\n• Facebook: 1-4 PM weekdays\n• Instagram: 11 AM-1 PM and 7-9 PM\n• Twitter/X: 8-10 AM and 6-9 PM\n• LinkedIn: 7-8 AM and 5-6 PM weekdays\n• TikTok: 7-9 AM and 7-11 PM\n• Pinterest: 8-11 PM weekends\n\nManaging Scheduled Posts: View in Post History (filter "Scheduled"). Use Calendar view for visual overview. Drag and drop in Calendar to reschedule. Click to edit or cancel.\n\nRecurring Posts: Set repeat schedule (daily, weekly, monthly) for evergreen content.\n\nQueue System: Add to queue, SmmtAI publishes at pre-set optimal times.`,
    category: 'Features',
    tags: ['schedule', 'scheduling', 'calendar', 'when to post', 'best time', 'queue', 'recurring', 'auto post', 'timer', 'plan', 'automate'],
    priority: 8,
  },
  {
    title: 'Design Editor',
    content: `SmmtAI includes a powerful visual design editor:\n\nCanvas Presets: Instagram Post 1080×1080, Instagram Story 1080×1920, Facebook 1200×630, Twitter 1200×675, LinkedIn 1200×627, Pinterest 1000×1500, YouTube Thumbnail 1280×720, TikTok 1080×1920.\n\nDesign Tools: Text (fonts, colors, sizes, shadow), Shapes (rectangles, circles, lines, arrows), Images (upload or stock), Layers (arrange elements), Alignment (snap to grid, center), Templates (pre-designed), Undo/Redo, Export (PNG, JPEG, PDF).\n\nTips: Use consistent brand colors. Keep text readable. Leave space for platform UI. Use grid/alignment for professional layouts.`,
    category: 'Features',
    tags: ['design', 'editor', 'create image', 'graphic', 'canvas', 'template', 'visual', 'image editor', 'photo editor'],
    priority: 7,
  },
  {
    title: 'Analytics Dashboard',
    content: `Track performance with SmmtAI Analytics:\n\nOverview Metrics: Total reach, engagement rate, follower growth, post performance.\n\nPlatform Breakdown: Impressions, reach, engagement per post. Audience demographics. Best content types. Growth trends.\n\nTime-Based: Daily, weekly, monthly views. Compare periods. Identify trends. Export as PDF/CSV.\n\nAI Insights: Best posting times for YOUR audience. Best content types. Top hashtags. Optimal posting frequency.\n\nRetention: Free 7 days, Pro 30 days, Business 90 days, Enterprise unlimited.`,
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
    content: `SmmtAI supports team collaboration:\n\nRoles: Owner (full access + billing), Admin (manage content/connections/team), Editor (create/edit/schedule posts), Viewer (read-only).\n\nInviting: Settings → Team → Invite Member → enter email + select role.\n\nApproval Workflows (Business/Enterprise): Editors submit for review, Admins approve/reject with comments.\n\nLimits: Free 1 member, Pro 3, Business 10, Enterprise unlimited.\n\nWorkspace: Each workspace has own connections, posts, analytics. Business/Enterprise support multiple workspaces for different brands/clients.`,
    category: 'Features',
    tags: ['team', 'collaboration', 'invite', 'roles', 'permissions', 'workspace', 'members', 'approval', 'admin', 'editor', 'viewer', 'add user', 'invite member'],
    priority: 7,
  },
  {
    title: 'Connecting Social Media Accounts — Overview',
    content: `SmmtAI supports OAuth and manual connection flows.\n\nGeneral steps:\n1. Go to Connections\n2. Click "Connect" on a platform card\n3. Complete OAuth or enter manual credentials\n4. Confirm account shows as Connected\n\nCurrent platform connection modes:\n• OAuth: Facebook, Instagram, TikTok, LinkedIn, Twitter/X, YouTube, Pinterest\n• Manual credentials: Bluesky, Mastodon, Telegram, Entreprenrs, Chrxstians, Iohah\n\nInstagram has two OAuth options in the UI:\n• Instagram Direct Login\n• Connect via Facebook\n\nLimits: Free 3 accounts, Pro 10, Business 25, Enterprise unlimited.\n\nTroubleshooting: If a connection shows "Needs attention" or "Expired", reconnect from the Connections page and run Connection Check.`,
    category: 'Connections',
    tags: ['connect', 'connection', 'social media', 'link account', 'add account', 'platforms', 'oauth', 'authorize', 'how many accounts'],
    priority: 9,
  },
  {
    title: 'Connecting Facebook',
    content: `Connect Facebook to SmmtAI:\n\nPrereqs:\n• Facebook account with access to at least one managed Page\n• Permission to publish on that Page\n\nSteps:\n1. Go to Connections\n2. Click Connect on Facebook\n3. Sign in and authorize permissions\n4. Return to SmmtAI and confirm status is Connected\n\nCurrent OAuth scopes requested:\n• public_profile\n• email\n• pages_show_list\n• pages_manage_posts\n• pages_read_engagement\n\nPublishing behavior:\n• SmmtAI publishes to a managed Page\n• If no specific page is selected in metadata, it auto-resolves the first managed Page\n\nTroubleshooting:\n• "No Facebook Page found" → connect an account that manages at least one Page\n• "Token expired" or "Needs attention" → reconnect Facebook\n• Permission errors → verify Page role (admin/editor) in Facebook`,
    category: 'Connections',
    tags: ['facebook', 'fb', 'meta', 'page', 'connect facebook', 'facebook api', 'facebook page', 'facebook group'],
    priority: 8,
  },
  {
    title: 'Connecting Instagram',
    content: `Connect Instagram to SmmtAI:\n\nInstagram supports two connection paths in the current implementation.\n\nOption 1: Instagram Direct Login\n• Use this when you want direct Instagram OAuth\n• No Facebook login step in the UI\n• Current direct scopes: instagram_business_basic, instagram_business_manage_messages, instagram_business_manage_comments, instagram_business_content_publish, instagram_business_manage_insights\n\nOption 2: Connect via Facebook\n• Use this when your Instagram is linked to a Facebook Page\n• Current Facebook-mode scopes include: pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish, instagram_manage_messages, pages_manage_metadata\n\nSteps:\n1. Go to Connections\n2. Click Connect on Instagram\n3. Choose "Instagram Direct Login" or "Connect via Facebook"\n4. Complete authorization and return to SmmtAI\n\nTroubleshooting:\n• If account is not found in Facebook mode, verify Instagram Business account is linked to a Facebook Page\n• If token expires, reconnect Instagram from Connections\n• If publishing fails, verify media format and required permissions`,
    category: 'Connections',
    tags: ['instagram', 'ig', 'insta', 'connect instagram', 'instagram api', 'reels', 'carousel', 'stories', 'instagram business', 'instagram direct', 'instagram via facebook'],
    priority: 8,
  },
  {
    title: 'Connecting Entreprenrs',
    content: `Connect Entreprenrs to SmmtAI (manual credentials flow):\n\nConnection type:\n• Manual connect (not OAuth)\n\nSupported credential methods:\n1. Access token (preferred): provide accessToken + serverKey\n2. Username/password exchange: provide username + password + serverKey, then click "Get Access Token"\n\nNotes:\n• serverKey is optional in UI only if already configured in backend environment\n• userId is optional and auto-resolved during verification when missing\n• SmmtAI verifies credentials using Entreprenrs get-user-data\n\nPublishing mapping used by current implementation:\n• post text: postText\n• optional link: postLink\n• media upload: postFile (derived from image/video URL)\n• destination: timeline by default, or page/group using post_on + page_id/group_id\n\nTroubleshooting:\n• "Provide Entreprenrs access token, or username and password" → supply one complete credential method\n• "Could not verify entreprenrs credentials" → check server key and token validity\n• Publishing errors mentioning API type are auto-handled with endpoint fallback in current adapter`,
    category: 'Connections',
    tags: ['entreprenrs', 'connect entreprenrs', 'manual connection', 'server key', 'access token', 'postText', 'postLink', 'page_id', 'group_id'],
    priority: 8,
  },
  {
    title: 'Connecting Twitter/X',
    content: `Connect Twitter/X to SmmtAI:\n\nPrereqs: Twitter/X account. API access from developer.twitter.com.\n\nAPI Setup: developer.twitter.com → sign up → create Project/App → set callback URL → generate API Key/Secret/Access Token → enable OAuth 2.0 with PKCE.\n\nSteps: Connections → Add Connection → Twitter → Authorize → Grant permissions (tweet.read, tweet.write, users.read, offline.access).\n\nCapabilities: Tweets with text, images, videos, polls. Schedule. Threads. Engagement metrics.\n\nSpecs: 280 chars (premium 4,000). 4 images max (5MB each). Videos MP4 up to 2:20/512MB. GIFs 15MB. Polls 2-4 options.\n\nTips: 1-2 hashtags. Images get 2x engagement. Best times 8-10 AM and 6-9 PM.\n\nTroubleshooting: "Rate limit" → wait 15 min. "Auth failed" → regenerate keys. "Too long" → check char count with links.`,
    category: 'Connections',
    tags: ['twitter', 'x', 'tweet', 'connect twitter', 'twitter api', 'x api', 'tweets', 'threads', 'elon'],
    priority: 8,
  },
  {
    title: 'Connecting LinkedIn',
    content: `Connect LinkedIn to SmmtAI:\n\nPrereqs: LinkedIn account. For Company Pages: admin access required.\n\nSteps: Connections → Add Connection → LinkedIn → Connect → Log in → Grant permissions (r_liteprofile, r_organization_social, w_member_social, w_organization_social) → Select personal/company pages.\n\nCapabilities: Text, articles, images, videos, PDF documents (carousel). Schedule. Analytics.\n\nSpecs: 3,000 chars. Images 1200×627. Videos 3s-10min/5GB. PDF up to 300 pages.\n\nTips: Professional tone. Post 7-8 AM and 5-6 PM weekdays. PDF carousels get highest engagement. Tag people/companies.\n\nTroubleshooting: "Company page not found" → need admin access. "Rate limited" → 100 API calls/day.`,
    category: 'Connections',
    tags: ['linkedin', 'li', 'connect linkedin', 'linkedin api', 'company page', 'professional', 'linkedin post', 'business network'],
    priority: 8,
  },
  {
    title: 'Connecting TikTok',
    content: `Connect TikTok to SmmtAI:\n\nPrereqs: TikTok account. Developer Account at developers.tiktok.com. Content Posting API access (requires approval, 1-3 days).\n\nAPI Setup: developers.tiktok.com → create app → add Content Posting API → submit for review → get Client Key/Secret → set redirect URI.\n\nSteps: Connections → Add Connection → TikTok → Connect → Log in → Authorize (video.publish, video.list, user.info.basic).\n\nCapabilities: Upload/publish videos. Schedule. View performance.\n\nSpecs: Video only. MP4/WebM. 3s-10min. Max 4GB. Min 720p, recommended 1080×1920 (9:16).\n\nTips: Vertical 9:16 best. Under 60s for max engagement. Trending sounds/hashtags. Post 1-3x daily. Best times 7-9 AM and 7-11 PM.\n\nTroubleshooting: "App not approved" → wait for review. "Upload failed" → check format/size.`,
    category: 'Connections',
    tags: ['tiktok', 'tt', 'connect tiktok', 'tiktok api', 'video', 'short video', 'tiktok developer', 'viral'],
    priority: 8,
  },
  {
    title: 'Connecting YouTube',
    content: `Connect YouTube to SmmtAI:\n\nPrereqs: Google account with YouTube channel. Google Cloud project with YouTube Data API v3.\n\nAPI Setup: console.cloud.google.com → create project → enable YouTube Data API v3 → create OAuth 2.0 credentials → add callback URL → configure consent screen.\n\nSteps: Connections → Add Connection → YouTube → Connect → Log in to Google → Select channel → Grant permissions (youtube.upload, youtube.readonly, youtube).\n\nCapabilities: Upload videos with titles/descriptions/tags. Schedule. Set privacy. View analytics. Manage thumbnails.\n\nSpecs: MP4 recommended. Max 256GB/12hrs. Thumbnail 1280×720. Title 100 chars. Description 5,000 chars.\n\nTips: Custom thumbnails increase CTR 90%. Keywords in title/description. Consistent schedule. Best times Thursday-Friday afternoons.\n\nTroubleshooting: "Quota exceeded" → daily limits, wait for reset. "Channel not found" → ensure active YouTube channel.`,
    category: 'Connections',
    tags: ['youtube', 'yt', 'connect youtube', 'youtube api', 'video upload', 'google', 'youtube channel', 'vlog'],
    priority: 8,
  },
  {
    title: 'Connecting Pinterest',
    content: `Connect Pinterest to SmmtAI:\n\nPrereqs: Pinterest Business account (business.pinterest.com). Developer App (developers.pinterest.com).\n\nAPI Setup: developers.pinterest.com → create app → add callback URL → get App ID/Secret → request Content API access.\n\nSteps: Connections → Add Connection → Pinterest → Connect → Log in → Authorize (boards:read, pins:read, pins:write) → Select boards.\n\nCapabilities: Create pins with images/titles/descriptions/links. Schedule. Post to boards. Analytics.\n\nSpecs: Images 1000×1500 (2:3 ratio). Video 4s-15min. Title 100 chars. Description 500 chars.\n\nTips: Vertical 2:3 images best. Keywords in descriptions. Rich pins. Pin 5-15/day. Best times 8-11 PM weekends.\n\nTroubleshooting: "Board not found" → check not archived. "Rate limited" → spread posting.`,
    category: 'Connections',
    tags: ['pinterest', 'pin', 'connect pinterest', 'pinterest api', 'boards', 'pins', 'visual', 'inspiration'],
    priority: 7,
  },
  {
    title: 'Connecting Mastodon',
    content: `Connect Mastodon to SmmtAI (manual token flow):\n\nPrereqs:\n• Mastodon account on your server (example: https://mstdn.social)\n• App access token from that same server\n\nHow to create Mastodon token:\n1. Open your Mastodon server settings → Applications (example: https://mstdn.social/settings/applications).\n2. Create a new app (for example name it SmmtAI).\n3. Scope selection: choose top-level read + write (recommended).\n4. Save app and open it.\n5. Copy "Your access token" (or click Generate token if needed).\n\nConnect in SmmtAI:\n1. Go to Connections.\n2. Click Connect on Mastodon.\n3. Enter Instance URL (for example https://mstdn.social).\n4. Enter Access Token.\n5. Save connection and run Connection Check.\n\nPublishing behavior in SmmtAI:\n• Text posts supported.\n• Image/video attachments supported (up to 4 media items per post).\n• Posts publish to the connected account on that instance.\n\nSecurity and best practice:\n• Keep token private.\n• Use separate app/token for automation tools.\n• Revoke and regenerate token immediately if exposed.\n\nTroubleshooting:\n• "Could not verify Mastodon credentials" → token invalid, revoked, or generated on a different instance.\n• "Failed to upload Mastodon media" → media URL/file issue or instance media restrictions.\n• "Failed to publish Mastodon post" → token missing write scope or instance policy blocked request.\n• Instance URL errors → use full HTTPS URL and avoid extra path suffixes.`,
    category: 'Connections',
    tags: ['mastodon', 'fediverse', 'toot', 'connect mastodon', 'mastodon api', 'decentralized', 'instance'],
    priority: 6,
  },
  {
    title: 'Connecting Bluesky',
    content: `Connect Bluesky to SmmtAI:\n\nPrereqs: Bluesky account (bsky.app). App Password from Bluesky settings.\n\nSteps: Connections → Add Connection → Bluesky → Enter handle (e.g. username.bsky.social) → Go to Bluesky Settings → App Passwords → Create → Enter in SmmtAI → Connect.\n\nCapabilities: Posts with text, images, links. Schedule. Engagement metrics.\n\nSpecs: 300 chars. Up to 4 images. Links auto-embed. @handle mentions.\n\nTips: Posts are public by default (AT Protocol). Custom feeds for audiences. Hashtags in text.\n\nTroubleshooting: "Invalid credentials" → regenerate app password. "Handle not found" → include full handle with domain.`,
    category: 'Connections',
    tags: ['bluesky', 'bsky', 'at protocol', 'connect bluesky', 'bluesky api', 'skeet', 'app password'],
    priority: 6,
  },
  {
    title: 'Account Settings',
    content: `Manage your SmmtAI account in Settings:\n\nProfile: Update name, email (requires verification), timezone, avatar, bio.\n\nSecurity: Change password, enable 2FA, view active sessions, download data (GDPR), delete account.\n\nNotifications: Post published, post failed, upcoming scheduled, weekly/monthly analytics digest, team activity.\n\nAppearance: Light/Dark/System mode, accent colors, compact/comfortable layout.\n\nAdmin (Owner only): Upload site logo/favicon, set site title/tagline, configure SEO, SMTP email config, cloud storage settings.`,
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
    content: `Media support in SmmtAI:\n\nImage Formats: JPEG, PNG, GIF (animated), WebP.\nVideo Formats: MP4 (recommended), MOV, AVI, WebM.\n\nUpload Limit: 25MB per file.\n\nRecommended Sizes: Facebook 1200×630, Instagram Feed 1080×1080 or 1080×1350, Stories/Reels 1080×1920, Twitter 1200×675, LinkedIn 1200×627, Pinterest 1000×1500, YouTube Thumbnail 1280×720, TikTok 1080×1920.\n\nTips: High-resolution images. Compress large files. Design mobile-first. Preview on each platform before publishing.\n\nCloud Storage: Admins can configure Wasabi or DigitalOcean Spaces in Settings → Admin → Cloud Storage. If not configured, files stored locally.`,
    category: 'Features',
    tags: ['upload', 'image', 'video', 'media', 'photo', 'file', 'size limit', 'format', 'dimensions', 'resolution', 'picture', 'how to upload'],
    priority: 7,
  },
  {
    title: 'Contact Support',
    content: `Need help? Contact SmmtAI support:\n\nAI Chatbot: Click chat icon (bottom-right corner) on any page for instant AI help. Answers questions, troubleshoots, guides you.\n\nEmail: support@smmt.entreprenreducation.com — response within 24 hours on business days.\n\nHelp Center: Sidebar → Help for guides, tutorials, connection guides, FAQ, troubleshooting.\n\nLive Support: Monday–Friday, 9 AM–6 PM EST.\n\nEnterprise: Dedicated support rep via direct email/phone.\n\nWhen contacting include: account email, issue description, screenshots, error messages, affected platform/feature, steps to reproduce.`,
    category: 'General',
    tags: ['support', 'help', 'contact', 'email', 'chat', 'customer service', 'issue', 'problem', 'question', 'talk to someone', 'human', 'agent', 'reach out', 'phone'],
    priority: 9,
  },
  {
    title: 'Managing Post History',
    content: `Post History shows all posts:\n\nStatuses: Published (success), Scheduled (queued), Draft (saved), Failed (error — click for details), Partially Published (some platforms failed).\n\nFiltering: By status, platform, date range, search by content.\n\nActions: Edit draft/scheduled. Reschedule. Delete (from SmmtAI only). Retry failed. View metrics. Duplicate post.\n\nBulk Actions: Select multiple to delete, reschedule, or export as CSV.`,
    category: 'Features',
    tags: ['post history', 'posts', 'status', 'published', 'scheduled', 'draft', 'failed', 'manage posts', 'edit post', 'delete post', 'my posts', 'view posts'],
    priority: 6,
  },
  {
    title: 'Tips and Best Practices',
    content: `Tips for using SmmtAI effectively:\n\nGeneral: Collapse sidebar for space. Dark mode for eye strain. Set timezone in Profile. Use templates. Check Analytics weekly.\n\nContent: Write for mobile. Include call-to-action. Use AI for A/B testing captions. Post consistently.\n\nPlatform Tips:\n• Instagram Reels get 2x more reach than static\n• Twitter images get 150% more retweets\n• LinkedIn PDF carousels get highest engagement\n• Facebook video gets 6x more than photos\n• TikTok first 3 seconds are critical\n• Pinterest vertical 2:3 performs best\n• YouTube custom thumbnails increase CTR 90%\n\nWorkflow: Batch create weekly. Use Calendar to spot gaps. Review failed posts daily. Archive old templates.`,
    category: 'General',
    tags: ['tips', 'shortcuts', 'productivity', 'workflow', 'best practices', 'advice', 'recommendations', 'how to use', 'improve', 'optimize'],
    priority: 5,
  },
];

const platformConnectionHowToArticles = [
  {
    title: 'Platform Connection Matrix (Current SmmtAI Setup)',
    content: `SmmtAI currently supports 13 platforms.\n\nOAuth connect:\n• Facebook\n• Instagram\n• TikTok\n• LinkedIn\n• Twitter/X\n• YouTube\n• Pinterest\n\nManual connect:\n• Bluesky\n• Mastodon\n• Telegram\n• Entreprenrs\n• Chrxstians\n• Iohah\n\nCustom-platform login behavior:\n• Entreprenrs, Chrxstians, and Iohah are configured so users can connect with username/email + password.\n• API credentials are managed by admin globally.\n\nTelegram behavior:\n• Telegram uses Bot API.\n• Post destinations are channels/groups/chats where the bot is allowed.\n• Best SaaS flow is global bot token + per-user destination selection.`,
    category: 'Connections',
    tags: ['platform matrix', 'supported platforms', 'connection mode', 'oauth', 'manual connection', 'which platform', 'connect account'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Facebook',
    content: `Connection type: OAuth.\n\nHow to connect:\n1. Go to Connections.\n2. Click Connect on Facebook.\n3. Authorize Meta permissions.\n4. Confirm status is Connected.\n\nHow to use:\n• Publish to managed Facebook Pages.\n• Ensure the connected account has Page admin/editor rights.\n\nIf it fails:\n• Reconnect if token expired.\n• Verify page permissions in Meta Business/Page roles.`,
    category: 'Connections',
    tags: ['facebook', 'connect facebook', 'facebook page', 'meta', 'how to post facebook'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Instagram',
    content: `Connection type: OAuth (two paths).\n\nHow to connect:\n1. Go to Connections.\n2. Click Connect on Instagram.\n3. Choose Instagram Direct Login or Connect via Facebook.\n4. Complete authorization.\n\nHow to use:\n• Publish media-first posts with captions.\n• For Facebook-mode issues, ensure Instagram Business/Creator is linked to a Facebook Page.\n\nIf it fails:\n• Reconnect and approve all scopes.\n• Verify account type is eligible for API publishing.`,
    category: 'Connections',
    tags: ['instagram', 'connect instagram', 'instagram direct', 'instagram via facebook', 'how to post instagram'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use TikTok',
    content: `Connection type: OAuth.\n\nHow to connect:\n1. Create TikTok developer app credentials and set callback URI from SmmtAI.\n2. In Connections, click Connect on TikTok.\n3. Complete TikTok authorization.\n\nHow to use:\n• TikTok publishing is video-first.\n• Keep video format and size within TikTok requirements.\n\nKnown approval constraints:\n• Unaudited apps can face restrictions (for example private-account-only posting).\n• If app review/scopes are incomplete, connection can succeed but publish may fail until approval/settings are fixed.`,
    category: 'Connections',
    tags: ['tiktok', 'connect tiktok', 'tiktok review', 'video publishing', 'how to post tiktok'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use LinkedIn',
    content: `Connection type: OAuth.\n\nHow to connect:\n1. Go to Connections and click Connect on LinkedIn.\n2. Approve requested permissions.\n3. Reconnect if permissions/scopes were recently changed.\n\nHow to use:\n• Publish to personal profile and eligible organization contexts.\n• For company posting, user must have proper admin role.\n\nIf it fails:\n• Check app scopes and API version settings.\n• Reconnect after scope updates.`,
    category: 'Connections',
    tags: ['linkedin', 'connect linkedin', 'linkedin permissions', 'company page', 'how to post linkedin'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Twitter/X',
    content: `Connection type: OAuth 2.0.\n\nHow to connect:\n1. Create X app attached to a Project.\n2. Set callback URL to SmmtAI callback.\n3. In Connections, click Connect on X and authorize.\n\nHow to use:\n• Publish text and supported media posts.\n\nIf it fails:\n• Error about app not attached to project means X developer app configuration is incomplete.\n• Reconfirm app type, scopes, callback URL, and project linkage in X Developer Portal.`,
    category: 'Connections',
    tags: ['twitter', 'x', 'connect x', 'connect twitter', 'x developer portal', 'how to post x'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use YouTube',
    content: `Connection type: OAuth.\n\nHow to connect:\n1. Configure Google OAuth client and callback URI from SmmtAI.\n2. Enable YouTube Data API v3 in the same Google project as the OAuth client.\n3. Connect YouTube from Connections.\n\nHow to use:\n• Publish video posts to YouTube.\n• Channel-level permissions and API enablement are required for full publish/analytics.\n\nIf it fails:\n• "API not enabled" means YouTube Data API v3 is disabled in the OAuth client's project.\n• Enable API, wait propagation, reconnect.`,
    category: 'Connections',
    tags: ['youtube', 'connect youtube', 'youtube data api v3', 'google oauth', 'how to post youtube'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Pinterest',
    content: `Connection type: OAuth.\n\nHow to connect:\n1. Configure Pinterest app credentials and callback URI.\n2. In Connections, click Connect on Pinterest.\n3. Authorize board/pin scopes.\n\nHow to use:\n• Publish image-led pins with links and descriptions.\n\nIf it fails:\n• Reconnect after changing scopes or app settings.\n• Verify destination board availability and permissions.`,
    category: 'Connections',
    tags: ['pinterest', 'connect pinterest', 'pins', 'boards', 'how to post pinterest'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Bluesky',
    content: `Connection type: Manual.\n\nHow to connect:\n1. In Connections, choose Bluesky.\n2. Enter handle (or email) and app password.\n3. Save connection.\n\nHow to use:\n• Publish text/media posts to connected Bluesky account.\n\nIf it fails:\n• Regenerate app password in Bluesky settings.\n• Ensure handle includes full domain when needed.`,
    category: 'Connections',
    tags: ['bluesky', 'connect bluesky', 'app password', 'manual connect', 'how to post bluesky'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Mastodon',
    content: `Connection type: Manual (instance URL + access token).\n\nExact setup:\n1. Create app on your Mastodon server at /settings/applications.\n2. Select scopes read + write.\n3. Copy access token from that app.\n4. In SmmtAI Connections, enter:\n   Instance URL: your server URL (for example https://mstdn.social)\n   Access Token: token from app settings\n5. Save and test with a text-only post first.\n\nHow to use after connect:\n• Publish text posts.\n• Publish image/video posts (media uploads handled automatically).\n\nQuick token test (optional):\n• GET /api/v1/accounts/verify_credentials with Authorization: Bearer <token>\n• If 200 response returns account JSON, token is valid.\n\nIf it fails:\n• Invalid credentials error: regenerate token and reconnect.\n• Publish fails: ensure write scope exists.\n• Media fails: test a text-only post to isolate media issue.`,
    category: 'Connections',
    tags: ['mastodon', 'connect mastodon', 'instance url', 'manual connect', 'how to post mastodon'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Telegram',
    content: `Connection type: Manual (Bot API).\n\nHow to connect:\n1. Create bot in Telegram via @BotFather and copy bot token.\n2. Decide destination chat ID (@channelusername or numeric chat ID).\n3. Add bot to target channel/group and grant post permissions.\n4. Connect Telegram in SmmtAI with bot token and chat ID.\n\nHow to use:\n• Publish text, image, and video messages to allowed destinations.\n• Best UX for SaaS is global bot credentials with user destination selection.\n\nImportant:\n• Telegram is bot-based, not standard user OAuth login.\n• Bot can only post where it has permission.`,
    category: 'Connections',
    tags: ['telegram', 'connect telegram', 'botfather', 'bot token', 'chat id', 'channel', 'group', 'how to post telegram'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Entreprenrs',
    content: `Connection type: Manual (platform login flow).\n\nHow to connect:\n1. In Connections, choose Entreprenrs.\n2. Enter username/email and password.\n3. Save connection (server/API credentials are handled by admin config).\n\nHow to use:\n• Publish to timeline by default.\n• Support page/group destinations where metadata is provided and user has permission.\n\nIf it fails:\n• Recheck login details.\n• Ask admin to verify global platform credentials and API availability.`,
    category: 'Connections',
    tags: ['entreprenrs', 'connect entreprenrs', 'username password', 'manual connect', 'timeline page group'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Chrxstians',
    content: `Connection type: Manual (platform login flow).\n\nHow to connect:\n1. In Connections, choose Chrxstians.\n2. Enter username/email and password.\n3. Save connection (API key/secret are globally managed by admin).\n\nHow to use:\n• Publish to timeline.\n• Publish to pages/groups by selecting destination ID where account has rights.\n\nIf it fails:\n• Recheck login details.\n• Ask admin to verify global CHRXSTIANS API credentials and endpoints.`,
    category: 'Connections',
    tags: ['chrxstians', 'connect chrxstians', 'username password', 'timeline', 'page', 'group'],
    priority: 10,
  },
  {
    title: 'How to Connect and Use Iohah',
    content: `Connection type: Manual (platform login flow).\n\nHow to connect:\n1. In Connections, choose Iohah.\n2. Enter username/email and password.\n3. Save connection (API key/secret are globally managed by admin).\n\nHow to use:\n• Publish to timeline.\n• Publish to pages/groups by selecting destination ID where account has rights.\n\nIf it fails:\n• Recheck login details.\n• Ask admin to verify global IOHAH API credentials, publish endpoint, and permissions.`,
    category: 'Connections',
    tags: ['iohah', 'connect iohah', 'username password', 'timeline', 'page', 'group'],
    priority: 10,
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
      content: `Use this checklist before publishing to ${profile.name} from SmmtAI.\n\nFormat requirements: ${profile.format}\nCharacter limits: ${profile.characterLimit}\n\nPublishing checklist:\n1. Confirm your media dimensions and file size match platform requirements.\n2. Write a platform-native opener that hooks in the first sentence.\n3. Add CTA language that matches campaign goals (click, comment, save, or reply).\n4. Preview post formatting in SmmtAI before publishing.\n5. Validate links, mentions, hashtags, and brand/legal constraints.\n\nExecution workflow in SmmtAI: Compose → select ${profile.name} → upload media → run preview → Publish Now or Schedule.`,
      category: 'Connections',
      tags: [profile.slug, platformTag, 'content specs', 'dimensions', 'publishing checklist', 'format requirements'],
      priority: 6,
    },
    {
      title: `${profile.name} Growth Strategy in SmmtAI`,
      content: `Use this framework to grow consistently on ${profile.name}.\n\nRecommended cadence: ${profile.cadence}\nBest posting windows: ${profile.bestTimes}\n\nContent mix recommendation:\n• 40% educational/value content\n• 30% social proof or community stories\n• 20% product/service promotions\n• 10% experiments (new formats, trends, hooks)\n\nOptimization loop:\n1. Plan weekly themes in Calendar.\n2. Schedule content in batches.\n3. Compare performance by post type and posting hour.\n4. Double down on top performers and retire weak formats.\n\nUse tags and labels in SmmtAI to track each campaign and compare outcomes by objective.`,
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
      'Assign each planned post to one pillar and label it in SmmtAI.',
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
      'Use SmmtAI previews to validate platform-specific rendering.',
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
      'Compare campaign performance in web analytics and SmmtAI reports.',
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

const workflowAndAdminArticles = [
  {
    title: 'Using Instagram Inbox (DMs)',
    content: `SmmtAI includes an Instagram Inbox page for direct message workflows.\n\nPrerequisites:\n• At least one active Instagram connection in Connections\n• The connected account must have messaging permissions\n\nHow to use:\n1. Go to Inbox.\n2. Select a conversation from the left panel.\n3. Read the thread and send a reply from the message box.\n4. Use Refresh to load latest conversations/messages.\n\nImportant behavior:\n• The UI is built for Human Agent messaging windows.\n• If recipient resolution fails, reconnect Instagram and reload conversations.`,
    category: 'Features',
    tags: ['instagram inbox', 'dm', 'direct messages', 'messaging', 'reply', 'human agent'],
    priority: 8,
  },
  {
    title: 'Instagram Inbox Troubleshooting',
    content: `Use this checklist when Instagram Inbox does not work as expected.\n\nNo conversations shown:\n• Confirm at least one active Instagram connection exists.\n• Reconnect Instagram and approve messaging scopes.\n\nMessages fail to send:\n• Refresh conversation list and reopen the thread.\n• Confirm recipient can be resolved (non-self participant).\n• Reconnect account if token/permissions changed.\n\nCommon fixes:\n• Connections → Check/Reconnect.\n• Retry from Inbox after refreshing.\n• If still failing, capture exact error text from UI for support.`,
    category: 'Troubleshooting',
    tags: ['instagram inbox failed', 'dm failed', 'recipient error', 'messaging troubleshooting'],
    priority: 8,
  },
  {
    title: 'Managing Instagram Comments',
    content: `SmmtAI Comment Manager lets you moderate Instagram comments from one place.\n\nHow it works:\n1. Open Comments page.\n2. Select a published Instagram post.\n3. View comments and threaded replies.\n4. Reply, hide/show, or delete comments.\n\nBest practices:\n• Refresh before moderation on high-activity posts.\n• Use hide for temporary moderation and delete for final removal.\n• Track recurring questions and turn answers into saved templates.`,
    category: 'Features',
    tags: ['comment manager', 'instagram comments', 'reply comment', 'hide comment', 'delete comment'],
    priority: 8,
  },
  {
    title: 'Comment Manager Troubleshooting',
    content: `If Comment Manager is empty or actions fail, use this recovery flow.\n\nNo posts listed:\n• Publish at least one Instagram post first.\n• Ensure the post is in published status.\n\nNo comments returned:\n• Select the correct Instagram post.\n• Refresh comments for that media item.\n\nReply/hide/delete failing:\n• Reconnect Instagram to refresh permissions.\n• Confirm connection is active and belongs to current workspace.\n• Retry action after refresh.`,
    category: 'Troubleshooting',
    tags: ['comments troubleshooting', 'instagram moderation errors', 'failed to reply'],
    priority: 8,
  },
  {
    title: 'Using Entrepreneurs Directory',
    content: `The Entrepreneurs page shows live profiles from active Entreprenrs connections.\n\nWhat you can do:\n• Search by name, workspace, account name, account ID, or bio.\n• Filter by subscription tier.\n• Open quick email contact from each profile card.\n\nData source:\n• Profiles are pulled from active Entreprenrs connections across workspaces.\n• Duplicate owners are deduplicated to one profile entry.`,
    category: 'Features',
    tags: ['entrepreneurs', 'directory', 'entreprenrs profiles', 'search', 'filter'],
    priority: 7,
  },
  {
    title: 'Custom Destinations: Timeline, Page, and Group',
    content: `Custom platforms support destination-aware publishing in Compose.\n\nCurrent destination options:\n• Entreprenrs: timeline or page\n• Chrxstians: timeline, page, or group\n• Iohah: timeline, page, or group\n\nHow selection works:\n• Compose auto-loads available pages/groups when supported.\n• Selected destination is injected into platform metadata for publish.\n• If a destination is not selected, timeline is used by default.`,
    category: 'Connections',
    tags: ['destination', 'timeline', 'page', 'group', 'compose destination'],
    priority: 9,
  },
  {
    title: 'Fix Missing Pages or Groups in Compose',
    content: `If page/group dropdowns are empty for custom platforms:\n\n1. Confirm the account actually has managed pages/groups.\n2. Confirm user has posting rights on that page/group.\n3. Reconnect the platform to refresh credentials.\n4. Refresh Compose and reselect connection.\n\nPlatform-specific notes:\n• Chrxstians and Iohah show create-page/group links when nothing is returned.\n• Entreprenrs falls back to manual page ID entry when page list is unavailable.`,
    category: 'Troubleshooting',
    tags: ['missing pages', 'missing groups', 'compose dropdown empty', 'destination list'],
    priority: 9,
  },
  {
    title: 'Global Credentials vs User Login (Entreprenrs, Chrxstians, Iohah)',
    content: `SmmtAI supports global admin credentials plus user-level login.\n\nModel:\n• Admin configures platform API secrets globally in Admin Settings.\n• End users connect with username/email + password only.\n• Backend enriches credential flow with global secrets where required.\n\nBenefits:\n• Users do not need API keys/secrets.\n• Credential management stays centralized.\n• Faster onboarding for less technical users.`,
    category: 'Connections',
    tags: ['global credentials', 'admin secrets', 'user login', 'manual connect', 'custom platforms'],
    priority: 10,
  },
  {
    title: 'Admin Setup: Platform Credentials',
    content: `Configure platform credentials in Admin Settings → Platform Credentials.\n\nWhat to enter:\n• OAuth platforms (Facebook, Instagram, TikTok, LinkedIn, X, YouTube, Pinterest): Client ID + Client Secret\n• Entreprenrs: Access Token + Server Key\n• Chrxstians/Iohah: API Key + API Secret\n• Telegram: Bot Token + default Chat ID (optional but recommended)\n\nTips:\n• Save credentials, then run a fresh connection flow.\n• Reconnect existing accounts after major credential changes.`,
    category: 'Account',
    tags: ['admin settings', 'platform credentials', 'client id', 'client secret', 'api key', 'api secret'],
    priority: 9,
  },
  {
    title: 'Admin Setup: SMTP Email',
    content: `Configure outbound email in Admin Settings → SMTP / Email.\n\nRequired fields:\n• SMTP host\n• Port\n• Username\n• Password\n• From address\n• Secure mode (true/false)\n\nRecommended process:\n1. Fill SMTP values from your mail provider.\n2. Save configuration.\n3. Run Test Connection to a real inbox.\n4. Confirm delivery before enabling production notifications.`,
    category: 'Account',
    tags: ['smtp', 'email setup', 'notifications', 'mail server', 'admin email'],
    priority: 8,
  },
  {
    title: 'Admin Setup: Cloud Storage (DigitalOcean, Wasabi, MinIO)',
    content: `Configure media storage in Admin Settings → Cloud Storage.\n\nSupported providers:\n• DigitalOcean Spaces\n• Wasabi\n• MinIO (S3-compatible)\n\nFields:\n• Provider\n• Endpoint\n• Region\n• Bucket\n• Access key\n• Secret key\n\nValidation flow:\n1. Save storage config.\n2. Run Test Connection.\n3. Confirm bucket access before large media publishing.`,
    category: 'Account',
    tags: ['storage', 'digitalocean spaces', 'wasabi', 'minio', 's3', 'media storage'],
    priority: 8,
  },
  {
    title: 'Testing SMTP and Storage Connections',
    content: `After updating admin credentials, always run connection tests.\n\nSMTP test:\n• Uses provided SMTP values to send a test email.\n• Fix host/port/auth or secure mode if test fails.\n\nStorage test:\n• Validates endpoint/auth and bucket accessibility.\n• Fix endpoint format, region, key pair, or bucket policy on failure.\n\nBest practice:\n• Test immediately after every credential change.\n• Keep a short runbook with known good values per environment.`,
    category: 'Troubleshooting',
    tags: ['test smtp', 'test storage', 'admin diagnostics', 'credential validation'],
    priority: 7,
  },
  {
    title: 'Connection Health Checks and Reconnect Flow',
    content: `Use Connection Check to validate active account tokens and permissions.\n\nHow to use:\n1. Open Connections.\n2. Click Check on connected accounts.\n3. If status is Expired or Needs attention, use Reconnect.\n\nWhen to reconnect:\n• Token expired\n• OAuth scopes changed\n• Platform permissions updated\n• Publishing or analytics suddenly fails`,
    category: 'Connections',
    tags: ['connection health', 'reconnect', 'expired token', 'needs attention', 'check account'],
    priority: 8,
  },
  {
    title: 'OAuth Callback Errors in Connections',
    content: `Common callback error states and meaning:\n\n• invalid_platform: platform is unsupported\n• invalid_connection_mode: wrong connect method (OAuth vs manual)\n• missing_params: authorization callback returned incomplete data\n• invalid_state: expired/invalid state value\n• connection_failed: provider returned failure reason\n\nFix pattern:\n1. Verify callback URL in provider app settings.\n2. Ensure app credentials and scopes are correct.\n3. Start connection again from Connections page.`,
    category: 'Troubleshooting',
    tags: ['oauth callback', 'invalid_state', 'connection_failed', 'redirect uri', 'auth errors'],
    priority: 8,
  },
  {
    title: 'TikTok Publishing Error Playbook',
    content: `TikTok errors often map to app review status, account privacy, and media-transfer rules.\n\nFrequent causes:\n• unaudited_client_can_only_post_to_private_accounts\n• url_ownership_unverified (for pull-from-URL flows)\n• missing scopes or sandbox/production mismatch\n\nFix checklist:\n1. Ensure correct TikTok app mode (sandbox vs production) and scopes.\n2. For unaudited app constraints, use private account mode where required.\n3. Complete URL ownership verification for publishing domain.\n4. Reconnect TikTok after changing app settings.\n\nNote:\n• Browser-only workspaces may disable MEDIA_UPLOAD fallback by design.`,
    category: 'Troubleshooting',
    tags: ['tiktok failed', 'unaudited client', 'url ownership unverified', 'scope error', 'browser-only'],
    priority: 10,
  },
  {
    title: 'YouTube Connection Error Playbook',
    content: `Resolve common YouTube OAuth/API setup failures quickly.\n\nredirect_uri_mismatch:\n• Add exact SmmtAI callback URL in Google OAuth client.\n\naccess_denied in testing mode:\n• Add account as OAuth test user or publish app to production.\n\nYouTube Data API not enabled:\n• Enable YouTube Data API v3 in the same Google project as OAuth client.\n• Wait a few minutes, then reconnect.\n\nAlways reconnect after Google project changes.`,
    category: 'Troubleshooting',
    tags: ['youtube oauth', 'redirect_uri_mismatch', 'access_denied', 'youtube data api v3'],
    priority: 10,
  },
  {
    title: 'Twitter/X Connection Error Playbook',
    content: `If X connection fails with HTTP 403 about Project attachment:\n\nRoot cause:\n• App keys/tokens are not from an app attached to a Project in X Developer Portal.\n\nFix steps:\n1. Ensure app is linked to a Project.\n2. Use correct app type (Web App confidential client for server OAuth).\n3. Set exact callback URL from SmmtAI.\n4. Confirm required app permissions and OAuth 2.0 settings.\n5. Reconnect from Connections page after updates.`,
    category: 'Troubleshooting',
    tags: ['twitter 403', 'x project required', 'x oauth', 'callback uri', 'developer portal'],
    priority: 9,
  },
  {
    title: 'LinkedIn Analytics Permission Warnings',
    content: `LinkedIn analytics may return warnings even when publishing succeeds.\n\nTypical warning classes:\n• Not enough permissions\n• socialActions.GET.NO_VERSION\n• Temporary fetch/network failures\n\nCurrent behavior:\n• SmmtAI returns safe fallback metrics (zeros) plus warning context.\n• Post remains published; analytics may populate later.\n\nRecommended action:\n• Verify LinkedIn scopes/version settings.\n• Reconnect account after scope changes.\n• Retry analytics fetch later if warning indicates temporary failure.`,
    category: 'Analytics',
    tags: ['linkedin analytics', 'permissions', 'socialActions.GET.NO_VERSION', 'fallback metrics'],
    priority: 8,
  },
  {
    title: 'Understanding Post Analytics Modal',
    content: `Post History → Analytics shows per-platform live or cached metrics.\n\nWhat each state means:\n• Live: metrics fetched from platform API now\n• Cached: last saved analytics snapshot used\n• Error message + No data: platform endpoint unavailable or not implemented\n\nDisplayed metrics:\n• Impressions, reach, likes, comments, shares, clicks, saves (platform dependent)\n\nIf a platform shows no analytics yet:\n• Wait for platform metric availability and retry.`,
    category: 'Analytics',
    tags: ['post analytics modal', 'live metrics', 'cached metrics', 'no analytics data'],
    priority: 8,
  },
  {
    title: 'Where to Open Published Post Links',
    content: `SmmtAI stores platform references and tries to provide a View link per platform outcome.\n\nWhere to find links:\n1. Open Post History.\n2. Open a published/partial post.\n3. In each platform card, use the View link when available.\n\nIf View is missing:\n• Platform may not have returned a URL.\n• SmmtAI still stores platform reference ID for tracing and support.`,
    category: 'Features',
    tags: ['view post link', 'published url', 'post history', 'platform reference'],
    priority: 7,
  },
  {
    title: 'Draft Autosave and Draft Management',
    content: `Compose supports both autosave and manual draft workflows.\n\nAutosave behavior:\n• Triggers while editing content/media/platform selections.\n• Pauses if advanced metadata JSON is invalid.\n\nManual draft actions:\n• Save Draft to persist changes immediately.\n• Open any saved draft from the Drafts panel.\n• Delete old drafts you no longer need.\n\nTip:\n• Keep metadata JSON valid to avoid autosave pause state.`,
    category: 'Features',
    tags: ['draft autosave', 'save draft', 'open draft', 'delete draft', 'compose'],
    priority: 8,
  },
  {
    title: 'Approval Workflow: Submit, Approve, Reject',
    content: `Team approval workflows help control publishing quality.\n\nFlow:\n1. Contributor creates draft.\n2. Submit for approval.\n3. Admin/owner reviews and approves or rejects.\n4. Approved posts can be published/scheduled.\n\nRejected posts:\n• Cannot be published until edited and resubmitted.\n\nBest practice:\n• Define approval criteria (copy, media, compliance, links) so reviews stay consistent.`,
    category: 'Collaboration',
    tags: ['approval workflow', 'submit approval', 'approve post', 'reject post', 'team governance'],
    priority: 8,
  },
  {
    title: 'Advanced Platform Metadata JSON (Compose)',
    content: `Compose supports optional advanced metadata JSON for per-platform overrides.\n\nValidation rules:\n• Must be valid JSON\n• Root must be an object\n• Each entry value must be an object\n\nKeying options:\n• By connection ID\n• By platform name\n• Platform-specific keys (for example page/group destination fields)\n\nUse cases:\n• Force destination overrides\n• Attach platform-specific flags\n• Pass advanced publish options when supported`,
    category: 'Features',
    tags: ['advanced metadata', 'compose json', 'platform overrides', 'connection metadata'],
    priority: 7,
  },
  {
    title: 'Billing Operations: Upgrade, Downgrade, and Portal',
    content: `Billing page supports plan upgrades, downgrades, and Stripe customer portal access.\n\nWhat to expect:\n• Upgrade: usually immediate\n• Downgrade: confirmation required; feature limits reduce to target tier\n• Manage Billing: opens Stripe portal for payment method and invoices\n\nOperational tip:\n• Check platform and usage limits before downgrading to avoid workflow interruptions.`,
    category: 'Account',
    tags: ['billing portal', 'upgrade', 'downgrade', 'subscription operations', 'plan limits'],
    priority: 7,
  },
  {
    title: 'Telegram Setup Best Practice for SaaS Workspaces',
    content: `Telegram integration is bot-based, not user OAuth.\n\nRecommended model:\n• Admin sets global bot token once\n• Users choose destination chat/channel/group they control\n• Bot must be added to destination with posting rights\n\nWhy this is best:\n• Faster onboarding for users\n• Centralized bot governance\n• Consistent publishing behavior across workspace users`,
    category: 'Connections',
    tags: ['telegram bot', 'botfather', 'chat id', 'channel posting', 'best practice'],
    priority: 8,
  },
  {
    title: 'Iohah, Chrxstians, and Entreprenrs Account Onboarding',
    content: `Users must have accounts on custom platforms before connecting them.\n\nCurrent onboarding links in Connections:\n• Iohah: https://iohah.com/signup\n• Chrxstians: https://chrxstians.com/signup\n• Entreprenrs: https://entreprenrs.com/register\n\nHow to use:\n1. Create account on target platform.\n2. Return to Connections.\n3. Connect with username/email and password.\n4. Start publishing to supported destinations.`,
    category: 'Getting Started',
    tags: ['custom platform onboarding', 'signup links', 'iohah signup', 'chrxstians signup', 'entreprenrs register'],
    priority: 8,
  },
  {
    title: 'Telegram Channels and Groups: Complete Connection Guide',
    content: `Use this end-to-end flow to connect Telegram correctly in SmmtAI.\n\nWhat Telegram uses:\n• Telegram connection is Bot API based (not normal user OAuth login).\n• A bot can only post in chats/channels/groups where it has permission.\n\nStep 1: Create a bot\n1. Open Telegram and message @BotFather.\n2. Run /newbot and complete setup.\n3. Copy the bot token.\n\nStep 2: Add bot to destination\n1. Open your channel or group.\n2. Add your bot account (for example @smmtai_helper_bot).\n3. Promote bot to admin in channels and grant post permissions.\n4. In groups, ensure bot can send messages and media.\n\nStep 3: Set credentials in SmmtAI\n• Admin path: Settings → Admin → Platform Credentials → Telegram.\n• Set global bot token once (recommended for SaaS).\n• Optional: set a default chat ID/channel username.\n\nStep 4: User connection flow\n1. User opens Connections → Telegram.\n2. Enter destination chat value (channel username or numeric chat ID).\n3. Save and run Connection Check.\n4. Send a test post from Compose.\n\nDestination examples:\n• Public channel: @yourchannelusername\n• Private channel/group/supergroup: numeric chat ID (usually starts with -100)\n\nMedia behavior:\n• Telegram supports text, photo, and video.\n• If Telegram rejects remote media URL fetch, SmmtAI falls back to safe message delivery where possible.`,
    category: 'Connections',
    tags: ['telegram', 'telegram channel', 'telegram group', 'botfather', 'bot token', 'chat id', 'connect telegram', 'telegram setup'],
    priority: 10,
  },
  {
    title: 'How to Get Telegram Chat ID (Channel, Group, or Private Chat)',
    content: `If you do not know your Telegram destination ID, use this method.\n\nA. Verify your bot token first\nOpen in browser:\nhttps://api.telegram.org/bot<BOT_TOKEN>/getMe\nExpected: {"ok":true,...}\n\nB. Generate updates for target destination\n1. Add bot to the target channel/group.\n2. Send one message in that destination.\n3. If channel: post a message in channel after bot is admin.\n4. If group: send any message in group where bot is present.\n\nC. Read updates\nOpen:\nhttps://api.telegram.org/bot<BOT_TOKEN>/getUpdates\nFind result.message.chat.id or result.channel_post.chat.id.\n\nWhat value to use in SmmtAI:\n• Public channel: use @channelusername directly.\n• Private channel: use numeric chat ID from getUpdates.\n• Group/supergroup: use numeric chat ID from getUpdates.\n\nCommon errors and fixes:\n• "chat not found" → wrong ID/username or bot not added.\n• "not enough rights to send text messages" → promote bot and grant permissions.\n• "wrong type of the web page content" → media URL is not direct/compatible; retry with supported media URL or upload media directly.`,
    category: 'Troubleshooting',
    tags: ['telegram chat id', 'getupdates', 'channel_post', 'chat not found', 'telegram error', 'group id'],
    priority: 10,
  },
  {
    title: 'Connection Checklist for All Supported Platforms',
    content: `Use this checklist to connect any platform in SmmtAI with fewer errors.\n\nUniversal flow:\n1. Confirm platform app credentials are configured by admin.\n2. Open Connections and start a fresh connect flow.\n3. Approve all requested scopes/permissions.\n4. Run Connection Check.\n5. Send one test post before production scheduling.\n\nOAuth platforms:\n• Facebook\n• Instagram\n• TikTok\n• LinkedIn\n• Twitter/X\n• YouTube\n• Pinterest\n\nManual/login platforms:\n• Telegram (bot token + destination)\n• Entreprenrs (username/email + password; admin secrets global)\n• Chrxstians (username/email + password; admin secrets global)\n• Iohah (username/email + password; admin secrets global)\n• Bluesky (handle/email + app password)\n• Mastodon (instance URL + token)\n\nCustom platform onboarding links:\n• Entreprenrs: https://entreprenrs.com/register\n• Chrxstians: https://chrxstians.com/signup\n• Iohah: https://iohah.com/signup\n\nIf connection succeeds but posting fails:\n• Recheck destination permissions (page/group/channel).\n• Verify media format/size and platform limits.\n• Review exact error text in Post History and reconnect after permission changes.`,
    category: 'Connections',
    tags: ['connection checklist', 'oauth setup', 'manual setup', 'platform onboarding', 'post failed after connect'],
    priority: 10,
  },
  {
    title: 'Custom Platform Publishing: Timeline, Page, and Group Selection',
    content: `SmmtAI supports destination-aware posting for custom platforms.\n\nSupported destinations:\n• Entreprenrs: timeline, page\n• Chrxstians: timeline, page, group\n• Iohah: timeline, page, group\n\nHow to publish to the right destination:\n1. Connect account with username/email and password.\n2. Open Compose and select platform connection.\n3. Choose destination type (timeline/page/group).\n4. Select page/group from loaded list.\n5. Publish or schedule.\n\nHow destination loading works:\n• System fetches pages/groups tied to the connected account.\n• If nothing is returned, timeline is used by default.\n• If account has no pages/groups yet, create one on platform and refresh.\n\nWhy dropdown can be empty:\n• Account has no managed pages/groups.\n• Account lacks posting rights.\n• Token/session expired; reconnect needed.\n\nBest practice:\n• Run a timeline test first, then page/group test, then schedule automation.`,
    category: 'Connections',
    tags: ['timeline page group', 'destination selection', 'iohah pages groups', 'chrxstians pages groups', 'entreprenrs page'],
    priority: 10,
  },
];

const quickFixFaqArticles = [
  {
    title: 'FAQ: Why does Connections show "Needs attention"?',
    content: `This usually means token expiry or revoked permissions.\n\nFix:\n1. Go to Connections.\n2. Click Check.\n3. If still unhealthy, click Reconnect and re-authorize all requested scopes.`,
    category: 'FAQ',
    tags: ['faq', 'needs attention', 'reconnect', 'token expired'],
    priority: 7,
  },
  {
    title: 'FAQ: Why is my account connected but post failed?',
    content: `Connected status only confirms auth, not publish eligibility.\n\nCheck:\n• Media format/size limits\n• Platform permissions/roles\n• Destination rights (page/group)\n• Platform-side API or policy errors in Post History`,
    category: 'FAQ',
    tags: ['faq', 'post failed', 'connected but not posting'],
    priority: 8,
  },
  {
    title: 'FAQ: How do I reconnect a platform safely?',
    content: `Reconnect flow:\n1. Open Connections.\n2. Click Reconnect on the platform card.\n3. Approve all permissions again.\n4. Return and run Check.\n\nThis keeps workspace history while refreshing credentials.`,
    category: 'FAQ',
    tags: ['faq', 'reconnect platform', 'refresh credentials'],
    priority: 7,
  },
  {
    title: 'FAQ: Why are Chrxstians/Iohah asking for API keys?',
    content: `Users should connect with username/email + password only.\n\nIf API key fields appear:\n• Admin global credentials are likely missing or invalid.\n• Configure API key/secret in Admin Settings → Platform Credentials.\n• Retry connection after saving.`,
    category: 'FAQ',
    tags: ['faq', 'iohah', 'chrxstians', 'api credentials missing'],
    priority: 8,
  },
  {
    title: 'FAQ: Why are page/group selectors empty?',
    content: `Page/group lists are loaded from the connected account.\n\nIf empty:\n• User has no managed pages/groups, or lacks permission\n• Connection token lacks required access\n• Reconnect and reload Compose`,
    category: 'FAQ',
    tags: ['faq', 'empty page list', 'empty group list', 'destination selector'],
    priority: 8,
  },
  {
    title: 'FAQ: Can I post to timeline without page/group ID?',
    content: `Yes. Timeline is the default destination.\n\nPage/group ID is only required when destination is set to page or group.`,
    category: 'FAQ',
    tags: ['faq', 'timeline default', 'page id', 'group id'],
    priority: 6,
  },
  {
    title: 'FAQ: Why do image URLs appear as text on posts?',
    content: `Raw links appear when media is sent as plain text instead of attached media.\n\nFix:\n• Upload media through Compose media upload\n• Ensure platform adapter maps media to attachment fields, not caption text`,
    category: 'FAQ',
    tags: ['faq', 'image link text', 'media attachment'],
    priority: 8,
  },
  {
    title: 'FAQ: Why does analytics show 404 or HTML/JSON parse errors?',
    content: `This indicates the remote analytics endpoint is missing or returning non-JSON.\n\nFix:\n• Confirm platform analytics endpoint exists\n• Ensure endpoint returns JSON error/success payloads only\n• Retry analytics from Post History`,
    category: 'FAQ',
    tags: ['faq', 'analytics 404', 'invalid json', 'unexpected token'],
    priority: 8,
  },
  {
    title: 'FAQ: Why does LinkedIn analytics show permission errors?',
    content: `LinkedIn can publish successfully while analytics permission remains limited.\n\nFix:\n• Verify LinkedIn scopes and API version settings\n• Reconnect after scope/version changes\n• Retry later for temporary fetch issues`,
    category: 'FAQ',
    tags: ['faq', 'linkedin analytics', 'not enough permissions'],
    priority: 7,
  },
  {
    title: 'FAQ: Why does TikTok fail with private-account or URL ownership errors?',
    content: `Common TikTok blockers:\n• unaudited_client_can_only_post_to_private_accounts\n• url_ownership_unverified\n\nFix:\n• Set account private if app is unaudited\n• Complete domain URL ownership verification\n• Reconnect TikTok after settings updates`,
    category: 'FAQ',
    tags: ['faq', 'tiktok private account', 'url ownership unverified'],
    priority: 9,
  },
  {
    title: 'FAQ: What does "MEDIA_UPLOAD fallback is disabled" mean?',
    content: `Your workspace is configured for browser-only TikTok publishing.\n\nMeaning:\n• Direct post mode is used\n• Upload fallback is intentionally disabled\n\nAction:\n• Fix direct-post prerequisites (scope, app mode, URL verification).`,
    category: 'FAQ',
    tags: ['faq', 'media upload fallback', 'browser-only', 'tiktok'],
    priority: 8,
  },
  {
    title: 'FAQ: Why does YouTube show redirect_uri_mismatch?',
    content: `Google OAuth callback URL does not exactly match configured redirect URI.\n\nFix:\n• Add exact SmmtAI YouTube callback URI in Google OAuth client\n• Save and retry connection`,
    category: 'FAQ',
    tags: ['faq', 'youtube', 'redirect_uri_mismatch', 'google oauth'],
    priority: 9,
  },
  {
    title: 'FAQ: Why does YouTube say Data API v3 not enabled?',
    content: `YouTube Data API v3 is disabled in the OAuth project.\n\nFix:\n1. Enable YouTube Data API v3 in the same Google project.\n2. Wait a few minutes for propagation.\n3. Reconnect and retry.`,
    category: 'FAQ',
    tags: ['faq', 'youtube data api v3', 'api disabled'],
    priority: 9,
  },
  {
    title: 'FAQ: Why does X/Twitter connection fail with 403 project error?',
    content: `The app is not properly attached to a Project in X Developer Portal.\n\nFix:\n• Attach app to a Project\n• Verify app type/permissions/callback URL\n• Reconnect from SmmtAI`,
    category: 'FAQ',
    tags: ['faq', 'x 403', 'twitter project required'],
    priority: 9,
  },
  {
    title: 'FAQ: Why can’t users connect Telegram by normal login?',
    content: `Telegram integration is bot-based, not user OAuth login.\n\nUsers need:\n• A bot token (or admin-provided global bot)\n• A destination chat/channel/group where bot has posting rights`,
    category: 'FAQ',
    tags: ['faq', 'telegram login', 'bot token', 'chat id'],
    priority: 7,
  },
  {
    title: 'FAQ: Where do I see the published post link?',
    content: `Open Post History, then check each platform outcome row.\n\nUse the View link when available. If missing, use the platform reference ID for support tracing.`,
    category: 'FAQ',
    tags: ['faq', 'view published link', 'post history'],
    priority: 6,
  },
  {
    title: 'FAQ: Why does autosave stop in Compose?',
    content: `Autosave pauses when advanced platform metadata JSON is invalid.\n\nFix:\n• Correct metadata JSON format\n• Keep root object and per-entry object values`,
    category: 'FAQ',
    tags: ['faq', 'autosave paused', 'compose metadata json'],
    priority: 7,
  },
  {
    title: 'FAQ: Why can’t I publish rejected posts?',
    content: `Rejected posts are blocked from direct publish.\n\nFix:\n1. Edit the rejected post/draft.\n2. Resubmit for approval.\n3. Publish after approval.`,
    category: 'FAQ',
    tags: ['faq', 'rejected post', 'approval workflow'],
    priority: 7,
  },
  {
    title: 'FAQ: Why am I prompted to upgrade before connecting a platform?',
    content: `Your current plan tier limits available platforms/features.\n\nFix:\n• Upgrade from Billing page to unlock the target platform.`,
    category: 'FAQ',
    tags: ['faq', 'upgrade required', 'plan limit', 'locked platform'],
    priority: 6,
  },
  {
    title: 'FAQ: What should users do before connecting custom platforms?',
    content: `Users must create an account on the target platform first.\n\nSign-up links:\n• Iohah: iohah.com/signup\n• Chrxstians: chrxstians.com/signup\n• Entreprenrs: entreprenrs.com/register`,
    category: 'FAQ',
    tags: ['faq', 'custom platform signup', 'iohah', 'chrxstians', 'entreprenrs'],
    priority: 6,
  },
];

const ACTIVE_PLATFORM_PROFILE_SLUGS = new Set([
  'facebook',
  'instagram',
  'twitter-x',
  'linkedin',
  'tiktok',
  'youtube',
  'pinterest',
  'mastodon',
  'bluesky',
]);

const platformDeepDiveArticles = platformProfiles
  .filter((profile) => ACTIVE_PLATFORM_PROFILE_SLUGS.has(profile.slug))
  .flatMap(buildPlatformDeepDiveArticles);
const advancedGuides = advancedGuideDefinitions.map(({ overview, steps, metrics, pitfalls, ...article }) => ({
  ...article,
  content: buildGuideContent({ overview, steps, metrics, pitfalls }),
}));

const articles = [
  ...coreArticles,
  ...platformConnectionHowToArticles,
  ...platformDeepDiveArticles,
  ...advancedGuides,
  ...workflowAndAdminArticles,
  ...quickFixFaqArticles,
];

const obsoleteKnowledgeTitles = new Set([
  'Connecting Threads',
  'Connecting Tumblr',
  'Connecting Reddit',
  'Connecting Google Business Profile',
  'Threads Content Specs & Publishing Checklist',
  'Threads Growth Strategy in SmmtAI',
  'Threads Analytics Playbook',
  'Troubleshooting Threads Connection and Publishing',
  'Tumblr Content Specs & Publishing Checklist',
  'Tumblr Growth Strategy in SmmtAI',
  'Tumblr Analytics Playbook',
  'Troubleshooting Tumblr Connection and Publishing',
  'Reddit Content Specs & Publishing Checklist',
  'Reddit Growth Strategy in SmmtAI',
  'Reddit Analytics Playbook',
  'Troubleshooting Reddit Connection and Publishing',
  'Google Business Profile Content Specs & Publishing Checklist',
  'Google Business Profile Growth Strategy in SmmtAI',
  'Google Business Profile Analytics Playbook',
  'Troubleshooting Google Business Profile Connection and Publishing',
]);

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase();
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiJson(path, token, options = {}, attempt = 0) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const message = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
    const isRateLimit = res.status === 429 || /too many requests/i.test(message);
    if (isRateLimit && attempt < 5) {
      const delayMs = (attempt + 1) * 1200;
      await sleep(delayMs);
      return apiJson(path, token, options, attempt + 1);
    }
    throw new Error(message);
  }
  return data;
}

async function main() {
  if (!process.argv[2] || !process.argv[3]) {
    console.error('Usage: node scripts/seed-kb.mjs <email> <password>');
    process.exit(1);
  }
  console.log('Getting auth token...');
  const token = await getToken();
  console.log('Authenticated');

  console.log(`Syncing ${articles.length} knowledge base articles (create/update by title)...`);

  const existingRes = await apiJson('/chat/knowledge', token, { method: 'GET' });
  const existingEntries = Array.isArray(existingRes.data) ? existingRes.data : [];
  let removed = 0;
  for (const entry of existingEntries) {
    const title = String(entry?.title || '').trim();
    if (!title || !entry?.id || !obsoleteKnowledgeTitles.has(title)) continue;
    try {
      await apiJson(`/chat/knowledge/${entry.id}`, token, { method: 'DELETE' });
      removed += 1;
    } catch (error) {
      console.warn(`Could not remove obsolete article "${title}":`, error instanceof Error ? error.message : error);
    }
  }

  const refreshedRes = await apiJson('/chat/knowledge', token, { method: 'GET' });
  const refreshedEntries = Array.isArray(refreshedRes.data) ? refreshedRes.data : [];
  const existingByTitle = new Map();
  for (const entry of refreshedEntries) {
    const key = normalizeTitle(entry?.title);
    if (!key || existingByTitle.has(key)) continue;
    existingByTitle.set(key, entry);
  }

  let created = 0;
  let updated = 0;
  let errors = [];

  async function syncArticle(article) {
    const key = normalizeTitle(article.title);
    const existing = existingByTitle.get(key);
    if (existing?.id) {
      await apiJson(`/chat/knowledge/${existing.id}`, token, {
        method: 'PUT',
        body: JSON.stringify(article),
      });
      updated += 1;
      return;
    }
    const createdRes = await apiJson('/chat/knowledge', token, {
      method: 'POST',
      body: JSON.stringify(article),
    });
    const createdEntry = createdRes?.data;
    if (createdEntry?.id) existingByTitle.set(key, createdEntry);
    created += 1;
  }

  for (const article of articles) {
    try {
      await syncArticle(article);
    } catch (error) {
      errors.push({
        title: article.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    await sleep(180);
  }

  if (errors.length > 0) {
    const retryErrors = [];
    for (const failed of errors) {
      const article = articles.find((item) => item.title === failed.title);
      if (!article) {
        retryErrors.push(failed);
        continue;
      }

      let resolved = false;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          await sleep(attempt * 1500);
          await syncArticle(article);
          resolved = true;
          break;
        } catch (error) {
          if (attempt === 5) {
            retryErrors.push({
              title: article.title,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
      if (!resolved) await sleep(200);
    }
    errors = retryErrors;
  }

  console.log(`Knowledge base sync complete. Created: ${created}, Updated: ${updated}, Removed obsolete: ${removed}, Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Errors:', JSON.stringify(errors, null, 2));
  }
}

main().catch(console.error);
