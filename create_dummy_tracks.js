const fs = require('fs');
const path = require('path');

// 1-second silent MP3 base64 encoded
const silentMp3Base64 = 
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGFtZTMuOTlyKgAAAAAAAAAAAAAA//+QxAAAAAAAAAAAAFhpdGxlAAAAAAAAAAAAAAAAbWFjY29zcwAAAAAAAAAAAAAA//+QxAsAAAAHAAAGAAAAAFhpdGxlAAAAAAAAAAAAAAAAbWFjY29zcwAAAAAAAAAAAAAA//+QxAsAAAAHAAAGAAAAAFhpdGxlAAAAAAAAAAAAAAAAbWFjY29zcwAAAAAAAAAAAAAA//+QxAsAAAAHAAAGAAAAAFhpdGxlAAAAAAAAAAAAAAAAbWFjY29zcwAAAAAAAAAAAAAA";

const buffer = Buffer.from(silentMp3Base64, 'base64');
const audioDir = path.join(__dirname, 'public', 'audio');

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

for (let i = 1; i <= 8; i++) {
  const filePath = path.join(audioDir, `track${i}.mp3`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Created dummy track: ${filePath}`);
}
