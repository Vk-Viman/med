const fs = require('fs');
const path = require('path');

function fixIndex(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  html = html
    .replace(/href="\/_expo\//g, 'href="./_expo/')
    .replace(/src="\/_expo\//g, 'src="./_expo/')
    .replace(/href="\/favicon.ico"/g, 'href="./favicon.ico"');
  fs.writeFileSync(file, html);
}

// Run from my-app; docs is one level up
const docsIndex = path.resolve(__dirname, '..', '..', 'docs', 'index.html');
fixIndex(docsIndex);
console.log('Patched docs/index.html for GitHub Pages base path.');
