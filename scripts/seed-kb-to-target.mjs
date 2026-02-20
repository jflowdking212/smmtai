/**
 * Expand knowledge base to a target total count.
 * Run: node scripts/seed-kb-to-target.mjs <email> <password> [target]
 */

const API_BASE = 'http://localhost:4016/api/v1';

async function getToken(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!data.data?.accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(data)}`);
  }
  return data.data.accessToken;
}

async function getCurrentTotal(token) {
  const res = await fetch(`${API_BASE}/chat/knowledge`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!Array.isArray(data.data)) {
    throw new Error(`Failed to read knowledge base: ${JSON.stringify(data)}`);
  }
  return data.data.length;
}

function buildPlatformCoverage(profile) {
  return [
    {
      title: `${profile.name} Comment Moderation Workflow`,
      content: `Use this moderation workflow to keep ${profile.name} conversations healthy and on-brand.\n\nDaily workflow:\n1. Review new comments and mentions twice per day.\n2. Tag comments as support, sales, feedback, spam, or abuse.\n3. Route support/sales threads to the right owner with response SLA.\n4. Hide or remove policy-violating comments per channel rules.\n\nEscalation rules:\n• Urgent legal/safety issues escalate immediately to admin leads.\n• Repeat abuse patterns trigger account-level safety review.\n• Keep response tone calm, factual, and brand-consistent.`,
      category: 'Collaboration',
      tags: [profile.slug, profile.name.toLowerCase(), 'moderation', 'comment management', 'community safety', 'workflow'],
      priority: 6,
    },
    {
      title: `${profile.name} Community Engagement Playbook`,
      content: `Increase engagement quality on ${profile.name} with a structured interaction model.\n\nEngagement system:\n1. Post with one clear conversation starter.\n2. Reply to early comments within 30-60 minutes when possible.\n3. Ask one follow-up question to deepen thread quality.\n4. Turn recurring audience questions into future content.\n\nQuality signals to track:\n• Reply depth and meaningful comment rate\n• Saves/shares vs passive reactions\n• Returning commenters over time`,
      category: 'Features',
      tags: [profile.slug, profile.name.toLowerCase(), 'community engagement', 'reply strategy', 'audience growth', 'engagement playbook'],
      priority: 6,
    },
    {
      title: `${profile.name} Campaign QA Checklist Before Scheduling`,
      content: `Run this QA checklist before scheduling ${profile.name} campaigns in EE PostMind.\n\nPre-schedule checks:\n1. Confirm objective and CTA are explicit.\n2. Validate media specs, thumbnail quality, and caption length.\n3. Verify links, tracking parameters, and destination page health.\n4. Review compliance items (claims, disclosures, legal copy).\n5. Preview final rendering and approve from the correct workspace.\n\nPost-schedule check:\n• Re-open Calendar and spot-check publish times and platform selection.`,
      category: 'Getting Started',
      tags: [profile.slug, profile.name.toLowerCase(), 'qa checklist', 'campaign setup', 'scheduling quality', 'publish readiness'],
      priority: 6,
    },
    {
      title: `${profile.name} Content Experiment Framework`,
      content: `Use this experiment framework to improve results on ${profile.name}.\n\nExperiment loop:\n1. Choose one variable to test (hook, CTA, format, visual style, or length).\n2. Publish controlled variants in comparable time windows.\n3. Label variants clearly for reporting.\n4. Measure outcome after sufficient sample size.\n5. Keep winners and archive lessons in templates.\n\nRecommended metrics:\n• Engagement rate lift\n• Click-through or conversion lift\n• Retention/completion for video-heavy formats`,
      category: 'Analytics',
      tags: [profile.slug, profile.name.toLowerCase(), 'experimentation', 'ab testing', 'optimization', 'performance testing'],
      priority: 6,
    },
  ];
}

const platformProfiles = [
  { name: 'Facebook', slug: 'facebook' },
  { name: 'Instagram', slug: 'instagram' },
  { name: 'Twitter/X', slug: 'twitter-x' },
  { name: 'LinkedIn', slug: 'linkedin' },
  { name: 'TikTok', slug: 'tiktok' },
  { name: 'YouTube', slug: 'youtube' },
  { name: 'Pinterest', slug: 'pinterest' },
  { name: 'Threads', slug: 'threads' },
  { name: 'Mastodon', slug: 'mastodon' },
  { name: 'Bluesky', slug: 'bluesky' },
  { name: 'Tumblr', slug: 'tumblr' },
  { name: 'Reddit', slug: 'reddit' },
  { name: 'Google Business Profile', slug: 'google-business-profile' },
];

const globalCoverage = [
  {
    title: 'Crisis Communication Social Response Runbook',
    content: `Use this runbook when high-risk incidents or negative viral moments occur.\n\nResponse sequence:\n1. Pause scheduled non-essential content.\n2. Assign incident owner, approver, and spokesperson.\n3. Publish a factual holding statement quickly.\n4. Route high-risk replies to legal/comms review.\n5. Resume normal posting only after incident stabilization.\n\nAfter-action review:\n• Document timeline, outcomes, and process fixes for future readiness.`,
    category: 'Troubleshooting',
    tags: ['crisis response', 'incident management', 'social risk', 'runbook', 'reputation management'],
    priority: 8,
  },
  {
    title: 'Social Inbox Escalation Matrix for Teams',
    content: `Define who handles what so response quality stays high as volume grows.\n\nEscalation tiers:\n• Tier 1: Basic FAQs and routine comments\n• Tier 2: Billing/product issues needing specialist context\n• Tier 3: Legal, security, harassment, or PR-sensitive incidents\n\nOperational rules:\n1. Set owner and backup for each tier.\n2. Define SLA by severity.\n3. Track escalations and close-the-loop outcomes weekly.`,
    category: 'Collaboration',
    tags: ['escalation', 'team workflow', 'support operations', 'social inbox', 'sla'],
    priority: 7,
  },
  {
    title: 'New Team Member Onboarding for EE PostMind',
    content: `Use this onboarding checklist to ramp new contributors quickly and safely.\n\nFirst-week checklist:\n1. Grant minimum required role and workspace access.\n2. Share brand voice, approval rules, and compliance standards.\n3. Assign template library and campaign naming conventions.\n4. Shadow one content cycle from draft to publish.\n5. Complete a supervised publish simulation.\n\nSuccess criteria:\n• New member can draft, route, and schedule content without policy errors.`,
    category: 'Getting Started',
    tags: ['onboarding', 'team setup', 'new member', 'training', 'workspace roles'],
    priority: 7,
  },
  {
    title: 'Quarterly Content Governance Audit',
    content: `A quarterly governance audit keeps your social operation consistent and compliant.\n\nAudit scope:\n1. Access and permission hygiene\n2. Template and brand consistency\n3. Legal/compliance disclosures\n4. Archived campaigns and stale assets\n5. Incident logs and escalation outcomes\n\nDeliverables:\n• Risk register\n• Remediation owners\n• Deadline-based action plan`,
    category: 'Account',
    tags: ['governance', 'audit', 'compliance', 'permissions', 'operational review'],
    priority: 7,
  },
  {
    title: 'Brand Safety and Compliance Controls',
    content: `Apply brand safety controls before scaling campaign output.\n\nCore controls:\n1. Define restricted claims and high-risk topics.\n2. Require approval for regulated or sensitive messaging.\n3. Maintain approved disclosure language library.\n4. Enforce media and copyright checks before publish.\n5. Audit random published posts weekly.\n\nOutcome:\n• Lower legal risk and more consistent audience trust.`,
    category: 'Account',
    tags: ['brand safety', 'policy controls', 'legal review', 'compliance checklist', 'risk prevention'],
    priority: 7,
  },
  {
    title: 'KPI Goal-Setting Framework for Social Teams',
    content: `Set KPI targets that map social activity to business outcomes.\n\nFramework:\n1. Define primary goal (awareness, engagement, lead-gen, retention).\n2. Pick 3-5 leading and lagging indicators.\n3. Set baseline, target, and review cadence.\n4. Tie campaign experiments to one measurable KPI shift.\n5. Review monthly and adjust targets by trend.\n\nReporting tip:\n• Always pair KPI movement with actions taken so stakeholders see causality.`,
    category: 'Analytics',
    tags: ['kpi framework', 'goal setting', 'measurement plan', 'analytics strategy', 'reporting'],
    priority: 7,
  },
  {
    title: 'Social Listening Workflow for Content Teams',
    content: `Social listening helps you turn audience signals into better content decisions.\n\nWorkflow:\n1. Monitor recurring questions, complaints, and terminology.\n2. Group insights into topic clusters weekly.\n3. Prioritize clusters by impact and frequency.\n4. Convert top clusters into posts, FAQs, and campaign angles.\n\nReview cadence:\n• Weekly insight digest plus monthly trend summary.`,
    category: 'General',
    tags: ['social listening', 'audience insights', 'topic discovery', 'content research'],
    priority: 6,
  },
  {
    title: 'Campaign Naming Convention Standard',
    content: `A standard naming convention improves reporting clarity and team coordination.\n\nRecommended format:\n[Brand]-[Region]-[Objective]-[Quarter]-[Theme]\n\nImplementation steps:\n1. Publish naming rules in team docs.\n2. Enforce names for posts, templates, and labels.\n3. Reject non-standard names during approval.\n4. Use naming schema in exports and stakeholder reports.`,
    category: 'Collaboration',
    tags: ['naming convention', 'campaign organization', 'team standards', 'reporting clarity'],
    priority: 6,
  },
  {
    title: 'Monthly Content Retrospective Process',
    content: `Run a monthly retrospective to continuously improve publishing quality.\n\nRetrospective agenda:\n1. Review top and bottom performers by objective.\n2. Identify repeatable creative and copy patterns.\n3. Document misses and likely root causes.\n4. Define next-month experiments and owners.\n\nOutput:\n• A concise action log integrated into next month planning.`,
    category: 'Analytics',
    tags: ['retrospective', 'continuous improvement', 'monthly review', 'optimization process'],
    priority: 6,
  },
  {
    title: 'Handling Sensitive Comments and DMs',
    content: `Use a consistent approach for sensitive messages to reduce risk and improve trust.\n\nGuidelines:\n1. Acknowledge concern without escalating tone.\n2. Avoid sharing private data publicly.\n3. Move account-specific issues to private channels quickly.\n4. Escalate safety threats immediately to designated leads.\n\nQuality standard:\n• Response should be empathetic, precise, and policy-aligned.`,
    category: 'Troubleshooting',
    tags: ['sensitive comments', 'dm handling', 'escalation', 'community management', 'support protocol'],
    priority: 7,
  },
  {
    title: 'Client Reporting Framework for Agencies',
    content: `Agency teams should standardize reporting so clients get consistent, decision-ready insights.\n\nFramework:\n1. Start with business objective and KPI trend summary.\n2. Show platform-level results and notable campaign learnings.\n3. Include actions completed and next actions planned.\n4. Add risks, blockers, and support needed from client stakeholders.`,
    category: 'Collaboration',
    tags: ['agency reporting', 'client communication', 'stakeholder update', 'performance reporting'],
    priority: 6,
  },
  {
    title: 'Lead Qualification From Social Campaigns',
    content: `Improve lead quality by defining qualification signals before launching campaigns.\n\nImplementation:\n1. Align on qualification criteria with sales/ops teams.\n2. Use CTA and landing pages matched to funnel stage.\n3. Track source and intent using UTM conventions.\n4. Review lead quality weekly and adjust targeting/creative.`,
    category: 'Analytics',
    tags: ['lead qualification', 'funnel strategy', 'campaign attribution', 'conversion quality'],
    priority: 7,
  },
];

const articlePool = [...platformProfiles.flatMap(buildPlatformCoverage), ...globalCoverage];

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const target = Number(process.argv[4] || 200);

  if (!email || !password || Number.isNaN(target)) {
    console.error('Usage: node scripts/seed-kb-to-target.mjs <email> <password> [target]');
    process.exit(1);
  }

  const token = await getToken(email, password);
  const currentTotal = await getCurrentTotal(token);
  const needed = target - currentTotal;

  console.log(`Current total: ${currentTotal}`);
  console.log(`Target total: ${target}`);
  console.log(`Needed entries: ${needed > 0 ? needed : 0}`);

  if (needed <= 0) {
    return;
  }

  if (needed > articlePool.length) {
    console.error(`Not enough prepared entries. Needed ${needed}, available ${articlePool.length}.`);
    process.exit(1);
  }

  const entries = articlePool.slice(0, needed);
  const importRes = await fetch(`${API_BASE}/chat/knowledge/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ entries }),
  });
  const importData = await importRes.json();

  if (importData.success === false || importData.data?.imported !== entries.length) {
    console.error('Import failed:', JSON.stringify(importData, null, 2));
    process.exit(1);
  }

  const finalTotal = await getCurrentTotal(token);
  console.log(`Imported ${importData.data.imported}/${entries.length} entries`);
  console.log(`Final total: ${finalTotal}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
