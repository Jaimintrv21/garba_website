/* ================================================================
   Shere Garba — Local Song Audio Player + Realtime Firebase Architecture
   ================================================================ */
'use strict';

// ─── Core Audio + Session State ──────────────────────────────────
const audio = new Audio();
audio.preload = 'auto';

let sessionPlaylist  = [];     // Frozen sorted queue for this session
let currentIndex     = -1;     // Current position in sessionPlaylist
let hasStarted       = false;  // User has interacted (play pressed)
let isShuffle        = false;
let isRepeat         = false;

// ─── Firebase State ───────────────────────────────────────────────
let db             = null;
let firebaseUid    = null;
let firebaseReady  = false;
let _likeCounts    = {};       // Snapshot at session-start
let currentTrackId = 1;
let likeUnsub      = null;     // Detach current-track like listener
let likeCountUnsub = null;     // Detach current-track count listener
let scheduleCountUnsub = null; // Detach schedule-wide count listener

/* ══════════════════════════════════════════════════════════════
   PHASE 2 — Firebase Anonymous Auth + Presence
   ══════════════════════════════════════════════════════════════ */
async function initFirebase() {
  let cfg = window.FIREBASE_CONFIG;
  if (!cfg || cfg.apiKey === 'YOUR_API_KEY' || !cfg.apiKey) {
    try {
      const res = await fetch('/api/firebase-config');
      const data = await res.json();
      if (data.configured) {
        cfg = data;
      }
    } catch (e) {
      console.warn('[Firebase] Failed to fetch config from server:', e);
    }
  }

  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    console.warn('[Firebase] Not configured — likes/presence disabled');
    return;
  }

  try {
    firebase.initializeApp(cfg);
    db = firebase.database();
    console.log('[Firebase] ✓ Initialized successfully. db:', !!db);

    const likeBtn = document.getElementById('like-btn');
    if (likeBtn) {
      likeBtn.disabled = true;
      likeBtn.style.opacity = '0.5';
    }

    return new Promise((resolve) => {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          firebaseUid = user.uid;
          firebaseReady = true;
          console.log('[Firebase] ✓ User auth ready. uid:', firebaseUid);

          if (likeBtn) {
            likeBtn.disabled = false;
            likeBtn.style.opacity = '1';
          }

          setupPresence();
          attachScheduleFirebaseListener();
          const activeTrackId = currentTrackId || (sessionPlaylist[currentIndex]?.id) || 1;
          attachTrackFirebaseListeners(activeTrackId);
          resolve();
        }
      });

      firebase.auth().signInAnonymously().catch(e => {
        console.warn('[Firebase] Anon auth failed:', e.message);
        resolve();
      });
    });
  } catch (e) {
    console.error('[Firebase] Initialization FAILED:', e);
  }
}

function setupPresence() {
  if (!firebaseReady || !db || !firebaseUid) return;

  const connectedRef = db.ref('.info/connected');
  const presenceRef = db.ref(`/presence/${firebaseUid}`);

  connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
      presenceRef.onDisconnect().remove().then(() => {
        presenceRef.set({ connectedAt: firebase.database.ServerValue.TIMESTAMP });
      });
    }
  });

  db.ref('/presence').on('value', snap => {
    updateListenerCount(Math.max(1, snap.numChildren()));
  });
}

/* ══════════════════════════════════════════════════════════════
   PHASE 4 — Dynamic Playlist Ordering
   ══════════════════════════════════════════════════════════════ */
async function buildSessionPlaylist(rawList) {
  if (firebaseReady && db) {
    try {
      const snap = await db.ref('/likeCounts').once('value');
      _likeCounts = snap.val() || {};
    } catch (e) { _likeCounts = {}; }
  }
  return [...rawList].sort((a, b) => {
    const diff = (_likeCounts[b.id] || 0) - (_likeCounts[a.id] || 0);
    return diff !== 0 ? diff : a.id - b.id;
  });
}

/* ══════════════════════════════════════════════════════════════
   LOCAL AUDIO ENGINE CONTROLS (public/songs/)
   ══════════════════════════════════════════════════════════════ */
function playTrack(index) {
  if (index < 0 || index >= sessionPlaylist.length) return;
  currentIndex = index;
  const track  = sessionPlaylist[index];

  console.log('[Audio] Loading local song file:', track.title, '| URL:', track.url);

  audio.src = track.url;
  audio.load();

  if (hasStarted) {
    audio.play().catch(e => console.warn('[Audio] Playback interrupted:', e));
  }

  updateNowPlayingUI(track, index);
  attachTrackFirebaseListeners(track.id);
  renderSchedule();
}

function skipTo(index) {
  playTrack(((index % sessionPlaylist.length) + sessionPlaylist.length) % sessionPlaylist.length);
}

function playNextTrack() {
  if (isShuffle) {
    skipTo(Math.floor(Math.random() * sessionPlaylist.length));
  } else {
    skipTo(currentIndex + 1);
  }
}

function playPrevTrack() {
  skipTo(currentIndex - 1);
}

function skipSeconds(delta) {
  if (!audio.duration) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration - 0.1, audio.currentTime + delta));
}

function togglePlayPause() {
  hasStarted = true;
  const prompt = document.getElementById('autoplay-prompt');
  if (prompt) prompt.style.display = 'none';

  if (currentIndex < 0) {
    skipTo(0);
    return;
  }

  if (audio.paused) {
    audio.play().catch(e => console.warn('[Audio] Play failed:', e));
  } else {
    audio.pause();
  }
}

audio.addEventListener('ended', () => {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    playNextTrack();
  }
});

/* ══════════════════════════════════════════════════════════════
   PHASE 3 — Realtime Firebase Like System
   ══════════════════════════════════════════════════════════════ */
function attachTrackFirebaseListeners(trackId) {
  currentTrackId = trackId;
  if (likeUnsub)      { likeUnsub();      likeUnsub      = null; }
  if (likeCountUnsub) { likeCountUnsub(); likeCountUnsub = null; }

  const likeBtn   = document.getElementById('like-btn');
  const likeCount = document.getElementById('like-count');
  if (!likeBtn || !likeCount) return;

  likeBtn.classList.remove('liked');
  likeCount.textContent = _likeCounts[trackId] || 0;

  if (!firebaseReady || !db || !firebaseUid) {
    likeBtn.style.opacity = '0.5';
    return;
  }
  likeBtn.style.opacity = '1';

  // Real-time listener for user's personal like state
  const myLikeRef = db.ref(`/likes/${trackId}/${firebaseUid}`);
  const onMyLike  = myLikeRef.on('value', snap => {
    likeBtn.classList.toggle('liked', snap.exists());
  });
  likeUnsub = () => myLikeRef.off('value', onMyLike);

  // Real-time listener for total track like count
  const likesRef = db.ref(`/likes/${trackId}`);
  const onLikesChange = likesRef.on('value', snap => {
    const totalLikes = snap.numChildren();
    likeCount.textContent = totalLikes;
    db.ref(`/likeCounts/${trackId}`).set(totalLikes);
  });
  likeCountUnsub = () => likesRef.off('value', onLikesChange);
}

async function toggleLike() {
  console.log('[Like Button] toggleLike called', {
    dbReady: !!db,
    firebaseReady: firebaseReady,
    firebaseUid: firebaseUid
  });

  if (!firebaseReady || !firebaseUid || !db) {
    console.warn('[Firebase] Like ignored: Auth or database not ready');
    return;
  }

  const trackId = currentTrackId || (sessionPlaylist[currentIndex]?.id) || 1;
  const likeBtn = document.getElementById('like-btn');
  const isCurrentlyLiked = likeBtn?.classList.contains('liked');

  // Instant optimistic UI state update
  if (likeBtn) likeBtn.classList.toggle('liked', !isCurrentlyLiked);

  const myRef = db.ref(`/likes/${trackId}/${firebaseUid}`);
  try {
    if (isCurrentlyLiked) {
      await myRef.remove();
    } else {
      await myRef.set(true);
    }
  } catch (err) {
    console.error('[Firebase] Like write failed:', err);
    if (likeBtn) likeBtn.classList.toggle('liked', isCurrentlyLiked); // Rollback on error
  }
}

/* ══════════════════════════════════════════════════════════════
   PHASE 5 — Schedule View with Real-Time Like Counts
   ══════════════════════════════════════════════════════════════ */
let scheduleLiveCounts = {};

function attachScheduleFirebaseListener() {
  if (!firebaseReady || !db) return;
  const ref = db.ref('/likeCounts');
  scheduleCountUnsub = () => ref.off();
  ref.on('value', snap => {
    scheduleLiveCounts = snap.val() || {};
    renderSchedule();
  });
}

function renderSchedule() {
  const container = document.getElementById('playlist-items');
  if (!container || !sessionPlaylist.length) return;

  const display = [...sessionPlaylist].sort((a, b) => {
    const diff = (scheduleLiveCounts[b.id] || 0) - (scheduleLiveCounts[a.id] || 0);
    return diff !== 0 ? diff : a.id - b.id;
  });

  container.innerHTML = '';
  display.forEach((t, rank) => {
    const isCurrent = sessionPlaylist[currentIndex]?.id === t.id;
    const likes = scheduleLiveCounts[t.id] || 0;
    const isTop = rank === 0 && likes > 0;
    const idx   = sessionPlaylist.findIndex(s => s.id === t.id);

    const item = document.createElement('div');
    item.className = `playlist-item${isCurrent ? ' active' : ''}`;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');

    item.innerHTML = `
      <div class="playlist-track-info">
        <span class="playlist-track-index">${isCurrent ? '▶' : (rank + 1)}</span>
        <div>
          <div class="playlist-track-title">
            ${isTop ? '<span class="most-loved-badge">🔥 Most Loved</span> ' : ''}
            ${t.title}
            ${isCurrent ? '<span class="now-playing-label">NOW PLAYING</span>' : ''}
          </div>
          <div class="playlist-track-artist">${t.artist}</div>
        </div>
      </div>
      <div class="playlist-right">
        <span class="track-likes" title="${likes} likes">
          <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          ${likes}
        </span>
        <span class="playlist-track-duration">${formatTime(t.duration)}</span>
      </div>`;

    const go = () => { hasStarted = true; playTrack(idx); audio.play().catch(() => {}); };
    item.onclick = go;
    item.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    container.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════════════════
   UI — Now Playing + Controls + Progress Bar
   ══════════════════════════════════════════════════════════════ */
function updateNowPlayingUI(track, index) {
  const titleEl  = document.getElementById('track-title');
  const artistEl = document.getElementById('track-artist');
  const nextEl   = document.getElementById('next-up-name');

  if (titleEl)  titleEl.innerText  = track.title;
  if (artistEl) artistEl.innerText = track.artist;

  const nextIndex = (index + 1) % sessionPlaylist.length;
  const nextTrack = sessionPlaylist[nextIndex];

  if (nextEl && nextTrack) {
    nextEl.innerText = `${nextTrack.title} — ${nextTrack.artist}`;
  } else if (nextEl) {
    nextEl.innerText = 'End of Playlist';
  }
}

function updatePlayBtnUI() {
  const btn = document.getElementById('play-btn');
  if (!btn) return;
  const paused = audio.paused;
  btn.innerHTML = paused
    ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  btn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
}

audio.addEventListener('play',    updatePlayBtnUI);
audio.addEventListener('pause',   updatePlayBtnUI);
audio.addEventListener('playing', updatePlayBtnUI);

function updateProgress() {
  const fill = document.getElementById('progress-fill-bar');
  const cur  = document.getElementById('time-current');
  const rem  = document.getElementById('time-remaining');
  const wrap = document.getElementById('player-progress-wrap');
  const c = audio.currentTime || 0, d = audio.duration || 1;
  const pct = Math.min(100, (c / d) * 100);
  if (fill) fill.style.width = `${pct}%`;
  if (cur)  cur.innerText   = formatTime(c);
  if (rem)  rem.innerText   = `-${formatTime(Math.max(0, d - c))}`;
  if (wrap) wrap.setAttribute('aria-valuenow', Math.round(pct));
}
audio.addEventListener('timeupdate', updateProgress);

const progressWrap = document.getElementById('player-progress-wrap');
if (progressWrap) {
  progressWrap.addEventListener('click', e => {
    if (!audio.duration) return;
    const r = progressWrap.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
}

function formatTime(s) {
  if (isNaN(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function updateListenerCount(n) {
  const el = document.getElementById('listeners-count');
  if (!el) return;
  const newText = `${n} listening now`;
  if (el.innerText !== newText) {
    el.innerText = newText;
    el.classList.remove('count-pop');
    void el.offsetWidth;
    el.classList.add('count-pop');
  }
}

/* ══════════════════════════════════════════════════════════════
   PHASE 6 — Wire Up Controls, Theme, FAQ, Keyboard
   ══════════════════════════════════════════════════════════════ */
function wireControls() {
  const $ = id => document.getElementById(id);

  $('play-btn')     ?.addEventListener('click', togglePlayPause);
  $('btn-prev')     ?.addEventListener('click', playPrevTrack);
  $('btn-next')     ?.addEventListener('click', playNextTrack);
  $('btn-next-mini')?.addEventListener('click', playNextTrack);
  $('btn-skip-back')?.addEventListener('click', () => skipSeconds(-15));
  $('btn-skip-fwd') ?.addEventListener('click', () => skipSeconds(15));
  $('autoplay-join-btn')?.addEventListener('click', () => { 
    hasStarted = true; 
    const prompt = $('autoplay-prompt');
    if (prompt) prompt.style.display = 'none';
    audio.play().catch(() => {});
  });
  $('like-btn')     ?.addEventListener('click', toggleLike);

  $('btn-shuffle')?.addEventListener('click', () => {
    isShuffle = !isShuffle;
    $('btn-shuffle')?.classList.toggle('active', isShuffle);
  });
  $('btn-repeat')?.addEventListener('click', () => {
    isRepeat = !isRepeat;
    audio.loop = isRepeat;
    $('btn-repeat')?.classList.toggle('active', isRepeat);
  });

  // Theme toggle
  const SUN  = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0zm-12.37 12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z"/></svg>`;
  const MOON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.3 2a10 10 0 0 0-1.9 20 10 10 0 0 0 9.6-7 1 1 0 0 0-1.2-1.2 8 8 0 1 1-8.5-10.6 1 1 0 0 0-1-1.2z"/></svg>`;

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.body.setAttribute('data-theme', t);
    localStorage.setItem('sg_theme', t);
    const lbl = $('theme-toggle-label'), ico = $('theme-toggle-icon');
    if (lbl) lbl.innerText = t === 'day' ? 'Day Mode' : 'Night Mode';
    if (ico) ico.innerHTML = t === 'day' ? MOON : SUN;
  }
  function autoTheme() {
    const s = localStorage.getItem('sg_theme'); if (s) return s;
    const m = new Date().getHours() * 60 + new Date().getMinutes();
    return m >= 360 && m < 1110 ? 'day' : 'night';
  }
  applyTheme(autoTheme());
  $('theme-toggle-btn')?.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'day' ? 'night' : 'day');
  });

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const active = btn.parentElement.classList.toggle('active');
      btn.setAttribute('aria-expanded', active);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space')      { e.preventDefault(); togglePlayPause(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); playNextTrack(); }
    if (e.code === 'ArrowLeft')  { e.preventDefault(); playPrevTrack(); }
    if (e.code === 'KeyM')       { e.preventDefault(); audio.muted = !audio.muted; }
  });
}

/* ══════════════════════════════════════════════════════════════
   BOOT — DOMContentLoaded
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  wireControls();

  let rawPlaylist = [];
  try {
    rawPlaylist = await fetch('/api/playlist').then(r => r.json());
  } catch (e) { console.error('Failed to fetch playlist:', e); return; }

  sessionPlaylist = await buildSessionPlaylist(rawPlaylist);

  playTrack(0);

  await initFirebase();

  attachScheduleFirebaseListener();
  renderSchedule();

  updateListenerCount(1);
});
