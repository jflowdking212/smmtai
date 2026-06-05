import { prisma } from '../../config/database.js';
import https from 'https';
import http from 'http';

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    };
    const req = client.get(url, options, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (c: Buffer) => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

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


function normalizeTopic(raw: string): string {
  return raw.toLowerCase().replace(/^#+/, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function assignCategory(topic: string): string {
  const lower = topic.toLowerCase();
  const cats: Record<string, string[]> = {
    Technology: ['ai', 'software', 'app', 'tech', 'startup', 'coding', 'programming', 'developer', 'saas', 'cloud', 'api', 'machine learning', 'data', 'cyber', 'robot', 'automation', 'open source', 'linux', 'windows', 'apple', 'google', 'microsoft', 'meta', 'openai', 'gpu', 'chip', 'semiconductor'],
    Business: ['business', 'company', 'market', 'stock', 'invest', 'startup', 'revenue', 'profit', 'ceo', 'founder', 'acquisition', 'ipo', 'valuation', 'economy', 'trade', 'corporate', 'merger'],
    Marketing: ['marketing', 'seo', 'brand', 'campaign', 'social media', 'growth', 'content', 'influencer', 'viral', 'audience', 'engagement', 'ads', 'advertising', 'funnel', 'conversion'],
    Health: ['health', 'medical', 'doctor', 'hospital', 'vaccine', 'disease', 'mental health', 'therapy', 'fitness', 'diet', 'nutrition', 'wellness', 'pharma', 'drug', 'fda', 'clinical', 'patient', 'surgery'],
    Finance: ['finance', 'bank', 'loan', 'interest rate', 'federal reserve', 'inflation', 'debt', 'credit', 'wall street', 'hedge fund', 'pension', 'tax', 'budget', 'gdp', 'recession'],
    Politics: ['politics', 'government', 'election', 'vote', 'congress', 'senate', 'president', 'democrat', 'republican', 'law', 'legislation', 'parliament', 'geopolitics', 'policy', 'supreme court', 'governor', 'mayor', 'campaign', 'party', 'liberal', 'conservative', 'trump', 'biden', 'nato', 'un', 'sanctions', 'diplomat', 'protest', 'rally', 'bill', 'amendment', 'veto', 'impeach', 'referendum', 'ballot'],
    'Religion / Faith': ['church', 'bible', 'gospel', 'prayer', 'faith', 'christian', 'jesus', 'god', 'muslim', 'islam', 'quran', 'hindu', 'buddhist', 'spiritual', 'sermon', 'worship', 'mosque', 'temple', 'pastor', 'pope', 'vatican', 'synagogue', 'rabbi', 'scripture', 'salvation', 'baptism', 'resurrection', 'ramadan', 'eid', 'diwali', 'meditation', 'monk'],
    Science: ['research', 'study', 'nasa', 'climate', 'physics', 'biology', 'chemistry', 'astronomy', 'space', 'genome', 'lab', 'experiment', 'discovery', 'molecule', 'quantum', 'telescope', 'mars', 'satellite', 'evolution', 'fossil', 'neuroscience', 'vaccine', 'journal', 'peer review'],
    'Crypto / Web3': ['bitcoin', 'ethereum', 'crypto', 'nft', 'defi', 'altcoin', 'web3', 'token', 'blockchain', 'solana', 'mining', 'wallet', 'exchange', 'binance', 'coinbase', 'memecoin', 'staking', 'dao', 'airdrop', 'metaverse'],
    Gaming: ['game', 'gaming', 'esports', 'playstation', 'xbox', 'twitch', 'steam', 'streamer', 'rpg', 'nintendo', 'gamer', 'fortnite', 'valorant', 'league of legends', 'minecraft', 'fps', 'mmorpg', 'console', 'pc gaming', 'indie game'],
    'News / Current Events': ['breaking', 'news', 'update', 'latest', 'report', 'announced', 'world', 'conflict', 'war', 'crisis', 'earthquake', 'hurricane', 'flood', 'emergency', 'disaster', 'shooting', 'explosion', 'hostage', 'ceasefire', 'refugee', 'migrant', 'terror', 'summit', 'treaty'],
    Music: ['album', 'song', 'concert', 'rapper', 'singer', 'hip hop', 'pop', 'rock', 'spotify', 'grammy', 'billboard', 'music', 'artist', 'tour', 'festival', 'band', 'track', 'lyric', 'release', 'ep', 'mixtape', 'genre', 'country music', 'r&b', 'jazz', 'classical'],
    'Film / TV': ['movie', 'film', 'series', 'netflix', 'streaming', 'trailer', 'review', 'oscar', 'premiere', 'cinema', 'show', 'actor', 'actress', 'director', 'box office', 'disney', 'hbo', 'hulu', 'amazon prime', 'season', 'episode', 'documentary', 'anime', 'marvel', 'dc'],
    'Art & Culture': ['art', 'museum', 'culture', 'gallery', 'exhibition', 'painting', 'sculpture', 'design', 'architecture', 'photography', 'creative', 'illustration', 'craft', 'heritage', 'tradition', 'festival', 'theater', 'dance', 'opera', 'literary'],
    Environment: ['climate', 'sustainability', 'green', 'renewable', 'pollution', 'ocean', 'conservation', 'wildlife', 'carbon', 'emission', 'solar', 'wind energy', 'deforestation', 'glacier', 'biodiversity', 'recycling', 'electric vehicle', 'ev', 'fossil fuel', 'ecosystem'],
    'Parenting & Family': ['parenting', 'child', 'baby', 'family', 'marriage', 'mom', 'dad', 'pregnancy', 'school', 'kids', 'toddler', 'teenager', 'newborn', 'breastfeed', 'childcare', 'homeschool', 'custody', 'adoption', 'fertility'],
    'Real Estate': ['housing', 'mortgage', 'property', 'rent', 'real estate', 'home buying', 'landlord', 'apartment', 'condo', 'listing', 'realtor', 'foreclosure', 'zillow', 'home price', 'construction', 'zoning'],
    Sports: ['football', 'soccer', 'basketball', 'nba', 'nfl', 'mlb', 'tennis', 'golf', 'olympics', 'athlete', 'championship', 'playoffs', 'world cup', 'stadium', 'coach', 'draft', 'trade', 'mma', 'ufc', 'boxing', 'wrestling', 'cricket', 'f1', 'formula', 'racing'],
    Entertainment: ['celebrity', 'hollywood', 'award', 'red carpet', 'gossip', 'reality tv', 'kardashian', 'comedy', 'standup', 'meme', 'viral video', 'youtube', 'podcast', 'tiktok trend', 'influencer'],
    Fashion: ['fashion', 'style', 'runway', 'designer', 'brand', 'clothing', 'outfit', 'sneaker', 'luxury', 'vogue', 'trend', 'accessory', 'jewelry', 'cosmetics', 'makeup', 'skincare'],
    Food: ['food', 'recipe', 'restaurant', 'chef', 'cooking', 'vegan', 'organic', 'michelin', 'baking', 'cuisine', 'gourmet', 'foodie', 'diet', 'meal prep', 'drink', 'cocktail', 'wine', 'coffee', 'tea'],
    Travel: ['travel', 'destination', 'flight', 'hotel', 'tourism', 'vacation', 'airbnb', 'passport', 'visa', 'beach', 'adventure', 'backpack', 'cruise', 'resort', 'nomad', 'itinerary', 'sightseeing'],
    Lifestyle: ['lifestyle', 'dating', 'relationship', 'self-care', 'minimalism', 'productivity', 'motivation', 'home decor', 'interior', 'garden', 'pet', 'dog', 'cat', 'mindfulness', 'yoga', 'hobby'],
    Education: ['education', 'school', 'university', 'learning', 'course', 'study', 'research', 'student', 'teach', 'scholarship', 'degree', 'college', 'online learning', 'tutoring', 'curriculum', 'exam', 'mooc', 'certification'],
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
  const recencyBoost = 1.15; // recency multiplier for fresh trends
  return Math.min(100, Math.round(
    (Math.min(score / 80, 1) * 25 +
    Math.min(engagement / 30000, 1) * 35 +
    Math.min(growth / 200, 1) * 40) * recencyBoost
  ));
}

function calcStatus(score: number, growth: number): string {
  if (score >= 70 || growth >= 250) return 'Viral';
  if (score >= 45 || growth >= 120) return 'Hot';
  if (score >= 25 || growth >= 50) return 'Rising';
  if (score >= 10) return 'Emerging';
  return 'Saturated';
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchRedditTrends() {
  const subs = ['all', 'worldnews', 'technology', 'business', 'entertainment', 'sports', 'science', 'politics', 'religion', 'Christianity', 'islam', 'gaming', 'pcgaming', 'music', 'hiphopheads', 'movies', 'television', 'CryptoCurrency', 'environment', 'RealEstate', 'Parenting', 'Art', 'news', 'nottheonion', 'UpliftingNews', 'AskReddit'];
  const results: any[] = [];
  for (const sub of subs) {
    try {
      const d = await fetchJson(`https://old.reddit.com/r/${sub}/hot.json?limit=8&raw_json=1`);
      for (const post of (d?.data?.children || [])) {
        const p = post.data;
        if (!p?.title || p.stickied) continue;
        results.push({
          topic: p.title.slice(0, 200),
          platform: 'reddit',
          score: Math.min(Math.round((p.score || 0) / 200), 100),
          engagementCount: (p.ups || 0) + (p.num_comments || 0),
          growthRate: Math.min((p.upvote_ratio || 0.5) * 250, 500),
          sourceUrl: `https://reddit.com${p.permalink}`,
        });
      }
      await sleep(1200);
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


async function fetchWikipediaCurrentEvents() {
  const results: any[] = [];
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`;
    const data = await fetchJson(url);
    // Extract from "mostread" articles
    if (data?.mostread?.articles) {
      for (const article of data.mostread.articles.slice(0, 20)) {
        if (!article?.titles?.normalized || article.titles.normalized === 'Main Page') continue;
        const desc = article.description || article.extract?.slice(0, 100) || '';
        const topic = desc ? `${article.titles.normalized} — ${desc}` : article.titles.normalized;
        results.push({
          topic: topic.slice(0, 200),
          platform: 'wikipedia',
          score: Math.min(Math.round((article.views || 0) / 5000), 100),
          engagementCount: article.views || 0,
          growthRate: Math.min((article.rank ? (50 - article.rank) * 6 : 50), 300),
          sourceUrl: article.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(article.titles.normalized)}`,
        });
      }
    }
    // Extract from "news" stories
    if (data?.news) {
      for (const newsItem of data.news.slice(0, 10)) {
        if (!newsItem?.story) continue;
        const storyText = newsItem.story.replace(/<[^>]+>/g, '').slice(0, 200);
        const link = newsItem.links?.[0];
        results.push({
          topic: storyText,
          platform: 'wikipedia',
          score: 65,
          engagementCount: link?.views || 10000,
          growthRate: 180,
          sourceUrl: link?.content_urls?.desktop?.page || 'https://en.wikipedia.org/wiki/Portal:Current_events',
        });
      }
    }
  } catch (e: any) { console.warn(`[Wikipedia] ${e.message}`); }
  return results;
}


async function fetchGoogleTrends() {
  const results: any[] = [];
  const geos = ['US', 'GB', 'NG', 'IN', 'CA', 'AU']; // Multiple regions for diversity
  for (const geo of geos) {
    try {
      const url = `https://trends.google.com/trending/rss?geo=${geo}`;
      const xml = await fetchText(url);
      // Parse items from RSS XML
      const items = xml.split('<item>').slice(1);
      for (const item of items.slice(0, 15)) {
        const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
        const trafficMatch = item.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const newsItems = item.match(/<ht:news_item_title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/ht:news_item_title>/g);

        if (!titleMatch) continue;
        const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const trafficStr = (trafficMatch?.[1] || '1,000').replace(/[^0-9]/g, '');
        const traffic = parseInt(trafficStr) || 1000;
        const link = linkMatch?.[1] || `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=${geo}`;

        // Extract news context for richer topic description
        let enrichedTopic = title;
        if (newsItems && newsItems.length > 0) {
          const firstNews = newsItems[0].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          if (firstNews && firstNews !== title) {
            enrichedTopic = `${title} — ${firstNews}`.slice(0, 200);
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
    } catch (e: any) { console.warn(`[GoogleTrends ${geo}] ${e.message}`); }
  }
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
      { name: 'Wikipedia',   fn: fetchWikipediaCurrentEvents },
      { name: 'GoogleTrends', fn: fetchGoogleTrends },
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
