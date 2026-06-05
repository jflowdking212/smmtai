const fs = require('fs');
const path = '/home/smmt/apps/api/src/services/trends/trend-collector.service.ts';
let c = fs.readFileSync(path, 'utf8');

// Switch Reddit from www.reddit.com to old.reddit.com which is more API-friendly
c = c.replace(
  /https:\/\/www\.reddit\.com\/r\//g,
  'https://old.reddit.com/r/'
);
console.log('Switched to old.reddit.com');

// Also ensure we handle 429 (rate limit) and redirects in fetchJson
const oldFetchJson = `function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}`;

const newFetchJson = `function fetchJson(url: string): Promise<any> {
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
}`;

if (c.includes(oldFetchJson)) {
  c = c.replace(oldFetchJson, newFetchJson);
  console.log('Upgraded fetchJson with redirect support');
} else {
  console.log('Could not find exact fetchJson to replace, trying partial...');
  // At minimum, ensure redirects are handled
  if (!c.includes('Follow redirects')) {
    c = c.replace(
      "headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json' }",
      "headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json, text/plain, */*' }"
    );
    console.log('Updated Accept header');
  }
}

fs.writeFileSync(path, c, 'utf8');
console.log('Saved');
