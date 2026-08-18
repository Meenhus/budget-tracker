const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const vendorDir = path.join(projectRoot, 'vendor');
if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir, { recursive: true });

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
  } else {
    console.warn(`Source not found: ${src}`);
  }
}

// html2canvas
copyIfExists(path.join(projectRoot, 'node_modules', 'html2canvas', 'dist', 'html2canvas.min.js'), path.join(vendorDir, 'html2canvas.min.js'));

// jspdf UMD bundle
copyIfExists(path.join(projectRoot, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js'), path.join(vendorDir, 'jspdf.umd.min.js'));

console.log('Vendor copy complete.');
