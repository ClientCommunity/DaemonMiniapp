import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Building production bundle...');
execSync('npm run build', { stdio: 'inherit' });

// Ensure 404.html and .nojekyll exist
fs.copyFileSync('dist/index.html', 'dist/404.html');
fs.writeFileSync('dist/.nojekyll', '');

console.log('📦 Deploying dist bundle to gh-pages branch...');
const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
process.chdir(distDir);

try {
  execSync('git init', { stdio: 'inherit' });
  execSync('git remote add origin https://github.com/ClientCommunity/DaemonMiniapp.git', { stdio: 'inherit' });
  execSync('git checkout -b gh-pages', { stdio: 'inherit' });
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git commit -m "deploy: update GitHub Pages build"', { stdio: 'inherit' });
  execSync('git push -f origin gh-pages', { stdio: 'inherit' });
} finally {
  if (fs.existsSync(path.join(distDir, '.git'))) {
    fs.rmSync(path.join(distDir, '.git'), { recursive: true, force: true });
  }
  process.chdir(rootDir);
}

console.log('✅ Deployed successfully to gh-pages branch!');
