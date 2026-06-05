const fs = require('fs');

// ─── 1. Add YouTube Trending + SocialBuzz (aggregator) source to backend ───
const collectorPath = '/home/smmt/apps/api/src/services/trends/trend-collector.service.ts';
let c = fs.readFileSync(collectorPath, 'utf8');

// Add YouTube Trending via their HTML page / RSS
if (!c.includes('fetchYouTubeTrends')) {
  const ytFunction = `
async function fetchYouTubeTrends() {
  const results: any[] = [];
  // YouTube trending via RSS feeds for different categories
  const categories = [
    { url: 'https://www.youtube.com/feeds/videos.xml?chart=trending&gl=US', tag: 'Trending US' },
  ];
  
  for (const cat of categories) {
    try {
      const xml = await fetchText(cat.url);
      // Parse entries from Atom XML
      const entries = xml.split('<entry>').slice(1, 16);
      for (const entry of entries) {
        const titleMatch = entry.match(/<title>([^<]+)<\\/title>/);
        const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);
        const viewsMatch = entry.match(/<media:statistics views="(\\d+)"/);
        const authorMatch = entry.match(/<name>([^<]+)<\\/name>/);
        if (!titleMatch) continue;
        const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        const views = viewsMatch ? parseInt(viewsMatch[1], 10) : 0;
        results.push({
          topic: title,
          platform: 'youtube',
          score: Math.min(Math.round(views / 500000), 100),
          engagementCount: views,
          growthRate: Math.min(Math.round(views / 100000), 500),
          sourceUrl: linkMatch ? linkMatch[1] : '',
          category: 'Entertainment',
        });
      }
    } catch (e: any) { console.warn('[YouTube] ' + e.message); }
  }
  return results;
}

`;

  const classMarker = 'export class TrendCollectorService {';
  c = c.replace(classMarker, ytFunction + classMarker);
  console.log('✅ Added fetchYouTubeTrends()');

  // Register in sources array
  c = c.replace(
    "{ name: 'Mastodon',     fn: fetchMastodonTrends },",
    "{ name: 'Mastodon',     fn: fetchMastodonTrends },\n      { name: 'YouTube',      fn: fetchYouTubeTrends },"
  );
  console.log('✅ Registered YouTube in sources');
  
  fs.writeFileSync(collectorPath, c, 'utf8');
}

// ─── 2. Add YouTube to frontend SOURCE_ICON ───
const trendPagePath = '/home/smmt/apps/web/src/pages/TrendPage.tsx';
let tp = fs.readFileSync(trendPagePath, 'utf8');

if (!tp.includes("youtube: '▶️'")) {
  tp = tp.replace(
    "mastodon: '🐘',",
    "mastodon: '🐘',\n  youtube: '▶️',"
  );
  console.log('✅ Added YouTube icon');
}

// ─── 3. Update the PLATFORMS tab bar to include social icons ───
// Find the PLATFORMS array
const oldPlatforms = tp.match(/const PLATFORMS = \[[\s\S]*?\];/);
if (oldPlatforms) {
  const newPlatforms = `const PLATFORMS = [
  { id: 'all', label: '🌐 All Platforms' },
  { id: 'google_trends', label: '📊 Google Trends' },
  { id: 'youtube', label: '▶️ YouTube' },
  { id: 'mastodon', label: '🐘 Mastodon / X' },
  { id: 'reddit', label: '🟠 Reddit' },
  { id: 'hackernews', label: '🟧 Hacker News' },
  { id: 'github', label: '⚡ GitHub' },
  { id: 'devto', label: '💻 Dev.to' },
  { id: 'wikipedia', label: '📖 Wikipedia' },
];`;
  tp = tp.replace(oldPlatforms[0], newPlatforms);
  console.log('✅ Updated PLATFORMS tabs with all sources');
}

fs.writeFileSync(trendPagePath, tp, 'utf8');
console.log('✅ Saved TrendPage.tsx');

console.log('\n🎉 YouTube + Social platform tabs added!');
