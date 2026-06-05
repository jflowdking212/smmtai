const fs = require('fs');
const path = '/home/smmt/apps/api/src/services/trends/trend-collector.service.ts';
let c = fs.readFileSync(path, 'utf8');

// Fix fetchJson User-Agent to be more browser-like for Reddit
c = c.replace(
  "headers: { 'User-Agent': 'SmmtAI-TrendBot/2.0', 'Accept': 'application/json' }",
  "headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json' }"
);

// Also add raw_json=1 to the Reddit URL for proper JSON response
const oldRedditUrl = "const d = await fetchJson(`https://www.reddit.com/r/${sub}/hot.json?limit=8";
const newRedditUrl = "const d = await fetchJson(`https://www.reddit.com/r/${sub}/hot.json?limit=8&raw_json=1";
if (c.includes(oldRedditUrl)) {
  c = c.replace(oldRedditUrl, newRedditUrl);
  console.log('Fixed Reddit URL with raw_json=1');
}

// Also increase sleep between subreddits to avoid rate limiting
c = c.replace(
  /await sleep\(700\);/,
  'await sleep(1200);'
);
console.log('Increased Reddit sleep to 1200ms');

fs.writeFileSync(path, c, 'utf8');
console.log('Fixed Reddit User-Agent');
