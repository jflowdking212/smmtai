const fs = require('fs');
let content = fs.readFileSync('/home/smmt/apps/web/src/App.tsx', 'utf8');

if (!content.includes('import { AdminBillingPage }')) {
  content = content.replace(
    /import { AdminSettingsPage } from '@\/pages\/admin\/AdminSettingsPage';/,
    "import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';\nimport { AdminBillingPage } from '@/pages/admin/AdminBillingPage';"
  );
}

if (!content.includes('<Route path="/admin/billing"')) {
  content = content.replace(
    /<Route path="\/admin\/plans" element={<AdminPlansPage \/>} \/>/,
    "<Route path=\"/admin/plans\" element={<AdminPlansPage />} />\n            <Route path=\"/admin/billing\" element={<AdminBillingPage />} />"
  );
}

fs.writeFileSync('/home/smmt/apps/web/src/App.tsx', content, 'utf8');

const dir = '/home/smmt/apps/web/src/pages/admin';
const files = [
  'AdminPlansPage.tsx',
  'AdminCouponsPage.tsx',
  'AdminBillingPage.tsx',
  'AdminAnalyticsPage.tsx',
  'AdminMessagesPage.tsx',
  'AdminSettingsPage.tsx',
  'AdminDashboardPage.tsx'
];

files.forEach(file => {
  const filePath = `${dir}/${file}`;
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace text-white but ONLY when it's part of text tags: h1, h2, h3, h4, p, span, div
  // The safest way is to replace "text-white" with "text-neutral-900 dark:text-white"
  // BUT avoid modifying buttons! A simple hack: since we did this already globally except for buttons, we can just do it again specifically for classNames containing text-white and font-bold or text-2xl/xl which are headings.
  content = content.replace(/className="([^"]*)text-white([^"]*)"/g, (match, p1, p2) => {
    // If it has bg-red-600, bg-brand, etc., leave text-white alone
    if (match.includes('bg-red') || match.includes('bg-brand') || match.includes('bg-blue') || match.includes('bg-green')) {
      return match;
    }
    // Otherwise replace text-white with text-neutral-900 dark:text-white
    return `className="${p1}text-neutral-900 dark:text-white${p2}"`;
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', file);
});
