// Copies the one-file web app into desktop/app/ so the packager bundles it.
// The desktop edition is always exactly the web app at the same commit.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'index.html');
const dir = path.join(__dirname, '..', 'app');
if (!fs.existsSync(src)) { console.error('index.html not found at ' + src); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
fs.copyFileSync(src, path.join(dir, 'index.html'));
console.log('prepared app/index.html (' + fs.statSync(src).size + ' bytes)');
