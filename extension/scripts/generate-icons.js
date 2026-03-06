const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function generateSvgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4a90d9;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#357abd;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="${size * 0.5}" fill="white">AI</text>
</svg>`;
}

sizes.forEach(size => {
  const svg = generateSvgIcon(size);
  const filePath = path.join(iconsDir, `icon${size}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Generated: icon${size}.svg`);
});

console.log('Icons generated successfully!');
