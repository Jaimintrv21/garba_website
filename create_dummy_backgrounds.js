const fs = require('fs');
const path = require('path');

// 1x1 solid PNGs saved as JPG
// Day solid light amber (#FCE19B)
const dayBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8v4LhPwAGgQHiQ7f83AAAAABJRU5ErkJggg==";
// Night solid dark maroon/indigo (#3A0508)
const nightBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8P2P4DwAFpAHzUeC41wAAAABJRU5ErkJggg==";

const imagesDir = path.join(__dirname, 'public', 'images');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

fs.writeFileSync(path.join(imagesDir, 'day.jpg'), Buffer.from(dayBase64, 'base64'));
fs.writeFileSync(path.join(imagesDir, 'night.jpg'), Buffer.from(nightBase64, 'base64'));

console.log("Created dummy day.jpg and night.jpg background images.");
