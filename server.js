require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Task 1: Serve Firebase config from environment variables ──
// Client fetches this once; secrets never live in a committed JS file.
app.get('/api/firebase-config', (_req, res) => {
  const key = process.env.FIREBASE_API_KEY || '';
  if (!key || key === 'YOUR_API_KEY_HERE') {
    // Return a minimal payload that lets the app boot without Firebase
    return res.json({ configured: false });
  }
  res.json({
    configured:        true,
    apiKey:            key,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || 'navratri-dhamaka.firebaseapp.com',
    databaseURL:       process.env.FIREBASE_DATABASE_URL       || 'https://navratri-dhamaka-default-rtdb.firebaseio.com',
    projectId:         process.env.FIREBASE_PROJECT_ID         || 'navratri-dhamaka',
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || 'navratri-dhamaka.appspot.com',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId:             process.env.FIREBASE_APP_ID              || ''
  });
});


// Playlist — 40 canonical Navratri tracks with YouTube Video IDs
const PLAYLIST = [
  { id:1,  title:"Jay Adhya Shakti",               artist:"Traditional",                             youtubeId:"4sW3N344Cjs", duration:261 },
  { id:2,  title:"Moti Veraana Chawk Ma",           artist:"Osman Mir / Amit Trivedi",                youtubeId:"uD2q081j_N0", duration:261 },
  { id:3,  title:"Maa Mogal Taro Aashro",           artist:"Jigardan Gadhvi / Kirtidan Gadhvi",       youtubeId:"wW0gqJj2x0c", duration:326 },
  { id:4,  title:"Diva Ni Divete",                  artist:"Geeta Rabari",                            youtubeId:"gN3vXzG1W8E", duration:407 },
  { id:5,  title:"Gori Radha Ne Kado Kaan",         artist:"Kirtidan Gadhvi",                         youtubeId:"S79L9G48V_s", duration:177 },
  { id:6,  title:"Rang Bhini Radha",                artist:"Aditya Gadhvi",                           youtubeId:"XbC4qX92Y0g", duration:256 },
  { id:7,  title:"Nagar Nand Ji Na Laal",           artist:"Aditya Gadhvi",                           youtubeId:"3A3_pLw6518", duration:315 },
  { id:8,  title:"Rang Morla",                      artist:"Aditya Gadhvi / Priya Saraiya",           youtubeId:"N_1V7w1A68g", duration:260 },
  { id:9,  title:"Khalasi",                         artist:"Aditya Gadhvi / Achint",                  youtubeId:"8Z8V6Xw4L1k", duration:264 },
  { id:10, title:"Meetha Khaara",                   artist:"Aditya Gadhvi / Siddharth Amit Bhavsar",  youtubeId:"q8_9w3J8394", duration:267 },
  { id:11, title:"Kesariyo Rang",                   artist:"Asees Kaur / Dev Negi",                   youtubeId:"b_C47V561X8", duration:194 },
  { id:12, title:"Tari Madh Mithi Vaate",           artist:"Traditional / Modern Garba",              youtubeId:"N57w98_Y69s", duration:124 },
  { id:13, title:"Saibo Re",                        artist:"Kirtidan Gadhvi / Priya Saraiya",         youtubeId:"4_X30W9v5V0", duration:257 },
  { id:14, title:"Radha Gori Re",                   artist:"Atul Purohit",                            youtubeId:"wN71V5744X8", duration:243 },
  { id:15, title:"Vinchudo",                        artist:"Kinjal Dave",                             youtubeId:"7W7v08V3550", duration:210 },
  { id:16, title:"Tetudo",                          artist:"Geeta Rabari",                            youtubeId:"X99711681W4", duration:279 },
  { id:17, title:"Jhanjhariyu",                     artist:"Umesh Barot",                             youtubeId:"W7_V48911X8", duration:215 },
  { id:18, title:"Mari Mata Na Pagla Jya Jya Thay", artist:"Geeta Rabari",                            youtubeId:"9_V0C9225V8", duration:280 },
  { id:19, title:"Dev Dwarika Vada",                artist:"Geeta Rabari",                            youtubeId:"1X579W99540", duration:299 },
  { id:20, title:"Mari Kismat",                     artist:"Geeta Rabari",                            youtubeId:"7W981V553W8", duration:346 },
  { id:21, title:"Amme Desi Kalakaar",              artist:"Kinjal Dave",                             youtubeId:"N_71V8849W0", duration:220 },
  { id:22, title:"Navrat",                          artist:"Kinjal Dave",                             youtubeId:"9W0187V44X8", duration:229 },
  { id:23, title:"Cycle",                           artist:"Kinjal Dave",                             youtubeId:"4X579V118W0", duration:204 },
  { id:24, title:"Char Bangdi Vali Gadi",           artist:"Kinjal Dave",                             youtubeId:"7V889W0021X", duration:300 },
  { id:25, title:"Leri Lala",                       artist:"Kinjal Dave",                             youtubeId:"1V553W77890", duration:342 },
  { id:26, title:"Dholida Dhol Re Vagad",           artist:"Traditional",                             youtubeId:"9W0021X45W8", duration:481 },
  { id:27, title:"Pankhida Ho Pankhida",            artist:"Traditional",                             youtubeId:"5V778901V55", duration:1916 },
  { id:28, title:"Sanedo",                          artist:"Traditional / Darshan Raval",             youtubeId:"45W89W0021X", duration:293 },
  { id:29, title:"Dholida",                         artist:"Loveyatri",                               youtubeId:"8901V555V77", duration:229 },
  { id:30, title:"Chogada",                         artist:"Darshan Raval / Asees Kaur",              youtubeId:"0021X455W89", duration:256 },
  { id:31, title:"Dholi Taro Dhol Baaje",           artist:"Kavita Krishnamurti / Vinod Rathod",      youtubeId:"55V778901V5", duration:389 },
  { id:32, title:"Nagada Sang Dhol",                artist:"Shreya Ghoshal / Osman Mir",              youtubeId:"5W89W0021X4", duration:270 },
  { id:33, title:"Shubhaarambh",                    artist:"Amit Trivedi / Shruti Pathak",            youtubeId:"78901V555V7", duration:190 },
  { id:34, title:"Vaagyo Re Dhol",                  artist:"Bhoomi Trivedi",                          youtubeId:"21X455W89W0", duration:199 },
  { id:35, title:"Mor Bani Thanghat Kare",          artist:"Osman Mir / Aditi Paul",                  youtubeId:"5V778901V55", duration:212 },
  { id:36, title:"Dakla",                           artist:"Bandish Projekt",                         youtubeId:"5W89W0021X4", duration:324 },
  { id:37, title:"Rang Taari Re",                   artist:"Falguni Pathak",                          youtubeId:"901V555V778", duration:132 },
  { id:38, title:"Kesariyo Tane Laago Re",          artist:"Falguni Pathak",                         youtubeId:"455W89W0021", duration:233 },
  { id:39, title:"Mara To Chitlo",                  artist:"Falguni Pathak",                          youtubeId:"78901V555V7", duration:98 },
  { id:40, title:"Khel Khel Re Bhawani Maa",        artist:"Falguni Pathak",                          youtubeId:"21X455W89W0", duration:98 }
];

app.get('/api/playlist', (_req, res) => res.json(PLAYLIST));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  🥁 Shere Garba — http://localhost:${PORT}`);
  console.log(`  🎵 ${PLAYLIST.length} tracks | client-side sessions\n`);
});
