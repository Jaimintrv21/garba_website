/* -----------------------------------------------
   NAVRATRI DHAMAKA — Front-End Application Logic
   Audio Synchronization Engine & Play/Pause Sync
   ----------------------------------------------- */

let audio = new Audio();
let sessionId = null;
let currentListenersCount = 0;
let playlistData = [];

audio.preload = 'auto';

// Initialize Session ID
function initSession() {
  sessionId = sessionStorage.getItem('nd_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('nd_session_id', sessionId);
  }
}

// --- REAL-TIME SSE SYNC ---------------------------------------
function initSSE() {
  initSession();
  const eventSource = new EventSource('/api/stream');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerSync(data);
    } catch (err) {
      console.error('Failed to parse SSE payload:', err);
    }
  };

  eventSource.onerror = () => {
    fetchSyncFallback();
  };

  fetchPlaylist();
}

function fetchPlaylist() {
  fetch('/api/playlist')
    .then(res => res.json())
    .then(data => {
      playlistData = data;
      renderPlaylistTable();
    })
    .catch(err => console.error('Failed to fetch playlist:', err));
}

function fetchSyncFallback() {
  fetch('/api/radio-state')
    .then(res => res.json())
    .then(data => handleServerSync(data))
    .catch(err => console.error('Fallback sync error:', err));
}

function handleServerSync(data) {
  if (!data || !data.track) return;

  const isNewTrack = audio.src !== window.location.origin + data.track.url &&
                     !audio.src.endsWith(encodeURI(data.track.url)) &&
                     !audio.src.endsWith(data.track.url);

  if (isNewTrack) {
    audio.src = data.track.url;
    audio.play().catch(e => console.log('Autoplay blocked:', e));
  }

  if (audio.duration && !isNaN(data.elapsed)) {
    const drift = Math.abs(audio.currentTime - data.elapsed);
    if (drift > 2.5) {
      audio.currentTime = Math.min(data.elapsed, audio.duration - 0.5);
    }
  }

  updateUI(data);
}

// Presence Heartbeat
function sendHeartbeat() {
  if (!sessionId) return;
  fetch('/api/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  }).catch(() => {});
}

function startHeartbeat() {
  sendHeartbeat();
  setInterval(sendHeartbeat, 10000);
}

// --- PLAY / PAUSE BUTTON & EVENT SYNCHRONIZATION ------------------
const playBtn = document.getElementById('play-btn');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnNextMini = document.getElementById('btn-next-mini');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');

function updatePlayBtnUI() {
  if (!playBtn) return;
  if (!audio.paused) {
    playBtn.classList.add('playing');
    playBtn.setAttribute('title', 'Pause');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  } else {
    playBtn.classList.remove('playing');
    playBtn.setAttribute('title', 'Play');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  }
}

audio.addEventListener('play', updatePlayBtnUI);
audio.addEventListener('pause', updatePlayBtnUI);
audio.addEventListener('playing', updatePlayBtnUI);

function togglePlayPause() {
  if (audio.paused) {
    audio.play().catch(err => console.error('Audio play error:', err));
  } else {
    audio.pause();
  }
  updatePlayBtnUI();
}

if (playBtn) playBtn.addEventListener('click', togglePlayPause);

let isShuffle = false;
let isRepeat = false;

function triggerTrackChange(action) {
  fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  })
  .then(res => res.json())
  .then(data => {
    if (data.currentTrack) {
      audio.src = data.currentTrack.url;
      audio.play().catch(() => {});
    }
  })
  .catch(console.error);
}

if (btnPrev) btnPrev.addEventListener('click', () => triggerTrackChange(isShuffle ? 'shuffle' : 'prev'));
if (btnNext) btnNext.addEventListener('click', () => triggerTrackChange(isShuffle ? 'shuffle' : 'next'));
if (btnNextMini) btnNextMini.addEventListener('click', () => triggerTrackChange(isShuffle ? 'shuffle' : 'next'));

if (btnShuffle) {
  btnShuffle.addEventListener('click', () => {
    isShuffle = !isShuffle;
    btnShuffle.classList.toggle('active', isShuffle);
    btnShuffle.setAttribute('title', isShuffle ? 'Shuffle Active' : 'Shuffle Mode');
    if (isShuffle) {
      triggerTrackChange('shuffle');
    }
  });
}

if (btnRepeat) {
  btnRepeat.addEventListener('click', () => {
    isRepeat = !isRepeat;
    audio.loop = isRepeat;
    btnRepeat.classList.toggle('active', isRepeat);
    btnRepeat.setAttribute('title', isRepeat ? 'Repeat Active' : 'Repeat Mode');
  });
}

audio.addEventListener('ended', () => {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else if (isShuffle) {
    triggerTrackChange('shuffle');
  } else {
    triggerTrackChange('next');
  }
});

// Progress & Time Formatting (Current & Remaining Time)
const progressFill = document.getElementById('progress-fill-bar');
const timeCurrent = document.getElementById('time-current');
const timeRemaining = document.getElementById('time-remaining');
const progressWrap = document.getElementById('player-progress-wrap');

function updateProgress() {
  const cur = audio.currentTime || 0;
  const dur = audio.duration || 1;
  const rem = Math.max(0, dur - cur);
  const pct = Math.min(100, Math.max(0, (cur / dur) * 100));

  if (progressFill) progressFill.style.width = `${pct}%`;
  if (timeCurrent) timeCurrent.innerText = formatTime(cur);
  if (timeRemaining) timeRemaining.innerText = `-${formatTime(rem)}`;
}

audio.addEventListener('timeupdate', updateProgress);

if (progressWrap) {
  progressWrap.addEventListener('click', (e) => {
    const rect = progressWrap.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
      updateProgress();
    }
  });
}

function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Listener Count Roll
function setListenerCount(newCount) {
  const countEl = document.getElementById('listeners-count');
  if (!countEl || currentListenersCount === newCount) return;

  countEl.style.transform = 'scale(1.1)';
  setTimeout(() => {
    currentListenersCount = newCount;
    countEl.innerText = `${newCount} dancing right now`;
    countEl.style.transform = 'scale(1)';
  }, 150);
}

// --- UI RENDER & PLAYLIST TABLE ------------------------------
let activeTrackId = null;

function updateUI(data) {
  activeTrackId = data.track.id;
  const titleEl = document.getElementById('track-title');
  const artistEl = document.getElementById('track-artist');
  const nextTrackEl = document.getElementById('next-up-name');

  if (titleEl) titleEl.innerText = data.track.title;
  if (artistEl) artistEl.innerText = data.track.artist;
  if (nextTrackEl && data.nextTrack) nextTrackEl.innerText = `${data.nextTrack.title} - ${data.nextTrack.artist}`;

  setListenerCount(data.liveListeners || 1);
  renderPlaylistTable();
}

function renderPlaylistTable() {
  const container = document.getElementById('playlist-items');
  if (!container || !playlistData.length) return;

  container.innerHTML = '';
  playlistData.forEach((t, i) => {
    const isCurrent = t.id === activeTrackId;
    const item = document.createElement('div');
    item.className = `playlist-item ${isCurrent ? 'active' : ''}`;
    item.style.cursor = 'pointer';
    item.onclick = () => {
      fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'playTrack', trackId: t.id })
      }).catch(console.error);
    };

    item.innerHTML = `
      <div class="playlist-track-info">
        <span class="playlist-track-index">${isCurrent ? '▶' : (i + 1)}</span>
        <div>
          <div class="playlist-track-title">${t.title} ${isCurrent ? '<span style="font-size:0.68rem;color:var(--gold-accent);margin-left:0.35rem;font-weight:800;">(PLAYING NOW)</span>' : ''}</div>
          <div class="playlist-track-artist">${t.artist}</div>
        </div>
      </div>
      <span class="playlist-track-duration">${formatTime(t.duration)}</span>
    `;
    container.appendChild(item);
  });
}

// --- DAY / NIGHT THEME SYSTEM --------------------------------
function getAutoTheme() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return (mins >= 360 && mins < 1110) ? 'day' : 'night';
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const labelEl = document.getElementById('theme-toggle-label');
  if (labelEl) labelEl.innerText = theme === 'day' ? 'Day Mode' : 'Night Mode';
}

const themeBtn = document.getElementById('theme-toggle-btn');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme') || getAutoTheme();
    applyTheme(current === 'day' ? 'night' : 'day');
  });
}

// Accordion FAQ Setup
document.querySelectorAll('.faq-question').forEach(q => {
  q.addEventListener('click', () => {
    const parent = q.parentElement;
    parent.classList.toggle('active');
  });
});

// Initialize Engine
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getAutoTheme());
  initSSE();
  startHeartbeat();
});
