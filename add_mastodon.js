const fs = require('fs');
const collectorPath = '/home/smmt/apps/api/src/services/trends/trend-collector.service.ts';
let c = fs.readFileSync(collectorPath, 'utf8');

// ─── Add Mastodon Trending source ───
if (c.includes('fetchMastodonTrends')) {
  console.log('⏩ Mastodon source already added');
} else {
  const mastodonFunction = `
async function fetchMastodonTrends() {
  const results: any[] = [];
  const instances = ['mastodon.social', 'mstdn.social', 'mas.to'];
  
  for (const instance of instances) {
    // Trending tags
    try {
      const tags = await fetchJson(\`https://\${instance}/api/v1/trends/tags?limit=20\`);
      for (const tag of (tags || [])) {
        if (!tag?.name) continue;
        const totalUses = (tag.history || []).reduce((s: number, d: any) => s + parseInt(d.uses || '0', 10), 0);
        const totalAccounts = (tag.history || []).reduce((s: number, d: any) => s + parseInt(d.accounts || '0', 10), 0);
        results.push({
          topic: \`#\${tag.name} trending on Mastodon\`,
          platform: 'mastodon',
          score: Math.min(Math.round(totalUses / 10), 100),
          engagementCount: totalUses + totalAccounts,
          growthRate: Math.min(totalAccounts * 3, 300),
          sourceUrl: tag.url || \`https://\${instance}/tags/\${tag.name}\`,
        });
      }
    } catch (e: any) { console.warn(\`[Mastodon tags \${instance}] \${e.message}\`); }

    // Trending statuses (posts)
    try {
      const statuses = await fetchJson(\`https://\${instance}/api/v1/trends/statuses?limit=10\`);
      for (const status of (statuses || [])) {
        if (!status?.content) continue;
        const text = status.content.replace(/<[^>]+>/g, '').slice(0, 200);
        if (!text || text.length < 15) continue;
        const reblogs = status.reblogs_count || 0;
        const favs = status.favourites_count || 0;
        const replies = status.replies_count || 0;
        results.push({
          topic: text,
          platform: 'mastodon',
          score: Math.min(Math.round((reblogs + favs) / 15), 100),
          engagementCount: reblogs + favs + replies,
          growthRate: Math.min(reblogs * 5, 300),
          sourceUrl: status.url || status.uri || '',
        });
      }
    } catch (e: any) { console.warn(\`[Mastodon statuses \${instance}] \${e.message}\`); }

    await sleep(500);
  }
  return results;
}

`;

  // Insert before TrendCollectorService class
  const classMarker = 'export class TrendCollectorService {';
  if (c.includes(classMarker)) {
    c = c.replace(classMarker, mastodonFunction + classMarker);
    console.log('✅ Added fetchMastodonTrends() source');
  }

  // Register in sources array
  if (c.includes("{ name: 'GoogleTrends', fn: fetchGoogleTrends },")) {
    c = c.replace(
      "{ name: 'GoogleTrends', fn: fetchGoogleTrends },",
      "{ name: 'GoogleTrends', fn: fetchGoogleTrends },\n      { name: 'Mastodon',     fn: fetchMastodonTrends },"
    );
    console.log('✅ Registered Mastodon in sources array');
  }

  fs.writeFileSync(collectorPath, c, 'utf8');
  console.log('✅ Saved trend-collector.service.ts');
}

// ─── Add mastodon to SOURCE_ICON on frontend ───
const trendPagePath = '/home/smmt/apps/web/src/pages/TrendPage.tsx';
let tp = fs.readFileSync(trendPagePath, 'utf8');

if (!tp.includes("mastodon: '🐘'")) {
  tp = tp.replace(
    "devto: '💻',",
    "devto: '💻',\n  mastodon: '🐘',"
  );
  console.log('✅ Added mastodon icon to SOURCE_ICON');
  fs.writeFileSync(trendPagePath, tp, 'utf8');
}

console.log('\n🎉 Mastodon trends source added!');
