const fs = require('fs');

// ═══════════════════════════════════════════════════
// 1. FRONTEND: TrendPage.tsx enhancements
// ═══════════════════════════════════════════════════
const trendPagePath = '/home/smmt/apps/web/src/pages/TrendPage.tsx';
let tp = fs.readFileSync(trendPagePath, 'utf8');

// A. Increase display limit from 60 to 150
tp = tp.replace(
  "const data = await fetchTrendsApi({ platform, category, timeframe, limit: 60, scope });",
  "const data = await fetchTrendsApi({ platform, category, timeframe, limit: 150, scope });"
);
console.log('✅ Increased display limit from 60 → 150');

// B. Add 'Viral' and 'Saturated' to STATUS_BADGE and STATUS_LABEL
tp = tp.replace(
  `const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  Hot: 'danger',
  Rising: 'warning',
  Emerging: 'default',
  Peak: 'success',
  Declining: 'default',
};`,
  `const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  Viral: 'danger',
  Hot: 'danger',
  Rising: 'warning',
  Emerging: 'default',
  Peak: 'success',
  Declining: 'default',
  Saturated: 'default',
};`
);
console.log('✅ Added Viral + Saturated to STATUS_BADGE');

tp = tp.replace(
  `const STATUS_LABEL: Record<string, string> = {
  Hot: '🔥 Hot',
  Rising: '📈 Rising',
  Emerging: '🌱 Emerging',
  Peak: '⭐ Peak',
  Declining: '📉 Declining',
};`,
  `const STATUS_LABEL: Record<string, string> = {
  Viral: '🚀 Viral',
  Hot: '🔥 Hot',
  Rising: '📈 Rising',
  Emerging: '🌱 Emerging',
  Peak: '⭐ Peak',
  Declining: '📉 Declining',
  Saturated: '💤 Saturated',
};`
);
console.log('✅ Added Viral + Saturated to STATUS_LABEL');

// C. Add source platform label to trend cards (Google Trends, Wikipedia, etc.)
// Add a source icon mapper
const sourceIconMap = `
const SOURCE_ICON: Record<string, string> = {
  google_trends: '📊',
  wikipedia: '📖',
  reddit: '🟠',
  hackernews: '🟧',
  github: '⚡',
  devto: '💻',
};
`;
// Insert after STATUS_LABEL
tp = tp.replace(
  "function formatNumber(n: number): string {",
  sourceIconMap + "\nfunction formatNumber(n: number): string {"
);
console.log('✅ Added SOURCE_ICON mapper');

// D. Add source badge next to category badge in the card
// Find the category badge section and add source badge after it
tp = tp.replace(
  `{trend.category && (
                        <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{trend.category}</span>
                      )}`,
  `{trend.category && (
                        <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{trend.category}</span>
                      )}
                      {trend.platform && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                          {SOURCE_ICON[trend.platform] || '🌐'} {trend.platform === 'google_trends' ? 'Google' : trend.platform === 'hackernews' ? 'HN' : trend.platform.charAt(0).toUpperCase() + trend.platform.slice(1)}
                        </span>
                      )}`
);
console.log('✅ Added source platform badge to trend cards');

// E. Add "Viral Count" stat alongside Hot Trends
tp = tp.replace(
  "const hotCount = trends.filter(t => t.score >= 80).length;",
  "const hotCount = trends.filter(t => t.score >= 80).length;\n  const viralCount = trends.filter(t => t.trendStatus === 'Viral').length;"
);

// Update the stats row to include Viral count and a "Last Updated" timestamp
tp = tp.replace(
  "{ label: 'Hot Trends', value: hotCount, icon: <Flame className=\"w-5 h-5 text-red-500\" />, sub: 'score ≥ 80' },",
  "{ label: 'Viral / Hot', value: `${viralCount} / ${hotCount}`, icon: <Flame className=\"w-5 h-5 text-red-500\" />, sub: '🚀 viral • 🔥 hot' },"
);
console.log('✅ Enhanced stats row with Viral/Hot split');

// F. Add "30 days" to the timeframe dropdown
tp = tp.replace(
  `<option value="15d">15 days</option>`,
  `<option value="15d">15 days</option>
              <option value="30d">30 days</option>`
);
console.log('✅ Added 30 days timeframe option');

// G. Add competition level visual indicator in the stat grid
tp = tp.replace(
  "{ label: 'Lifespan', value: `${trend.lifespanDays || '?'}d` },",
  `{ label: 'Lifespan', value: \`\${trend.lifespanDays || '?'}d\` },
                    { label: 'Competition', value: (
                      <span className={\`font-bold \${(trend.competitionLevel || 0) >= 0.7 ? 'text-red-500' : (trend.competitionLevel || 0) >= 0.4 ? 'text-amber-500' : 'text-emerald-500'}\`}>
                        {(trend.competitionLevel || 0) >= 0.7 ? '🔴 High' : (trend.competitionLevel || 0) >= 0.4 ? '🟡 Med' : '🟢 Low'}
                      </span>
                    ) },`
);
// Adjust grid from 3 to 4 columns
tp = tp.replace(
  '<div className="grid grid-cols-3 gap-2 mb-3">',
  '<div className="grid grid-cols-4 gap-2 mb-3">'
);
console.log('✅ Added competition level indicator (4-column grid)');

// H. Add a "sortBy newest" option
tp = tp.replace(
  `<option value="engagementCount">Engagement</option>`,
  `<option value="engagementCount">Engagement</option>
              <option value="createdAt">Newest</option>`
);

// Add createdAt to the sortBy type
tp = tp.replace(
  "const [sortBy, setSortBy] = useState<'score' | 'growthRate' | 'engagementCount' | 'viralProbability'>('score');",
  "const [sortBy, setSortBy] = useState<'score' | 'growthRate' | 'engagementCount' | 'viralProbability' | 'createdAt'>('score');"
);

// Fix sort for createdAt (string comparison)
tp = tp.replace(
  ".sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));",
  ".sort((a, b) => sortBy === 'createdAt' ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : ((b as any)[sortBy] || 0) - ((a as any)[sortBy] || 0));"
);
console.log('✅ Added "Newest" sort option');

// I. Add a "sourceUrl" external link button next to Generate Post
tp = tp.replace(
  `<button
                    onClick={() => setSaved(prev => { const n = new Set(prev); n.has(trend.id) ? n.delete(trend.id) : n.add(trend.id); return n; })}`,
  `{trend.sourceUrl && (
                  <a
                    href={trend.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border bg-neutral-50 border-neutral-200 text-neutral-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    title="View source"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  )}
                  <button
                    onClick={() => setSaved(prev => { const n = new Set(prev); n.has(trend.id) ? n.delete(trend.id) : n.add(trend.id); return n; })}`
);
console.log('✅ Added "View Source" external link button');

// J. Add sourceUrl to the Trend interface if not there
if (!tp.includes("sourceUrl?: string;")) {
  tp = tp.replace(
    "createdAt: string;\n}",
    "createdAt: string;\n  sourceUrl?: string;\n}"
  );
  console.log('✅ Added sourceUrl to Trend interface');
}

fs.writeFileSync(trendPagePath, tp, 'utf8');
console.log('✅ Saved TrendPage.tsx with all enhancements');


// ═══════════════════════════════════════════════════
// 2. BACKEND: Increase collection frequency to 30 min
// ═══════════════════════════════════════════════════
const indexPath = '/home/smmt/apps/api/src/index.ts';
let idx = fs.readFileSync(indexPath, 'utf8');

// Change from 2 hours to 30 minutes
idx = idx.replace(
  "}, 2 * 60 * 60 * 1000); // Every 2 hours",
  "}, 30 * 60 * 1000); // Every 30 minutes"
);
console.log('✅ Changed collection frequency: 2h → 30min');

fs.writeFileSync(indexPath, idx, 'utf8');
console.log('✅ Saved index.ts');


// ═══════════════════════════════════════════════════
// 3. BACKEND: Add sourceUrl to trend GET response
// ═══════════════════════════════════════════════════
const trendsRoutePath = '/home/smmt/apps/api/src/routes/trends.ts';
let tr = fs.readFileSync(trendsRoutePath, 'utf8');

// Check if sourceUrl is already selected in the query
if (!tr.includes("sourceUrl: true") && tr.includes("select: {")) {
  // Find the trend select block and add sourceUrl
  tr = tr.replace(
    /lifespanDays: true,/,
    "lifespanDays: true,\n          sourceUrl: true,"
  );
  console.log('✅ Added sourceUrl to trend query select');
} else {
  console.log('⏩ sourceUrl already in select or no select block found');
}

fs.writeFileSync(trendsRoutePath, tr, 'utf8');
console.log('✅ Saved trends.ts');

console.log('\n🎉 All professional enhancements applied!');
