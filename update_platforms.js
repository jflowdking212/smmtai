const fs = require('fs');
const trendPagePath = '/home/smmt/apps/web/src/pages/TrendPage.tsx';
let tp = fs.readFileSync(trendPagePath, 'utf8');

// Replace PLATFORMS array
const oldPlatformsRegex = /const PLATFORMS = \[[\s\S]*?\];/;
const newPlatforms = `const PLATFORMS = [
  { id: 'all', label: '🌐 All Platforms' },
  { id: 'google_trends', label: '📊 Google Trends' },
  { id: 'twitter', label: '🐦 Twitter / X' },
  { id: 'tiktok', label: '📱 TikTok' },
  { id: 'youtube', label: '▶️ YouTube' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'facebook', label: '👥 Facebook' },
  { id: 'reddit', label: '🟠 Reddit' },
  { id: 'hackernews', label: '🟧 Hacker News' },
  { id: 'github', label: '⚡ GitHub' },
  { id: 'devto', label: '💻 Dev.to' },
  { id: 'wikipedia', label: '📖 Wikipedia' },
];`;

tp = tp.replace(oldPlatformsRegex, newPlatforms);
console.log('✅ Replaced PLATFORMS in TrendPage.tsx');

// Replace SOURCE_ICON definition
const oldSourceIconRegex = /const SOURCE_ICON: Record<string, string> = \{[\s\S]*?\};/;
const newSourceIcon = `const SOURCE_ICON: Record<string, string> = {
  google_trends: '📊',
  twitter: '🐦',
  tiktok: '📱',
  youtube: '▶️',
  instagram: '📸',
  facebook: '👥',
  reddit: '🟠',
  hackernews: '🟧',
  github: '⚡',
  devto: '💻',
  wikipedia: '📖',
  mastodon: '🐘',
};`;

tp = tp.replace(oldSourceIconRegex, newSourceIcon);
console.log('✅ Replaced SOURCE_ICON in TrendPage.tsx');

// Fix display text in card for platform name mappings
// Find: {trend.platform === 'google_trends' ? 'Google' : trend.platform === 'hackernews' ? 'HN' : trend.platform.charAt(0).toUpperCase() + trend.platform.slice(1)}
// Let's make it show prettier names:
tp = tp.replace(
  "trend.platform === 'google_trends' ? 'Google' : trend.platform === 'hackernews' ? 'HN' : trend.platform.charAt(0).toUpperCase() + trend.platform.slice(1)",
  "trend.platform === 'google_trends' ? 'Google' : trend.platform === 'hackernews' ? 'HN' : trend.platform === 'devto' ? 'Dev.to' : trend.platform.charAt(0).toUpperCase() + trend.platform.slice(1)"
);
console.log('✅ Optimized platform label logic in TrendPage.tsx');

fs.writeFileSync(trendPagePath, tp, 'utf8');
console.log('✅ Saved TrendPage.tsx');
