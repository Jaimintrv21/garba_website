/* -----------------------------------------------
   Shere Garba — Front-End Application Logic
   Audio Synchronization Engine & Play/Pause Sync
   ----------------------------------------------- */

let audio = new Audio();
let sessionId = null;
let currentListenersCount = 0;
let playlistData = [];
let activeTrackId = null;
let hasUserStartedPlay = false;
let playPromise = null;
let lastControlTime = 0;
let heartbeatInterval = null;
let eventSource = null;

audio.preload = 'auto';

// Initialize Session ID
function initSession() {
  sessionId = sessionStorage.getItem('sg_session_id') || sessionStorage.getItem('nd_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('sg_session_id', sessionId);
  }
}

// --- REAL-TIME SSE SYNC ---------------------------------------
function initSSE() {
  initSession();
  
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/stream');

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

function safePlay() {
  const promptEl = document.getElementById('autoplay-prompt');
  
  playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        if (promptEl) promptEl.style.display = 'none';
      })
      .catch(e => {
        console.log('Autoplay status:', e.message);
        if (e.name === 'NotAllowedError' && promptEl) {
          promptEl.style.display = 'flex';
        }
      });
  }
  return playPromise;
}

let latestServerElapsed = 0;

audio.addEventListener('loadedmetadata', () => {
  if (audio.dataset.pendingElapsed !== undefined) {
    const targetTime = parseFloat(audio.dataset.pendingElapsed);
    if (!isNaN(targetTime) && audio.duration) {
      audio.currentTime = Math.min(targetTime, Math.max(0, audio.duration - 0.5));
    }
    delete audio.dataset.pendingElapsed;
  }
});

function handleServerSync(data) {
  if (!data || !data.track) return;

  const isNewTrack = activeTrackId !== data.track.id;
  latestServerElapsed = data.elapsed || 0;
  
  if (isNewTrack) {
    activeTrackId = data.track.id;
    audio.src = data.track.url;
    audio.dataset.pendingElapsed = latestServerElapsed;
    if (hasUserStartedPlay) {
      safePlay();
    }
  }

  if (audio.duration && !isNaN(data.elapsed) && !isNaN(audio.duration)) {
    const drift = Math.abs(audio.currentTime - data.elapsed);
    if (drift > 2.5) {
      audio.currentTime = Math.min(data.elapsed, Math.max(0, audio.duration - 0.5));
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
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(sendHeartbeat, 10000);
}

// Page Visibility API Resync
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchSyncFallback();
  }
});

// --- PLAY / PAUSE BUTTON & EVENT SYNCHRONIZATION ------------------
const playBtn = document.getElementById('play-btn');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnNextMini = document.getElementById('btn-next-mini');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const autoplayJoinBtn = document.getElementById('autoplay-join-btn');

function updatePlayBtnUI() {
  if (!playBtn) return;
  if (!audio.paused) {
    playBtn.classList.add('playing');
    playBtn.setAttribute('title', 'Pause');
    playBtn.setAttribute('aria-label', 'Pause');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  } else {
    playBtn.classList.remove('playing');
    playBtn.setAttribute('title', 'Play');
    playBtn.setAttribute('aria-label', 'Play');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  }
}

audio.addEventListener('play', updatePlayBtnUI);
audio.addEventListener('pause', updatePlayBtnUI);
audio.addEventListener('playing', updatePlayBtnUI);

function togglePlayPause() {
  hasUserStartedPlay = true;
  if (audio.paused) {
    if (audio.duration && !isNaN(latestServerElapsed)) {
      const drift = Math.abs(audio.currentTime - latestServerElapsed);
      if (drift > 2.5) {
        audio.currentTime = Math.min(latestServerElapsed, Math.max(0, audio.duration - 0.5));
      }
    }
    safePlay();
  } else {
    audio.pause();
  }
  updatePlayBtnUI();
}

if (playBtn) playBtn.addEventListener('click', togglePlayPause);
if (autoplayJoinBtn) {
  autoplayJoinBtn.addEventListener('click', () => {
    hasUserStartedPlay = true;
    safePlay();
  });
}

let isShuffle = false;
let isRepeat = false;

function triggerTrackChange(action) {
  const now = Date.now();
  if (now - lastControlTime < 250) return; // Debounce rapid clicks
  lastControlTime = now;

  hasUserStartedPlay = true;
  fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  })
  .then(res => res.json())
  .then(data => {
    if (data.track) {
      handleServerSync(data);
      safePlay();
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
    safePlay();
  } else if (isShuffle) {
    triggerTrackChange('shuffle');
  } else {
    // In live radio stream mode, local audio completion should NOT trigger server track advance.
    // Fetch latest server radio state to stay in sync.
    fetchSyncFallback();
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

  if (progressWrap) {
    progressWrap.setAttribute('aria-valuenow', Math.round(pct));
  }
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
let listenerUpdateTimeout = null;

function setListenerCount(newCount) {
  const countEl = document.getElementById('listeners-count');
  if (!countEl || currentListenersCount === newCount) return;

  if (listenerUpdateTimeout) clearTimeout(listenerUpdateTimeout);

  countEl.style.transform = 'scale(1.1)';
  listenerUpdateTimeout = setTimeout(() => {
    currentListenersCount = newCount;
    countEl.innerText = `${newCount} dancing right now`;
    countEl.style.transform = 'scale(1)';
  }, 150);
}

// --- UI RENDER & PLAYLIST TABLE ------------------------------

function updateUI(data) {
  if (!data || !data.track) return;
  activeTrackId = data.track.id;
  const titleEl = document.getElementById('track-title');
  const artistEl = document.getElementById('track-artist');
  const nextTrackEl = document.getElementById('next-up-name');

  if (titleEl) titleEl.innerText = data.track.title;
  if (artistEl) artistEl.innerText = data.track.artist;
  if (nextTrackEl && data.nextTrack) nextTrackEl.innerText = `${data.nextTrack.title} — ${data.nextTrack.artist}`;

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
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    
    const playTrackAction = () => {
      hasUserStartedPlay = true;
      fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'playTrack', trackId: t.id })
      })
      .then(res => res.json())
      .then(data => {
        if (data.track) {
          handleServerSync(data);
          safePlay();
        }
      })
      .catch(console.error);
    };

    item.onclick = playTrackAction;
    item.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playTrackAction();
      }
    };

    item.innerHTML = `
      <div class="playlist-track-info">
        <span class="playlist-track-index" aria-hidden="true">${isCurrent ? '▶' : (i + 1)}</span>
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
const SUN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0zm-12.37 12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z"/></svg>`;

const MOON_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12.3 2a10 10 0 0 0-1.9 20 10 10 0 0 0 9.6-7 1 1 0 0 0-1.2-1.2 8 8 0 1 1-8.5-10.6 1 1 0 0 0-1-1.2z"/></svg>`;

function getAutoTheme() {
  const saved = localStorage.getItem('sg_theme');
  if (saved) return saved;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return (mins >= 360 && mins < 1110) ? 'day' : 'night';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('sg_theme', theme);

  const labelEl = document.getElementById('theme-toggle-label');
  const iconEl = document.getElementById('theme-toggle-icon');
  
  if (labelEl) labelEl.innerText = theme === 'day' ? 'Day Mode' : 'Night Mode';
  if (iconEl) iconEl.innerHTML = theme === 'day' ? MOON_ICON : SUN_ICON;
}

const themeBtn = document.getElementById('theme-toggle-btn');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || getAutoTheme();
    applyTheme(current === 'day' ? 'night' : 'day');
  });
}

// Accordion FAQ Setup with ARIA
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.parentElement;
    const isActive = parent.classList.toggle('active');
    btn.setAttribute('aria-expanded', isActive);
  });
});

// Keyboard Accessibility Shortcuts
document.addEventListener('keydown', (e) => {
  // Ignore if user is typing in an input
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    triggerTrackChange(isShuffle ? 'shuffle' : 'next');
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    triggerTrackChange(isShuffle ? 'shuffle' : 'prev');
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    audio.muted = !audio.muted;
  }
});

// Initialize Engine
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getAutoTheme());
  initSSE();
  startHeartbeat();
});
