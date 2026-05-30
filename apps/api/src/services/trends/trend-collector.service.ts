import { prisma } from '../../config/database.js';
import https from 'https';
import http from 'http';

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'SmmtAI-TrendBot/2.0', 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function normalizeTopic(raw: string): string {
  return raw.toLowerCase().replace(/^#+/, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function assignCategory(topic: string): string {
  const lower = topic.toLowerCase();
  const cats: Record<string, string[]> = {
    Technology: ['ai', 'tech', 'software', 'app', 'saas', 'blockchain', 'developer', 'programming', 'api', 'cloud', 'startup'],
    Business: ['business', 'entrepreneur', 'marketing', 'sales', 'revenue', 'brand', 'ecommerce', 'strategy'],
    Entertainment: ['movie', 'netflix', 'celebrity', 'music', 'concert', 'drama', 'film', 'show', 'actor', 'streaming'],
    Sports: ['football', 'soccer', 'nba', 'nfl', 'cricket', 'tennis', 'match', 'championship', 'player', 'team'],
    Health: ['health', 'fitness', 'diet', 'workout', 'wellness', 'medical', 'mental', 'exercise', 'nutrition'],
    Politics: ['election', 'president', 'government', 'policy', 'vote', 'congress', 'senate', 'political', 'law'],
    Finance: ['stock', 'market', 'invest', 'economy', 'inflation', 'bank', 'trading', 'fund', 'financial'],
    Crypto: ['bitcoin', 'ethereum', 'crypto', 'nft', 'defi', 'altcoin', 'web3', 'token', 'blockchain'],
    Gaming: ['game', 'gaming', 'esports', 'playstation', 'xbox', 'twitch', 'steam', 'streamer', 'rpg'],
    Education: ['education', 'school', 'university', 'learning', 'course', 'study', 'research', 'student', 'teach'],
    Lifestyle: ['travel', 'food', 'recipe', 'home', 'lifestyle', 'dating', 'relationship', 'fashion', 'style', 'beauty'],
    News: ['breaking', 'news', 'update', 'latest', 'report', 'announced', 'today', 'just in', 'alert'],
  };
  let best = 'General', bestScore = 0;
  for (const [cat, kws] of Object.entries(cats)) {
    const score = kws.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

function isNsfw(topic: string): boolean {
  const blocked = ['porn', 'xxx', 'nude', 'nsfw', 'explicit', 'sex tape', 'onlyfans leak'];
  const lower = topic.toLowerCase();
  return blocked.some(k => lower.includes(k));
}

function calcViralProbability(score: number, engagement: number, growth: number): number {
  return Math.min(100, Math.round(
    Math.min(score / 100, 1) * 30 +
    Math.min(engagement / 50000, 1) * 40 +
    Math.min(growth / 300, 1) * 30
  ));
}

function calcStatus(score: number, growth: number): string {
  if (score >= 85 || growth >= 300) return 'Viral';
  if (score >= 65 || growth >= 150) return 'Hot';
  if (score >= 40 || growth >= 50) return 'Rising';
  if (score >= 20) return 'Emerging';
  return 'Saturated';
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchRedditTrends() {
  const subs = ['all', 'worldnews', 'technology', 'business', 'entertainment', 'sports', 'science'];
  const results: any[] = [];
  for (const sub of subs) {
    try {
      const d = await fetchJson(`https://www.reddit.com/r/${sub}/hot.json?limit=8`);
      for (const post of (d?.data?.children || [])) {
        const p = post.data;
        if (!p?.title || p.stickied) continue;
        results.push({
          topic: p.title.slice(0, 200),
          platform: 'reddit',
          score: Math.min(Math.round((p.score || 0) / 500), 100),
          engagementCount: (p.ups || 0) + (p.num_comments || 0),
          growthRate: Math.min((p.upvote_ratio || 0.5) * 150, 300),
          sourceUrl: `https://reddit.com${p.permalink}`,
        });
      }
      await sleep(700);
    } catch (e: any) { console.warn(`[Reddit r/${sub}] ${e.message}`); }
  }
  return results;
}

async function fetchHackerNewsTrends() {
  const results: any[] = [];
  try {
    const ids: number[] = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
    for (const id of ids.slice(0, 20)) {
      try {
        const s = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!s?.title || s.type !== 'story') continue;
        results.push({
          topic: s.title.slice(0, 200),
          platform: 'hackernews',
          score: Math.min(Math.round((s.score || 0) / 25), 100),
          engagementCount: (s.score || 0) + (s.descendants || 0),
          growthRate: Math.min((s.descendants || 0) * 2, 300),
          sourceUrl: s.url || `https://news.ycombinator.com/item?id=${id}`,
        });
        await sleep(120);
      } catch {}
    }
  } catch (e: any) { console.warn(`[HackerNews] ${e.message}`); }
  return results;
}

async function fetchGithubTrending() {
  const results: any[] = [];
  try {
    const today = new Date(); today.setDate(today.getDate() - 7);
    const dateStr = today.toISOString().split('T')[0];
    const d = await fetchJson(
      `https://api.github.com/search/repositories?q=created:>${dateStr}&sort=stars&order=desc&per_page=15`
    );
    for (const r of (d?.items || [])) {
      const desc = r.description ? ` — ${r.description.slice(0, 80)}` : '';
      results.push({
        topic: `${r.name}${desc}`.slice(0, 200),
        platform: 'github',
        score: Math.min(Math.round((r.stargazers_count || 0) / 200), 100),
        engagementCount: (r.stargazers_count || 0) + (r.forks_count || 0),
        growthRate: Math.min((r.watchers_count || 0) / 30, 300),
        sourceUrl: r.html_url,
      });
    }
  } catch (e: any) { console.warn(`[GitHub] ${e.message}`); }
  return results;
}

async function fetchDevToTrends() {
  const results: any[] = [];
  try {
    const articles = await fetchJson('https://dev.to/api/articles?top=7&per_page=15');
    for (const a of (articles || [])) {
      if (!a?.title) continue;
      const reactions = a.positive_reactions_count || 0;
      const comments = a.comments_count || 0;
      results.push({
        topic: a.title.slice(0, 200),
        platform: 'devto',
        score: Math.min(Math.round((reactions + comments) / 6), 100),
        engagementCount: reactions + comments,
        growthRate: Math.min(comments * 5, 300),
        sourceUrl: a.url,
      });
    }
  } catch (e: any) { console.warn(`[Dev.to] ${e.message}`); }
  return results;
}

export class TrendCollectorService {
  static async collectAllTrends(): Promise<number> {
    console.log('[TrendCollector] Starting collection cycle...');
    let saved = 0;

    const sources = [
      { name: 'Reddit',      fn: fetchRedditTrends },
      { name: 'HackerNews',  fn: fetchHackerNewsTrends },
      { name: 'GitHub',      fn: fetchGithubTrending },
      { name: 'Dev.to',      fn: fetchDevToTrends },
    ];

    for (const source of sources) {
      try {
        console.log(`[TrendCollector] Fetching: ${source.name}`);
        const raw = await source.fn();
        console.log(`[TrendCollector] ${source.name}: ${raw.length} trends`);

        for (const item of raw) {
          if (!item.topic || isNsfw(item.topic)) continue;
          try {
            const normalizedTopic = normalizeTopic(item.topic);
            const category = assignCategory(normalizedTopic);
            const viralProbability = calcViralProbability(item.score, item.engagementCount, item.growthRate);
            const trendStatus = calcStatus(item.score, item.growthRate);
            const competitionLevel = Math.max(0, Math.min(1, (item.score / 100) - (item.growthRate / 600)));
            const peakTime = new Date();
            peakTime.setHours(peakTime.getHours() + (
              trendStatus === 'Viral' ? 4 : trendStatus === 'Hot' ? 12 : trendStatus === 'Rising' ? 36 : 72
            ));
            const lifespanDays = trendStatus === 'Viral' ? 2 : trendStatus === 'Hot' ? 4 : trendStatus === 'Rising' ? 7 : 14;

            await (prisma as any).trend.upsert({
              where: { topic_platform: { topic: item.topic.slice(0, 200), platform: item.platform } },
              create: {
                topic: item.topic.slice(0, 200),
                normalizedTopic, category, platform: item.platform,
                score: item.score, engagementCount: item.engagementCount, growthRate: item.growthRate,
                trendStatus, sentiment: 'neutral', sourceUrl: item.sourceUrl || null,
                viralProbability, competitionLevel, peakTimeEstimate: peakTime, lifespanDays,
                isNsfw: false, isBlacklisted: false, isFlagged: false,
              },
              update: {
                score: item.score, engagementCount: item.engagementCount, growthRate: item.growthRate,
                trendStatus, viralProbability, competitionLevel, peakTimeEstimate: peakTime, updatedAt: new Date(),
              },
            });
            saved++;
          } catch (e: any) {
            if (!e.message?.includes('nique')) console.warn(`[Save] ${e.message?.slice(0, 100)}`);
          }
        }
      } catch (e: any) {
        console.error(`[TrendCollector] ${source.name} error: ${e.message}`);
      }
    }

    console.log(`[TrendCollector] Done. Saved ${saved} trends.`);
    return saved;
  }

  static async purgeOldTrends(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);
    const result = await (prisma as any).trend.deleteMany({ where: { createdAt: { lt: cutoff } } });
    console.log(`[TrendCollector] Purged ${result.count} old trends`);
  }
}
