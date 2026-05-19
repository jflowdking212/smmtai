const fs = require('fs');
const path = require('path');

const dirsToSearch = [
  'apps/web/src',
  'apps/web/index.html',
  'apps/api/src',
  'scripts',
  'packages/db/src',
  'packages/ui/src',
  'packages/shared/src',
  'TELEGRAM-SETUP.txt',
  'entreprenrs-fix.txt'
];

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    return [dir];
  }
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      results.push(file);
    }
  });
  return results;
}

dirsToSearch.forEach(item => {
  const fullPath = path.join('/home/jbliss/sites/smmt', item);
  const files = walk(fullPath);
  
  files.forEach(file => {
    if (!file.match(/\.(tsx|ts|js|mjs|jsx|css|html|txt|md)$/)) return;
    
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // UI String Replacements
    content = content.replace(/EE PostMind/g, 'SmmtAI');
    content = content.replace(/EE Postmind/g, 'SmmtAI');
    content = content.replace(/PostMind/g, 'SmmtAI');
    content = content.replace(/Postmind/g, 'SmmtAI');
    content = content.replace(/Postming/g, 'SmmtAI');
    
    // Lowercase replacement for postmind, postming avoiding ee-postmind and package names
    // Negative lookbehind requires Node 9+, which we have
    content = content.replace(/(?<!ee-)(?<!@ee-)postmind/g, 'smmtai');
    content = content.replace(/(?<!ee-)(?<!@ee-)postming/g, 'smmtai');
    
    content = content.replace(/POSTMIND/g, 'SMMTAI');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated:', file);
    }
  });
});
