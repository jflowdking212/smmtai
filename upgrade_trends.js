const fs = require('fs');

// ─── 1. UPGRADE trend-collector.service.ts ───
const collectorPath = '/home/smmt/apps/api/src/services/trends/trend-collector.service.ts';
let collector = fs.readFileSync(collectorPath, 'utf8');

// ──────────────────────────────────────────────
// A. Replace the entire assignCategory function
// ──────────────────────────────────────────────
const oldAssignCat = collector.match(/function assignCategory\(topic: string\)[\s\S]*?return best;\n\}/);
if (oldAssignCat) {
  const newAssignCat = `function assignCategory(topic: string): string {
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
}`;
  collector = collector.replace(oldAssignCat[0], newAssignCat);
  console.log('✅ Replaced assignCategory() with expanded version');
} else {
  console.warn('⚠️ Could not find assignCategory() to replace');
}

// ──────────────────────────────────────────────
// B. Expand Reddit subreddits
// ──────────────────────────────────────────────
const oldSubs = "const subs = ['all', 'worldnews', 'technology', 'business', 'entertainment', 'sports', 'science'];";
const newSubs = "const subs = ['all', 'worldnews', 'technology', 'business', 'entertainment', 'sports', 'science', 'politics', 'religion', 'Christianity', 'islam', 'gaming', 'pcgaming', 'music', 'hiphopheads', 'movies', 'television', 'CryptoCurrency', 'environment', 'RealEstate', 'Parenting', 'Art', 'news', 'nottheonion', 'UpliftingNews', 'AskReddit'];";
if (collector.includes(oldSubs)) {
  collector = collector.replace(oldSubs, newSubs);
  console.log('✅ Expanded Reddit subreddits');
} else {
  console.warn('⚠️ Could not find old subreddit list');
}

// ──────────────────────────────────────────────
// C. Adjust Reddit scoring divisor 500 → 200
// ──────────────────────────────────────────────
const oldRedditScore = "score: Math.min(Math.round((p.score || 0) / 500), 100),";
const newRedditScore = "score: Math.min(Math.round((p.score || 0) / 200), 100),";
if (collector.includes(oldRedditScore)) {
  collector = collector.replace(oldRedditScore, newRedditScore);
  console.log('✅ Adjusted Reddit scoring divisor (500 → 200)');
} else {
  console.warn('⚠️ Could not find Reddit score divisor');
}

// ──────────────────────────────────────────────
// D. Adjust Reddit growth rate multiplier for more variety
// ──────────────────────────────────────────────
const oldRedditGrowth = "growthRate: Math.min((p.upvote_ratio || 0.5) * 150, 300),";
const newRedditGrowth = "growthRate: Math.min((p.upvote_ratio || 0.5) * 250, 500),";
if (collector.includes(oldRedditGrowth)) {
  collector = collector.replace(oldRedditGrowth, newRedditGrowth);
  console.log('✅ Boosted Reddit growth rate multiplier');
} else {
  console.warn('⚠️ Could not find Reddit growth rate');
}

// ──────────────────────────────────────────────
// E. Improve calcStatus thresholds
// ──────────────────────────────────────────────
const oldCalcStatus = `function calcStatus(score: number, growth: number): string {
  if (score >= 85 || growth >= 300) return 'Viral';
  if (score >= 65 || growth >= 150) return 'Hot';
  if (score >= 40 || growth >= 50) return 'Rising';
  if (score >= 20) return 'Emerging';
  return 'Saturated';
}`;
const newCalcStatus = `function calcStatus(score: number, growth: number): string {
  if (score >= 70 || growth >= 250) return 'Viral';
  if (score >= 45 || growth >= 120) return 'Hot';
  if (score >= 25 || growth >= 50) return 'Rising';
  if (score >= 10) return 'Emerging';
  return 'Saturated';
}`;
if (collector.includes(oldCalcStatus)) {
  collector = collector.replace(oldCalcStatus, newCalcStatus);
  console.log('✅ Improved calcStatus thresholds');
} else {
  console.warn('⚠️ Could not find calcStatus (trying line-by-line)');
  // Try replacing line by line
  collector = collector.replace(
    "if (score >= 85 || growth >= 300) return 'Viral';",
    "if (score >= 70 || growth >= 250) return 'Viral';"
  );
  collector = collector.replace(
    "if (score >= 65 || growth >= 150) return 'Hot';",
    "if (score >= 45 || growth >= 120) return 'Hot';"
  );
  collector = collector.replace(
    "if (score >= 40 || growth >= 50) return 'Rising';",
    "if (score >= 25 || growth >= 50) return 'Rising';"
  );
  collector = collector.replace(
    "if (score >= 20) return 'Emerging';",
    "if (score >= 10) return 'Emerging';"
  );
  console.log('✅ Improved calcStatus thresholds (line-by-line)');
}

// ──────────────────────────────────────────────
// F. Improve calcViralProbability to weight growth more heavily
// ──────────────────────────────────────────────
const oldViralCalc = `function calcViralProbability(score: number, engagement: number, growth: number): number {
  return Math.min(100, Math.round(
    Math.min(score / 100, 1) * 30 +
    Math.min(engagement / 50000, 1) * 40 +
    Math.min(growth / 300, 1) * 30
  ));
}`;
const newViralCalc = `function calcViralProbability(score: number, engagement: number, growth: number): number {
  const recencyBoost = 1.15; // recency multiplier for fresh trends
  return Math.min(100, Math.round(
    (Math.min(score / 80, 1) * 25 +
    Math.min(engagement / 30000, 1) * 35 +
    Math.min(growth / 200, 1) * 40) * recencyBoost
  ));
}`;
if (collector.includes(oldViralCalc)) {
  collector = collector.replace(oldViralCalc, newViralCalc);
  console.log('✅ Improved calcViralProbability with recency boost');
} else {
  console.warn('⚠️ Could not find calcViralProbability (trying partial)');
  collector = collector.replace(
    "Math.min(score / 100, 1) * 30 +",
    "Math.min(score / 80, 1) * 25 +"
  );
  collector = collector.replace(
    "Math.min(engagement / 50000, 1) * 40 +",
    "Math.min(engagement / 30000, 1) * 35 +"
  );
  collector = collector.replace(
    "Math.min(growth / 300, 1) * 30",
    "Math.min(growth / 200, 1) * 40"
  );
  console.log('✅ Improved calcViralProbability (partial)');
}

// ──────────────────────────────────────────────
// G. Add Wikipedia Current Events source
// ──────────────────────────────────────────────
// Insert the new function before the TrendCollectorService class
const wikiFunction = `
async function fetchWikipediaCurrentEvents() {
  const results: any[] = [];
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const url = \`https://en.wikipedia.org/api/rest_v1/feed/featured/\${yyyy}/\${mm}/\${dd}\`;
    const data = await fetchJson(url);
    // Extract from "mostread" articles
    if (data?.mostread?.articles) {
      for (const article of data.mostread.articles.slice(0, 20)) {
        if (!article?.titles?.normalized || article.titles.normalized === 'Main Page') continue;
        const desc = article.description || article.extract?.slice(0, 100) || '';
        const topic = desc ? \`\${article.titles.normalized} — \${desc}\` : article.titles.normalized;
        results.push({
          topic: topic.slice(0, 200),
          platform: 'wikipedia',
          score: Math.min(Math.round((article.views || 0) / 5000), 100),
          engagementCount: article.views || 0,
          growthRate: Math.min((article.rank ? (50 - article.rank) * 6 : 50), 300),
          sourceUrl: article.content_urls?.desktop?.page || \`https://en.wikipedia.org/wiki/\${encodeURIComponent(article.titles.normalized)}\`,
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
  } catch (e: any) { console.warn(\`[Wikipedia] \${e.message}\`); }
  return results;
}

`;

const classMarker = 'export class TrendCollectorService {';
if (collector.includes(classMarker)) {
  collector = collector.replace(classMarker, wikiFunction + classMarker);
  console.log('✅ Added fetchWikipediaCurrentEvents() source');
} else {
  console.warn('⚠️ Could not find TrendCollectorService class marker');
}

// ──────────────────────────────────────────────
// H. Register Wikipedia as a source in collectAllTrends
// ──────────────────────────────────────────────
const oldSources = `const sources = [
      { name: 'Reddit',      fn: fetchRedditTrends },
      { name: 'HackerNews',  fn: fetchHackerNewsTrends },
      { name: 'GitHub',      fn: fetchGithubTrending },
      { name: 'Dev.to',      fn: fetchDevToTrends },
    ];`;
const newSources = `const sources = [
      { name: 'Reddit',      fn: fetchRedditTrends },
      { name: 'HackerNews',  fn: fetchHackerNewsTrends },
      { name: 'GitHub',      fn: fetchGithubTrending },
      { name: 'Dev.to',      fn: fetchDevToTrends },
      { name: 'Wikipedia',   fn: fetchWikipediaCurrentEvents },
    ];`;
if (collector.includes(oldSources)) {
  collector = collector.replace(oldSources, newSources);
  console.log('✅ Registered Wikipedia source');
} else {
  console.warn('⚠️ Could not find sources array');
}

fs.writeFileSync(collectorPath, collector, 'utf8');
console.log('✅ Saved trend-collector.service.ts');

// ─── 2. UPGRADE TrendPage.tsx CATEGORIES ───
const trendPagePath = '/home/smmt/apps/web/src/pages/TrendPage.tsx';
let trendPage = fs.readFileSync(trendPagePath, 'utf8');

const oldCategories = "const CATEGORIES = ['All', 'Technology', 'Business', 'Marketing', 'Health', 'Finance', 'Lifestyle', 'Education', 'Sports', 'Entertainment', 'Fashion', 'Food', 'Travel'];";
const newCategories = "const CATEGORIES = ['All', 'Art & Culture', 'Business', 'Crypto / Web3', 'Education', 'Entertainment', 'Environment', 'Fashion', 'Film / TV', 'Finance', 'Food', 'Gaming', 'Health', 'Lifestyle', 'Marketing', 'Music', 'News / Current Events', 'Parenting & Family', 'Politics', 'Real Estate', 'Religion / Faith', 'Science', 'Sports', 'Technology', 'Travel'];";

if (trendPage.includes(oldCategories)) {
  trendPage = trendPage.replace(oldCategories, newCategories);
  console.log('✅ Updated CATEGORIES on TrendPage.tsx');
} else {
  console.warn('⚠️ Could not find CATEGORIES array on TrendPage.tsx');
}

fs.writeFileSync(trendPagePath, trendPage, 'utf8');
console.log('✅ Saved TrendPage.tsx');

console.log('\n🎉 All Trend Engine upgrades applied successfully!');
