const fs = require('fs');
const path = '/home/smmt/apps/web/src/pages/TrendPage.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  "trendStatus: 'Emerging' | 'Rising' | 'Hot' | 'Peak' | 'Declining';",
  "trendStatus: 'Emerging' | 'Rising' | 'Hot' | 'Peak' | 'Declining' | 'Viral' | 'Saturated';"
);

fs.writeFileSync(path, c, 'utf8');
console.log('✅ Updated trendStatus type union in TrendPage.tsx');
