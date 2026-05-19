const fs = require('fs');
const path = require('path');

const targets = [
  'apps/web/src/pages/PrivacyPolicyPage.tsx',
  'apps/web/src/pages/CookiePolicyPage.tsx',
  'apps/web/src/pages/HelpPage.tsx',
  'apps/web/src/pages/auth/LoginPage.tsx',
  'apps/web/src/pages/auth/ResetPasswordPage.tsx',
  'apps/web/src/pages/auth/VerifyEmailPage.tsx',
  'apps/web/src/pages/auth/OAuthCallbackPage.tsx',
  'apps/web/src/pages/auth/RegisterPage.tsx',
  'apps/web/src/pages/auth/ForgotPasswordPage.tsx',
  'apps/web/src/pages/CheckoutSuccessPage.tsx',
  'apps/web/src/pages/TermsPage.tsx',
  'apps/web/src/pages/LandingPage.tsx',
  'apps/web/src/pages/EditorPage.tsx',
  'packages/db/src/seed.ts',
  'apps/web/index.html'
];

targets.forEach(relPath => {
  const filePath = path.join('/home/jbliss/sites/smmt', relPath);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Perform text replacements for UI strings
    content = content.replace(/EE PostMind/g, 'SmmtAI');
    content = content.replace(/Postmind/g, 'SmmtAI');
    content = content.replace(/PostMind/g, 'SmmtAI');
    
    // Additional case adjustments for email addresses and specific strings
    content = content.replace(/support@postmind\.app/g, 'support@smmtai.app');
    content = content.replace(/sales@postmind\.app/g, 'sales@smmtai.app');
    content = content.replace(/demo@eepostmind\.local/g, 'demo@smmtai.local');
    content = content.replace(/postmind-/g, 'smmtai-'); // for file exports in EditorPage

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', relPath);
  } else {
    console.warn('File not found', relPath);
  }
});
