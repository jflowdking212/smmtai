# EE PostMind — Social Media Management Platform

## Project Vision

A comprehensive, industry-grade social media management platform enabling users to create, design, schedule, and analyze posts across 8+ social platforms from a single app. Powered by AI content generation (OpenAI), a modern drag-and-drop editor, and unified analytics.

## Design Philosophy

- **Ultra-modern minimalist** — generous white space, light palette (soft grays, whites)
- **Accent color**: Vibrant blue (`#2563EB`) for CTAs, with green (`#10B981`) for success states
- **Typography**: Inter (primary), Poppins (headings) — clean sans-serif
- **Grid**: 12-column flexible grid, 8px spacing system
- **Micro-interactions**: Subtle hover effects, button animations, smooth transitions
- **Mobile-first**: Vertical flow, large touch targets, collapsible sidebar
- **Dashboard**: Cockpit feel — clear sections, real-time stats, smooth UX

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript | Type safety, dynamic UI |
| Styling | Tailwind CSS 3 | Utility-first, rapid UI dev |
| State | Zustand + React Query | Lightweight state + server cache |
| Canvas Editor | Fabric.js | Mature drag-and-drop canvas |
| Backend API | Node.js + Express + TypeScript | Scalable REST/GraphQL APIs |
| AI Microservice | Python (FastAPI) | OpenAI integration, ML tasks |
| Database | PostgreSQL (primary) | Users, plans, scheduling |
| Cache/Queue | Redis + BullMQ | Job scheduling, caching |
| Auth | Passport.js + JWT + OAuth 2.0 | Social logins, session mgmt |
| Payments | Stripe | Subscriptions, billing |
| Storage | AWS S3 / Cloudflare R2 | Media assets, templates |
| Hosting | AWS (backend), Vercel (frontend) | Scalable cloud deployment |
| CI/CD | GitHub Actions | Automated testing & deploy |
| Monitoring | Sentry + Datadog | Error tracking, APM |

## Target Platforms & API Capabilities

### ❌ REMOVED — No Viable API
| Platform | Reason |
|---|---|
| ~~Rumble~~ | No public API for posting or analytics. Only unofficial scrapers exist — unreliable and may violate TOS. |

### ✅ CONFIRMED — Major Platforms (7)
| Platform | Post | Stories/Reels | Analytics | Ads API | Notes |
|---|---|---|---|---|---|
| Facebook | ✅ | ✅ | ✅ | ✅ | Graph API v18+ |
| Instagram | ✅ | ✅ | ✅ | ✅ | Via Facebook Graph API (Business accounts) |
| TikTok | ✅ | — | ✅ | ✅ | Content Posting API + Research API |
| LinkedIn | ✅ | — | ✅ | ✅ | Marketing API (org pages + personal) |
| X (Twitter) | ✅ | — | ✅ | ✅ | API v2 (paid tiers required) |
| YouTube | ✅ | ✅ (Shorts) | ✅ | ✅ | Data API v3 + Analytics API |
| Pinterest | ✅ | — | ✅ | ✅ | Pinterest API v5 |

### ✅ YOUR OWN PLATFORMS (2)
| Platform | Post | Analytics | Notes |
|---|---|---|---|
| entreprenrs.com (WoWonder) | ✅ | ⚠️ Basic | REST API: `/api/create-post`, `/api/get-user-data`, `/api/get-posts`. Auth via access_token + server_key. Analytics limited to post counts/likes — no deep engagement metrics natively. User will supply full API docs. |
| chrxstians.com (Sngine) | ✅ | ⚠️ Basic | REST API: `POST /api/posts`, `GET /api/posts/{id}`. OAuth/JWT auth. Analytics via Creator Studio plugin — not API-native. User will supply full API docs. |
| iohah.com (Sngine) | ✅ | ⚠️ Basic | Same Sngine REST API as chrxstians.com. Separate instance — own auth tokens & endpoints. User will supply full API docs. |

### ✅ NEW SUGGESTIONS — Added Platforms with API Compatibility (3)
| Platform | Post | Analytics | Ads API | Notes |
|---|---|---|---|---|
| Bluesky | ✅ | ✅ | ❌ | Built on AT Protocol. Full public REST API — post, read feeds, manage interactions. Open & decentralized. Well-documented. |
| Mastodon | ✅ | ✅ | ❌ | Open-source, federated (Fediverse). Full REST API with OAuth2. Post, read timelines, manage accounts. Supports any Mastodon instance. |
| Telegram | ✅ (Channels/Groups) | ⚠️ Basic | ❌ | Bot API for posting to channels & groups. Robust, well-documented. Not for personal feed posts — channel/group publishing only. |

### 📊 Final Platform Count: 12
| Category | Platforms | Count |
|---|---|---|
| Major social | Facebook, Instagram, TikTok, LinkedIn, X, YouTube, Pinterest | 7 |
| Your platforms | entreprenrs.com, chrxstians.com, iohah.com | 3 |
| New additions | Bluesky, Mastodon, Telegram | 3 |
| **Total** | | **13** |

---

# MILESTONES

---

## Milestone 1: Project Foundation & Infrastructure
> **Goal**: Monorepo setup, dev environment, CI/CD, database schema, base UI shell

- [x] **1.1** Initialize monorepo structure (Turborepo or Nx)
  ```
  smmt/
  ├── apps/
  │   ├── web/          # React frontend
  │   ├── api/          # Node.js backend
  │   └── ai-service/   # Python AI microservice
  ├── packages/
  │   ├── shared/       # Shared types, utils
  │   ├── ui/           # Shared UI component library
  │   └── db/           # Prisma schema, migrations
  ├── docker-compose.yml
  ├── turbo.json
  └── package.json
  ```
- [x] **1.2** Configure TypeScript, ESLint, Prettier across all packages
- [x] **1.3** Set up PostgreSQL + Prisma ORM with initial schema
  - Users, Accounts, Subscriptions, SocialConnections, Posts, Schedules, Analytics
- [x] **1.4** Set up Redis (caching + job queues)
- [x] **1.5** Docker Compose for local dev (Postgres, Redis, API, AI service)
- [x] **1.6** GitHub Actions CI pipeline (lint, type-check, test on PR)
- [x] **1.7** React app scaffold with Tailwind CSS, routing (React Router v6), base layout
- [x] **1.8** Design system foundation
  - Color tokens, typography scale, spacing system
  - Base components: Button, Input, Card, Modal, Badge, Avatar, Tooltip
  - Dark mode support (CSS variables)
- [x] **1.9** Responsive app shell: sidebar nav, top bar, main content area, mobile drawer

---

## Milestone 2: Authentication & User Management
> **Goal**: Full auth system with social logins, user profiles, team support

- [x] **2.1** Registration & login (email/password with bcrypt)
- [x] **2.2** JWT access + refresh token flow (httpOnly cookies)
- [x] **2.3** OAuth 2.0 social login (Google, GitHub, Facebook)
- [x] **2.4** Email verification & password reset (SendGrid/Resend)
- [x] **2.5** User profile management (avatar upload to S3, bio, timezone)
- [x] **2.6** Team/workspace model
  - Roles: Owner, Admin, Editor, Viewer
  - Invite by email, accept/decline flow
- [x] **2.7** Auth middleware, rate limiting, CORS configuration
- [x] **2.8** Frontend auth pages (sign up, login, forgot password, verify email)
  - Ultra-modern split-screen layout, animated transitions
- [x] **2.9** Protected route system + auth state management

---

## Milestone 3: Subscription & Payment System (Stripe)
> **Goal**: Tiered plans, billing portal, usage limits

- [x] **3.1** Define subscription tiers:
  | Feature | Free | Pro ($19/mo) | Business ($49/mo) | Enterprise (Custom) |
  |---|---|---|---|---|
  | Social accounts | 3 | 10 | 25 | Unlimited |
  | Posts/month | 30 | 300 | Unlimited | Unlimited |
  | AI generations/month | 10 | 100 | 500 | Unlimited |
  | Templates | Basic (10) | All (50+) | All + custom | All + custom |
  | Team members | 1 | 3 | 10 | Unlimited |
  | Analytics | 7 days | 30 days | 90 days | Unlimited |
  | Priority support | ❌ | ✅ | ✅ | ✅ |
- [x] **3.2** Stripe integration — Products, Prices, Checkout Sessions
- [x] **3.3** Webhook handler for subscription lifecycle (created, updated, cancelled, payment failed)
- [x] **3.4** Stripe Customer Portal for self-service billing
- [x] **3.5** Usage tracking middleware (posts, AI calls, connected accounts)
- [x] **3.6** Frontend: Pricing page, upgrade/downgrade flow, billing settings
- [x] **3.7** Trial period support (14-day free trial on Pro)
- [x] **3.8** Dunning management — failed payment retry, grace period

---

## Milestone 4: Social Platform Connections
> **Goal**: OAuth flows to connect all 8 platforms, token management

- [x] **4.1** Social connection architecture
  - Encrypted token storage (AES-256)
  - Auto-refresh mechanism for expiring tokens
  - Connection health monitoring
- [x] **4.2** Facebook/Instagram connection (Facebook Graph API OAuth)
- [x] **4.3** X (Twitter) connection (OAuth 2.0 PKCE)
- [x] **4.4** LinkedIn connection (OAuth 2.0)
- [x] **4.5** TikTok connection (OAuth 2.0)
- [x] **4.6** YouTube connection (Google OAuth 2.0)
- [x] **4.7** Pinterest connection (OAuth 2.0)
- [x] **4.8** Bluesky connection (AT Protocol auth — app passwords or OAuth)
- [x] **4.9** Mastodon connection (OAuth 2.0 — instance URL + app registration)
- [x] **4.10** Telegram connection (Bot API — bot token + channel/group linking)
- [x] **4.11** entreprenrs.com connection (WoWonder API — access_token + server_key)
- [x] **4.12** chrxstians.com connection (Sngine API — JWT/OAuth token)
- [x] **4.13** iohah.com connection (Sngine API — JWT/OAuth token, separate instance)
- [x] **4.14** Frontend: "Connect Accounts" page — card-based UI, connection status, disconnect/reconnect
- [x] **4.15** Platform abstraction layer — unified interface for all 13 platform operations

---

## Milestone 5: AI Content Generation (OpenAI Integration)
> **Goal**: Python AI microservice for content generation, suggestions, and insights

- [x] **5.1** FastAPI microservice setup with OpenAI SDK
- [x] **5.2** Content generation endpoints:
  - Generate post caption (with tone, length, platform-specific optimization)
  - Generate hashtags (trending + niche)
  - Generate image prompts (for DALL·E)
  - Rewrite/improve existing content
  - Translate content
- [x] **5.3** AI content personalization
  - Brand voice profiles (formal, casual, witty, professional)
  - Industry-specific suggestions
  - Audience persona targeting
- [x] **5.4** Content compliance check (flag potentially problematic content)
- [x] **5.5** Rate limiting per subscription tier
- [x] **5.6** Response caching (Redis) to reduce API costs
- [x] **5.7** Frontend: AI assistant panel
  - Inline in editor, chat-like interface
  - "Generate", "Improve", "Translate" actions
  - Tone selector, platform selector
  - History of generated content

---

## Milestone 6: Content Editor & Design Tool
> **Goal**: Full drag-and-drop canvas editor with templates and dynamic sizing

- [x] **6.1** Fabric.js canvas integration with React
- [x] **6.2** Editor toolbar:
  - Text (headings, body, captions) with Google Fonts
  - Shapes (rectangles, circles, lines, arrows)
  - Image upload + Unsplash/Pexels integration
  - AI-generated images (DALL·E via AI service)
  - Background colors, gradients, patterns
  - Layers panel (z-index management)
  - Undo/redo stack
- [x] **6.3** Dynamic canvas sizing per platform:
  | Platform | Post | Story/Reel | Cover | Ad |
  |---|---|---|---|---|
  | Facebook | 1200×630 | 1080×1920 | 820×312 | 1200×628 |
  | Instagram | 1080×1080 | 1080×1920 | — | 1080×1080 |
  | TikTok | 1080×1920 | 1080×1920 | — | — |
  | LinkedIn | 1200×627 | — | 1128×191 | 1200×627 |
  | X | 1600×900 | — | 1500×500 | 800×418 |
  | YouTube | 1280×720 | 1080×1920 | 2560×1440 | — |
  | Pinterest | 1000×1500 | 1080×1920 | — | 1000×1500 |
  | Bluesky | 1200×630 | — | — | — |
  | Mastodon | 1200×630 | — | — | — |
  | Telegram | 1280×720 | — | — | — |
  | entreprenrs.com | 1200×630 | — | — | — |
  | chrxstians.com | 1200×630 | — | — | — |
  | iohah.com | 1200×630 | — | — | — |
- [x] **6.4** Auto-resize: intelligent content reflow when switching platform/size
- [x] **6.5** 50 premade templates (organized by category):
  - Business/Corporate (10)
  - Food & Restaurant (5)
  - Fashion & Beauty (5)
  - Tech & SaaS (5)
  - Fitness & Health (5)
  - Travel & Lifestyle (5)
  - E-commerce/Sale (5)
  - Motivational/Quotes (5)
  - Event/Announcement (5)
- [x] **6.6** Template browser with preview, search, and filter
- [x] **6.7** Save as custom template, export as PNG/JPG/PDF
- [x] **6.8** Collaborative editing indicators (who's editing what — for teams)

---

## Milestone 7: Post Composer & Multi-Platform Publishing
> **Goal**: Unified composer to create and publish posts across platforms

- [x] **7.1** Post composer UI:
  - Platform selector (multi-select which platforms to post to)
  - Per-platform caption customization (character limits, hashtag rules)
  - Media attachment (images from editor, video upload, carousel)
  - Preview per platform (accurate mockup of how it'll look)
  - Link preview / URL card
- [x] **7.2** Platform-specific validation:
  - Character limits (X: 280, LinkedIn: 3000, etc.)
  - Media requirements (aspect ratios, file sizes, formats)
  - Hashtag limits (Instagram: 30, LinkedIn: 5 recommended)
- [x] **7.3** Publishing engine:
  - Direct publish (immediate)
  - Queue system (BullMQ) for reliable delivery
  - Retry logic with exponential backoff
  - Status tracking (pending, published, failed)
- [x] **7.4** Multi-platform publish (fan-out to selected platforms)
- [x] **7.5** Post history with status per platform
- [x] **7.6** Draft system — auto-save, manual save, draft management

---

## Milestone 8: Scheduling & Automation
> **Goal**: Calendar-based scheduling, queue management, auto-posting

- [x] **8.1** Scheduling backend:
  - BullMQ delayed jobs for precise scheduling
  - Timezone-aware scheduling (user's timezone)
  - Recurring posts (daily, weekly, custom)
  - Bulk scheduling (CSV import)
- [x] **8.2** Content calendar UI:
  - Month/week/day views
  - Drag-and-drop to reschedule
  - Color-coded by platform
  - Slot indicators (best times highlighted by AI)
- [x] **8.3** Queue management:
  - Queue slots per day/week
  - Auto-fill queue with suggested times
  - Pause/resume queue
- [x] **8.4** Smart scheduling:
  - AI-recommended posting times (per platform, per audience)
  - Avoid conflicts (don't double-post in short windows)
- [x] **8.5** Notification system:
  - Email/push notifications for: post published, post failed, upcoming scheduled posts
- [x] **8.6** Approval workflow (for teams):
  - Submit for review → Approve/Reject → Publish

---

## Milestone 9: Analytics Dashboard
> **Goal**: Unified analytics across all platforms, AI-driven insights

- [x] **9.1** Data ingestion pipeline:
  - Scheduled API calls to pull metrics from each platform
  - Normalize data into unified schema (impressions, reach, engagement, clicks)
  - Store in PostgreSQL with time-series indexing
- [x] **9.2** Dashboard home — "cockpit" layout:
  - Total followers (all platforms combined + per-platform)
  - Engagement rate (7d, 30d, 90d trends)
  - Top-performing posts (sortable by likes, shares, comments)
  - Audience growth chart (line graph)
  - Posting frequency heatmap
- [x] **9.3** Per-platform deep dive:
  - Platform-specific metrics (e.g., Instagram Saves, TikTok watch time)
  - Follower demographics (age, gender, location)
  - Best content types analysis
- [x] **9.4** Post-level analytics:
  - Individual post performance
  - Compare posts side-by-side
- [x] **9.5** AI-driven insights panel:
  - Best times to post (learned from user's data)
  - Trending topics in user's niche
  - Content recommendations ("Posts with questions get 2x engagement")
  - Competitor benchmarking (optional)
- [x] **9.6** Charts & visualization: Recharts or Chart.js
  - Line charts, bar charts, pie charts, heatmaps
  - Export as PNG or PDF report
- [x] **9.7** Scheduled reports (weekly/monthly email digest)

---

## Milestone 10: Testing, Security & Performance
> **Goal**: Production-grade quality, security hardening, performance optimization

- [x] **10.1** Backend unit tests (Jest) — 80%+ coverage on business logic
- [x] **10.2** API integration tests (Supertest)
- [x] **10.3** Frontend component tests (React Testing Library)
- [x] **10.4** E2E tests (Playwright) — critical user flows:
  - Sign up → connect account → create post → schedule → verify analytics
- [x] **10.5** Security hardening:
  - Helmet.js for HTTP headers
  - CSRF protection
  - Input sanitization (XSS prevention)
  - SQL injection prevention (Prisma parameterized queries)
  - Rate limiting (express-rate-limit + Redis)
  - Encrypted secrets (environment variables, Vault)
  - SOC 2 compliance considerations
- [x] **10.6** Performance optimization:
  - API response caching (Redis)
  - Database query optimization (indexes, connection pooling)
  - Frontend: code splitting, lazy loading, image optimization
  - CDN for static assets
  - Lighthouse score > 90
- [x] **10.7** Load testing (k6 or Artillery) — handle 1000+ concurrent users
- [x] **10.8** Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [x] **10.9** Mobile responsiveness QA (iOS Safari, Android Chrome)

---

## Milestone 11: Deployment & Infrastructure
> **Goal**: Production deployment, monitoring, scaling strategy

- [x] **11.1** Infrastructure as Code (Terraform or Pulumi)
- [x] **11.2** Backend deployment:
  - AWS ECS (Fargate) or DigitalOcean App Platform
  - Auto-scaling configuration
  - Health checks + readiness probes
- [x] **11.3** Frontend deployment:
  - Vercel (automatic preview deploys per PR)
  - Custom domain + SSL
- [x] **11.4** AI microservice deployment:
  - Containerized on AWS ECS or Railway
  - GPU instance option for future ML models
- [x] **11.5** Database:
  - AWS RDS (PostgreSQL) with read replicas
  - Automated backups, point-in-time recovery
  - Redis (ElastiCache) for caching/queues
- [x] **11.6** CI/CD pipeline:
  - GitHub Actions: lint → test → build → deploy (staging → production)
  - Preview environments per PR
  - Rollback strategy
- [x] **11.7** Monitoring & observability:
  - Sentry for error tracking
  - Datadog/Grafana for metrics & APM
  - Structured logging (Winston/Pino)
  - Uptime monitoring (BetterStack)
- [x] **11.8** CDN + WAF (Cloudflare)
- [x] **11.9** Backup & disaster recovery plan

---

## Milestone 12: Launch & Iteration
> **Goal**: Soft launch, feedback loop, continuous improvement

- [x] **12.1** Beta program — invite 50-100 early users
- [x] **12.2** In-app feedback widget (Canny or custom)
- [x] **12.3** Feature flags (LaunchDarkly or Unleash) for gradual rollout
- [x] **12.4** Onboarding flow:
  - Welcome wizard (connect first account, create first post)
  - Tooltips & guided tour (Shepherd.js)
  - Sample data for empty states
- [x] **12.5** Landing page & marketing site
- [x] **12.6** Documentation / help center (Notion or custom)
- [x] **12.7** Public launch
- [x] **12.8** Post-launch iteration priorities:
  - Additional templates (expand to 100+)
  - New platform integrations (Threads when API launches, Reddit)
  - AI image generation improvements
  - White-label option for agencies
  - Mobile app (React Native)
  - API for third-party integrations

---

## Key Architecture Decisions

### Database Schema (Core Entities)
```
User → has many → Workspace → has many → SocialConnection
                              → has many → Post → has many → PlatformPost
                              → has many → Template
                              → has many → Schedule
                              → has one  → Subscription (via Stripe)
Post → has many → Media
     → has many → PlatformPost (one per target platform, tracks status)
     → belongs to → Schedule (optional)
PlatformPost → has many → AnalyticsSnapshot
```

### API Design
- RESTful with consistent patterns (`/api/v1/...`)
- GraphQL considered for analytics queries (optional)
- Versioned API from day one
- OpenAPI spec for documentation

### Security Model
- Row-level security via workspace scoping
- All social tokens encrypted at rest (AES-256-GCM)
- Webhook signature verification for Stripe
- RBAC for team features

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| X (Twitter) API pricing | High | Abstract platform layer, easy to disable |
| OpenAI rate limits | Medium | Caching, queue, fallback to local models |
| Platform API changes | High | Abstraction layer, version pinning, monitoring |
| Scaling costs | Medium | Usage-based limits, efficient caching |
| WoWonder/Sngine API gaps | Medium | User supplies docs; build custom adapters; fallback to basic features |
| Mastodon instance fragmentation | Low | Support configurable instance URLs; test against major instances |
| Bluesky AT Protocol evolution | Low | Pin protocol version; monitor changelog |
| Telegram bot limitations | Low | Clearly scope to channel/group posting only; document limitations |

---

## Notes

- Start building from Milestone 1 forward — each builds on the previous
- Milestones 1-4 form the **foundation** (must be solid before features)
- Milestones 5-9 are the **core product** (can partially parallelize)
- Milestones 10-12 are **production readiness** (non-negotiable for launch)
- Estimated total: ~50-70 major tasks across 12 milestones
