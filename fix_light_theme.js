const fs = require('fs');
const path = require('path');

const dir = '/home/smmt/apps/web/src/pages/admin';
const files = [
  'AdminPlansPage.tsx',
  'AdminCouponsPage.tsx',
  'AdminBillingPage.tsx',
  'AdminAnalyticsPage.tsx',
  'AdminMessagesPage.tsx',
  'AdminSettingsPage.tsx'
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Safe replacements that don't destroy primary red/white buttons
  content = content.replace(/bg-neutral-900/g, 'bg-white dark:bg-neutral-900');
  content = content.replace(/bg-neutral-800\/50/g, 'bg-neutral-50 dark:bg-neutral-800/50');
  content = content.replace(/bg-neutral-800/g, 'bg-neutral-50 dark:bg-neutral-800');
  content = content.replace(/text-neutral-200/g, 'text-neutral-800 dark:text-neutral-200');
  content = content.replace(/text-neutral-300/g, 'text-neutral-600 dark:text-neutral-300');
  content = content.replace(/text-neutral-400/g, 'text-neutral-500 dark:text-neutral-400');
  content = content.replace(/border-neutral-800\/60/g, 'border-neutral-200 dark:border-neutral-800/60');
  content = content.replace(/border-neutral-800/g, 'border-neutral-200 dark:border-neutral-800');
  content = content.replace(/border-neutral-700/g, 'border-neutral-300 dark:border-neutral-700');
  content = content.replace(/divide-neutral-800\/50/g, 'divide-neutral-200 dark:divide-neutral-800/50');
  content = content.replace(/divide-neutral-800/g, 'divide-neutral-200 dark:divide-neutral-800');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', file);
});
