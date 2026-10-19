import { execSync } from 'child_process';

const message = process.argv.slice(2).join(' ') || 'chore: automated update';

console.log(`🚀 Shipping frontend update: "${message}"...`);

try {
  // 1. Stage and commit
  console.log('📝 Staging and committing changes...');
  execSync('git add -A', { stdio: 'inherit' });
  
  // Check if there are changes to commit
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  } catch {
    console.log('ℹ️ No uncommitted changes detected. Proceeding to push and deploy...');
  }

  // 2. Push to main
  console.log('⬆️ Pushing to origin main...');
  execSync('git push origin main', { stdio: 'inherit' });

  // 3. Build, deploy to gh-pages, and trigger Render webhook
  console.log('📦 Deploying to GitHub Pages & triggering Render deploy hook...');
  execSync('node scripts/deploy.mjs', { stdio: 'inherit' });

  console.log('\n🎉 ALL DEPLOYS COMPLETED!');
  console.log('  • GitHub Repo (main): Up to date');
  console.log('  • GitHub Pages (gh-pages): Deployed');
  console.log('  • Render Webhook (srv-db0v70favr4c739gbve0): Triggered');
} catch (err) {
  console.error('❌ Shipping failed:', err.message);
  process.exit(1);
}
