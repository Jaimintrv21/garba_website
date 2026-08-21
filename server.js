const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -- PLAYLIST (Exact 40 Navratri Tracks mapped to local MP3 files) ----------
const PLAYLIST = [
  { id: 1,  title: "Jay Adhya Shakti",              artist: "Traditional",                              url: "/audio/01 - Jay Adhya Shakti.mp3",              duration: 261 },
  { id: 2,  title: "Moti Veraana Chawk Ma",          artist: "Osman Mir / Amit Trivedi",                 url: "/audio/02 - Moti Veraana Chawk Ma.mp3",          duration: 261 },
  { id: 3,  title: "Maa Mogal Taro Aashro",          artist: "Jigardan Gadhvi / Kirtidan Gadhvi",        url: "/audio/03 - Maa Mogal Taro Aashro.mp3",          duration: 326 },
  { id: 4,  title: "Diva Ni Divete",                 artist: "Geeta Rabari",                             url: "/audio/04 - Diva Ni Divete.mp3",                 duration: 407 },
  { id: 5,  title: "Gori Radha Ne Kado Kaan",        artist: "Kirtidan Gadhvi",                          url: "/audio/05 - Gori Radha Ne Kado Kaan.mp3",        duration: 177 },
  { id: 6,  title: "Rang Bhini Radha",                artist: "Aditya Gadhvi",                            url: "/audio/06 - Rang Bhini Radha.mp3",                duration: 256 },
  { id: 7,  title: "Nagar Nand Ji Na Laal",          artist: "Aditya Gadhvi",                            url: "/audio/07 - Nagar Nand Ji Na Laal.mp3",          duration: 315 },
  { id: 8,  title: "Rang Morla",                     artist: "Aditya Gadhvi / Priya Saraiya",            url: "/audio/08 - Rang Morla.mp3",                     duration: 260 },
  { id: 9,  title: "Khalasi",                        artist: "Aditya Gadhvi / Achint",                   url: "/audio/09 - Khalasi.mp3",                        duration: 264 },
  { id: 10, title: "Meetha Khaara",                  artist: "Aditya Gadhvi / Siddharth Amit Bhavsar",   url: "/audio/10 - Meetha Khaara.mp3",                  duration: 267 },
  { id: 11, title: "Kesariyo Rang",                  artist: "Asees Kaur / Dev Negi",                    url: "/audio/11 - Kesariyo Rang.mp3",                  duration: 194 },
  { id: 12, title: "Tari Madh Mithi Vaate",          artist: "Traditional/Modern Garba",                 url: "/audio/12 - Tari Madh Mithi Vaate.mp3",          duration: 124 },
  { id: 13, title: "Saibo Re",                       artist: "Kirtidan Gadhvi / Priya Saraiya",          url: "/audio/13 - Saibo Re.mp3",                       duration: 257 },
  { id: 14, title: "Radha Gori Re",                  artist: "Atul Purohit",                             url: "/audio/14 - Radha Gori Re.mp3",                  duration: 243 },
  { id: 15, title: "Vinchudo",                       artist: "Kinjal Dave",                              url: "/audio/15 - Vinchudo.mp3",                       duration: 210 },
  { id: 16, title: "Tetudo",                         artist: "Geeta Rabari",                             url: "/audio/16 - Tetudo.mp3",                         duration: 279 },
  { id: 17, title: "Jhanjhariyu",                    artist: "Umesh Barot",                              url: "/audio/17 - Jhanjhariyu.mp3",                    duration: 215 },
  { id: 18, title: "Mari Mata Na Pagla Jya Jya Thay", artist: "Geeta Rabari",                             url: "/audio/18 - Mari Mata Na Pagla Jya Jya Thay.mp3", duration: 280 },
  { id: 19, title: "Dev Dwarika Vada",               artist: "Geeta Rabari",                             url: "/audio/19 - Dev Dwarika Vada.mp3",               duration: 299 },
  { id: 20, title: "Mari Kismat",                    artist: "Geeta Rabari",                             url: "/audio/20 - Mari Kismat.mp3",                    duration: 346 },
  { id: 21, title: "Amme Desi Kalakaar",             artist: "Kinjal Dave",                              url: "/audio/21 - Amme Desi Kalakaar.mp3",             duration: 220 },
  { id: 22, title: "Navrat",                         artist: "Kinjal Dave",                              url: "/audio/22 - Navrat.mp3",                         duration: 229 },
  { id: 23, title: "Cycle",                          artist: "Kinjal Dave",                              url: "/audio/23 - Cycle.mp3",                          duration: 204 },
  { id: 24, title: "Char Bangdi Vali Gadi",          artist: "Kinjal Dave",                              url: "/audio/24 - Char Bangdi Vali Gadi.mp3",          duration: 300 },
  { id: 25, title: "Leri Lala",                      artist: "Kinjal Dave",                              url: "/audio/25 - Leri Lala.mp3",                      duration: 342 },
  { id: 26, title: "Dholida Dhol Re Vagad",          artist: "Traditional",                              url: "/audio/26 - Dholida Dhol Re Vagad.mp3",          duration: 481 },
  { id: 27, title: "Pankhida Ho Pankhida",           artist: "Traditional",                              url: "/audio/27 - Pankhida Ho Pankhida.mp3",           duration: 1916 },
  { id: 28, title: "Sanedo",                         artist: "Traditional / Darshan Raval",              url: "/audio/28 - Sanedo.mp3",                         duration: 293 },
  { id: 29, title: "Dholida",                        artist: "Loveyatri",                                url: "/audio/29 - Dholida.mp3",                        duration: 229 },
  { id: 30, title: "Chogada",                        artist: "Darshan Raval / Asees Kaur",               url: "/audio/30 - Chogada.mp3",                        duration: 256 },
  { id: 31, title: "Dholi Taro Dhol Baaje",          artist: "Kavita Krishnamurti / Vinod Rathod",        url: "/audio/31 - Dholi Taro Dhol Baaje.mp3",          duration: 389 },
  { id: 32, title: "Nagada Sang Dhol",               artist: "Shreya Ghoshal / Osman Mir",               url: "/audio/32 - Nagada Sang Dhol.mp3",               duration: 270 },
  { id: 33, title: "Shubhaarambh",                   artist: "Amit Trivedi / Shruti Pathak",             url: "/audio/33 - Shubhaarambh.mp3",                   duration: 190 },
  { id: 34, title: "Vaagyo Re Dhol",                 artist: "Bhoomi Trivedi",                           url: "/audio/34 - Vaagyo Re Dhol.mp3",                 duration: 199 },
  { id: 35, title: "Mor Bani Thanghat Kare",         artist: "Osman Mir / Aditi Paul",                   url: "/audio/35 - Mor Bani Thanghat Kare.mp3",         duration: 212 },
  { id: 36, title: "Dakla",                          artist: "Bandish Projekt",                          url: "/audio/36 - Dakla.mp3",                          duration: 324 },
  { id: 37, title: "Rang Taari Re",                  artist: "Falguni Pathak",                           url: "/audio/37 - Rang Taari Re.mp3",                  duration: 132 },
  { id: 38, title: "Kesariyo Tane Laago Re",         artist: "Falguni Pathak",                           url: "/audio/38 - Kesariyo Tane Laago Re.mp3",         duration: 233 },
  { id: 39, title: "Mara To Chitlo",                 artist: "Falguni Pathak",                           url: "/audio/39 - Mara To Chitlo.mp3",                 duration: 98 },
  { id: 40, title: "Khel Khel Re Bhawani Maa",       artist: "Falguni Pathak",                           url: "/audio/40 - Khel Khel Re Bhawani Maa.mp3",       duration: 98 }
];

// -- SERVER STATE -------------------------------------------------------------
let radioState = {
  currentTrackIndex: 0,
  trackStartedAt: Date.now(),
  isPlaying: true
};

let sseClients = [];
let activeSessions = new Map();

function getCurrentElapsed() {
  if (!radioState.isPlaying) return 0;
  return (Date.now() - radioState.trackStartedAt) / 1000;
}

function getFullState() {
  const currentTrack = PLAYLIST[radioState.currentTrackIndex];
  const nextTrack = PLAYLIST[(radioState.currentTrackIndex + 1) % PLAYLIST.length];
  const elapsed = Math.min(getCurrentElapsed(), currentTrack.duration);

  return {
    track: currentTrack,
    nextTrack: { title: nextTrack.title, artist: nextTrack.artist },
    elapsed: Math.floor(elapsed),
    duration: currentTrack.duration,
    isPlaying: radioState.isPlaying,
    liveListeners: Math.max(1, activeSessions.size),
    serverTime: Date.now()
  };
}

function advanceTrack() {
  radioState.currentTrackIndex = (radioState.currentTrackIndex + 1) % PLAYLIST.length;
  radioState.trackStartedAt = Date.now();
  console.log(`[RADIO] Advanced to track ${radioState.currentTrackIndex + 1}: ${PLAYLIST[radioState.currentTrackIndex].title}`);
  broadcastState();
}

function checkTrackProgress() {
  if (!radioState.isPlaying) return;
  const currentTrack = PLAYLIST[radioState.currentTrackIndex];
  const elapsed = getCurrentElapsed();
  if (elapsed >= currentTrack.duration) {
    advanceTrack();
  }
}

setInterval(checkTrackProgress, 1000);

function cleanStaleSessions() {
  const now = Date.now();
  for (const [sessionId, lastSeen] of activeSessions.entries()) {
    if (now - lastSeen > 15000) {
      activeSessions.delete(sessionId);
    }
  }
}
setInterval(cleanStaleSessions, 5000);

function broadcastState() {
  const payload = getFullState();
  const dataString = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => client.res.write(dataString));
}

// Periodic SSE ticker to keep all connected clients perfectly synced
setInterval(broadcastState, 2000);

// -- ENDPOINTS ----------------------------------------------------------------

app.get('/api/playlist', (req, res) => {
  res.json(PLAYLIST);
});

app.get('/api/radio-state', (req, res) => {
  res.json(getFullState());
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  res.write(`data: ${JSON.stringify(getFullState())}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

app.post('/api/heartbeat', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    activeSessions.set(sessionId, Date.now());
  }
  res.json({ success: true, liveListeners: Math.max(1, activeSessions.size) });
});

app.post('/api/control', (req, res) => {
  const { action, trackId } = req.body;

  if (action === 'next') {
    advanceTrack();
  } else if (action === 'prev') {
    radioState.currentTrackIndex = (radioState.currentTrackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    radioState.trackStartedAt = Date.now();
    broadcastState();
  } else if (action === 'shuffle') {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * PLAYLIST.length);
    } while (randomIndex === radioState.currentTrackIndex && PLAYLIST.length > 1);
    radioState.currentTrackIndex = randomIndex;
    radioState.trackStartedAt = Date.now();
    broadcastState();
  } else if (action === 'playTrack' && trackId !== undefined) {
    const idx = PLAYLIST.findIndex(t => t.id === trackId);
    if (idx !== -1) {
      radioState.currentTrackIndex = idx;
      radioState.trackStartedAt = Date.now();
      broadcastState();
    }
  }

  res.json({ success: true, ...getFullState() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  🥁 Shere Garba server is live!`);
  console.log(`  📻 Radio streaming at http://localhost:${PORT}`);
  console.log(`  ⚡ SSE endpoint: http://localhost:${PORT}/api/stream`);
  console.log(`  🎵 Playlist: ${PLAYLIST.length} tracks loaded\n`);
});
