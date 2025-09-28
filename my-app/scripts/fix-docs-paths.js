const fs = require('fs');
const path = require('path');

function fixHtml(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html
    .replace(/href="\/_expo\//g, 'href="./_expo/')
    .replace(/src="\/_expo\//g, 'src="./_expo/')
    .replace(/href="\/favicon.ico"/g, 'href="./favicon.ico"');
  if (html !== before) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

function fixBundles(dir) {
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  let changed = 0;
  for (const f of files) {
    const filePath = path.join(dir, f);
    let js = fs.readFileSync(filePath, 'utf8');
    const before = js;
    // Rewrite absolute asset URLs to relative so they work under project subpaths like /med
    js = js.replace(/\"\/assets\//g, '\"./assets/'); // within quoted strings
    js = js.replace(/'\/assets\//g, `'./assets/`);
    // Also handle cases like m.exports="/assets/..."
    js = js.replace(/=\"\/assets\//g, '=\"./assets/');
    if (js !== before) {
      fs.writeFileSync(filePath, js);
      changed++;
    }
  }
  return changed;
}

// Run from my-app; docs is one level up
const docsDir = path.resolve(__dirname, '..', '..', 'docs');
const indexFile = path.join(docsDir, 'index.html');
const notFoundFile = path.join(docsDir, '404.html');
const bundleDir = path.join(docsDir, '_expo', 'static', 'js', 'web');

const idxChanged = fixHtml(indexFile);
const nfChanged = fixHtml(notFoundFile);
const bundlesChanged = fixBundles(bundleDir);

console.log(`Patched docs HTML (index:${idxChanged}, 404:${nfChanged}); updated ${bundlesChanged} bundle file(s) for GitHub Pages base path.`);
