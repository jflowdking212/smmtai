const fs = require('fs');

// ─── 1. ADD GOOGLE TRENDS RSS SOURCE to trend-collector.service.ts ───
const collectorPath = '/home/smmt/apps/api/src/services/trends/trend-collector.service.ts';
let collector = fs.readFileSync(collectorPath, 'utf8');

// Check if Google Trends already added
if (collector.includes('fetchGoogleTrends')) {
  console.log('⏩ Google Trends source already added, skipping');
} else {
  // Add XML parsing helper (lightweight, no dependency)
  const googleTrendsFunction = `
async function fetchGoogleTrends() {
  const results: any[] = [];
  const geos = ['US', 'GB', 'NG', 'IN', 'CA', 'AU']; // Multiple regions for diversity
  for (const geo of geos) {
    try {
      const url = \`https://trends.google.com/trending/rss?geo=\${geo}\`;
      const xml = await fetchText(url);
      // Parse items from RSS XML
      const items = xml.split('<item>').slice(1);
      for (const item of items.slice(0, 15)) {
        const titleMatch = item.match(/<title>(?:<!\\\[CDATA\\\[)?(.*?)(?:\\\]\\\]>)?<\\/title>/);
        const trafficMatch = item.match(/<ht:approx_traffic>(.*?)<\\/ht:approx_traffic>/);
        const linkMatch = item.match(/<link>(.*?)<\\/link>/);
        const newsItems = item.match(/<ht:news_item_title>(?:<!\\\[CDATA\\\[)?(.*?)(?:\\\]\\\]>)?<\\/ht:news_item_title>/g);

        if (!titleMatch) continue;
        const title = titleMatch[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, '').trim();
        const trafficStr = (trafficMatch?.[1] || '1,000').replace(/[^0-9]/g, '');
        const traffic = parseInt(trafficStr) || 1000;
        const link = linkMatch?.[1] || \`https://trends.google.com/trends/explore?q=\${encodeURIComponent(title)}&geo=\${geo}\`;

        // Extract news context for richer topic description
        let enrichedTopic = title;
        if (newsItems && newsItems.length > 0) {
          const firstNews = newsItems[0].replace(/<[^>]+>/g, '').replace(/<!\\[CDATA\\[|\\]\\]>/g, '').trim();
          if (firstNews && firstNews !== title) {
            enrichedTopic = \`\${title} — \${firstNews}\`.slice(0, 200);
          }
        }

        results.push({
          topic: enrichedTopic,
          platform: 'google_trends',
          score: Math.min(Math.round(traffic / 5000), 100),
          engagementCount: traffic,
          growthRate: Math.min(traffic / 200, 500),
          sourceUrl: link,
        });
      }
      await sleep(300);
    } catch (e: any) { console.warn(\`[GoogleTrends \${geo}] \${e.message}\`); }
  }
  return results;
}

`;

  // Add fetchText helper if it doesn't exist
  if (!collector.includes('function fetchText')) {
    const fetchTextHelper = `
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendBot/1.0)' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (c: Buffer) => { data += c.toString(); });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

`;
    // Insert after fetchJson function
    const fetchJsonEnd = collector.indexOf('function fetchJson');
    if (fetchJsonEnd !== -1) {
      // Find the end of fetchJson function
      let braceCount = 0;
      let started = false;
      let insertPos = fetchJsonEnd;
      for (let i = fetchJsonEnd; i < collector.length; i++) {
        if (collector[i] === '{') { braceCount++; started = true; }
        if (collector[i] === '}') { braceCount--; }
        if (started && braceCount === 0) {
          // Find the next newline after the closing brace
          insertPos = collector.indexOf('\n', i) + 1;
          break;
        }
      }
      collector = collector.slice(0, insertPos) + fetchTextHelper + collector.slice(insertPos);
      console.log('✅ Added fetchText() helper');
    }
  }

  // Insert Google Trends function before TrendCollectorService class
  const classMarker = 'export class TrendCollectorService {';
  if (collector.includes(classMarker)) {
    collector = collector.replace(classMarker, googleTrendsFunction + classMarker);
    console.log('✅ Added fetchGoogleTrends() source');
  }

  // Register Google Trends in sources array
  if (collector.includes("{ name: 'Wikipedia',   fn: fetchWikipediaCurrentEvents },")) {
    collector = collector.replace(
      "{ name: 'Wikipedia',   fn: fetchWikipediaCurrentEvents },",
      "{ name: 'Wikipedia',   fn: fetchWikipediaCurrentEvents },\n      { name: 'GoogleTrends', fn: fetchGoogleTrends },"
    );
    console.log('✅ Registered GoogleTrends in sources array');
  } else if (collector.includes("{ name: 'Dev.to',      fn: fetchDevToTrends },")) {
    collector = collector.replace(
      "{ name: 'Dev.to',      fn: fetchDevToTrends },",
      "{ name: 'Dev.to',      fn: fetchDevToTrends },\n      { name: 'GoogleTrends', fn: fetchGoogleTrends },"
    );
    console.log('✅ Registered GoogleTrends in sources array (after Dev.to)');
  }

  fs.writeFileSync(collectorPath, collector, 'utf8');
  console.log('✅ Saved trend-collector.service.ts with Google Trends');
}

// ─── 2. ADD AUTOMATIC TREND COLLECTION SCHEDULE to index.ts ───
const indexPath = '/home/smmt/apps/api/src/index.ts';
let indexTs = fs.readFileSync(indexPath, 'utf8');

if (indexTs.includes('TrendCollectorService')) {
  console.log('⏩ Trend collection scheduler already in index.ts, skipping');
} else {
  // Add import
  if (!indexTs.includes("import { TrendCollectorService }")) {
    indexTs = indexTs.replace(
      "import { scheduleTrialChecker } from './jobs/scheduler.js';",
      "import { scheduleTrialChecker } from './jobs/scheduler.js';\nimport { TrendCollectorService } from './services/trends/trend-collector.service.js';"
    );
    console.log('✅ Added TrendCollectorService import to index.ts');
  }

  // Add auto-collection schedule after the existing schedules
  const scheduleBlock = `
  // ── Trend Collection: run on startup + every 2 hours ──
  void (async () => {
    try {
      console.log('   📊 Running initial trend collection...');
      const count = await TrendCollectorService.collectAllTrends();
      console.log(\`   📊 Initial trend collection done: \${count} trends saved\`);
    } catch (e: any) {
      console.error('   Failed initial trend collection:', e.message);
    }
  })();
  setInterval(async () => {
    try {
      console.log('[TrendScheduler] Collecting trends...');
      await TrendCollectorService.purgeOldTrends();
      const count = await TrendCollectorService.collectAllTrends();
      console.log(\`[TrendScheduler] Done: \${count} trends saved\`);
    } catch (e: any) {
      console.error('[TrendScheduler] Error:', e.message);
    }
  }, 2 * 60 * 60 * 1000); // Every 2 hours
`;

  // Insert after scheduleTrialChecker()
  if (indexTs.includes('scheduleTrialChecker();')) {
    indexTs = indexTs.replace(
      'scheduleTrialChecker();',
      'scheduleTrialChecker();\n' + scheduleBlock
    );
    console.log('✅ Added automatic trend collection schedule (every 2 hours)');
  }

  fs.writeFileSync(indexPath, indexTs, 'utf8');
  console.log('✅ Saved index.ts with trend scheduler');
}

console.log('\n🎉 Google Trends source + auto-scheduler added!');
