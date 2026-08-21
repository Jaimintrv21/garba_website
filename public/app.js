/* ================================================================
   Shere Garba — Full Client-Side Architecture with YouTube IFrame API
   Phase 1: Individual Sessions    Phase 4: Dynamic Ordering
   Phase 2: Firebase Presence      Phase 5: Schedule + Like Counts
   Phase 3: Like System            Phase 6: Theme / UI / Shortcuts
   ================================================================ */
'use strict';

// ─── YouTube Player & Core Session State ─────────────────────────
let ytPlayer          = null;
let ytPlayerReady     = false;
let progressPollTimer = null;

let sessionPlaylist  = [];     // Phase 4: frozen sorted queue for this session
let currentIndex     = -1;     // Current position in sessionPlaylist
let hasStarted       = false;  // User has interacted (play pressed)
let isShuffle        = false;
let isRepeat         = false;

// ─── Firebase State ───────────────────────────────────────────────
let db             = null;
let firebaseUid    = null;
let firebaseReady  = false;
let _likeCounts    = {};       // Snapshot at session-start (for sorting)
let likeUnsub      = null;     // Detach current-track like listener
let likeCountUnsub = null;     // Detach current-track count listener
let scheduleCountUnsub = null; // Detach schedule-wide count listener

/* ══════════════════════════════════════════════════════════════
   YOUTUBE IFRAME PLAYLIST INITIALIZATION
   ══════════════════════════════════════════════════════════════ */
window.onYouTubeIframeAPIReady = function() {
  ytPlayer = new YT.Player('yt-player', {
    height: '0',
    width: '0',
    playerVars: {
      listType: 'playlist',
      list: 'PLW9GcL5WxaRE',
      autoplay: 0,
      controls: 0,
      rel: 0,
      modestbranding: 1,
      origin: window.location.origin
    },
    events: {
      onReady: onYTPlayerReady,
      onStateChange: onYTPlayerStateChange,
      onError: onYTPlayerError
    }
  });
};

function onYTPlayerReady(event) {
  ytPlayerReady = true;
  console.log('[YouTube API] ✓ Player ready with playlist PLW9GcL5WxaRE');
  startProgressPolling();
  updateUIFromPlaylist();
}

let lastVideoId = '';

function onYTPlayerStateChange(event) {
  updatePlayBtnUI();
  console.log('[YouTube API] State change:', event.data);

  // When video starts playing or buffering, update track metadata UI if changed
  if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING) {
    updateUIFromPlaylist();
  }
}

function onYTPlayerError(event) {
  console.warn('[YouTube API] Player error code:', event.data);
  const titleEl = document.getElementById('track-title');
  if (titleEl) {
    titleEl.innerText = `⚠️ Track Unavailable`;
  }
}

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

    return new Promise((resolve) => {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          firebaseUid = user.uid;
          firebaseReady = true;
          console.log('[Firebase] ✓ uid:', firebaseUid);
          
          const likeBtn = document.getElementById('like-btn');
          if (likeBtn) likeBtn.style.opacity = '1';

          setupPresence();
          attachScheduleFirebaseListener();
          if (currentIndex >= 0 && sessionPlaylist[currentIndex]) {
            attachTrackFirebaseListeners(sessionPlaylist[currentIndex].id);
          }
          resolve();
        }
      });

      firebase.auth().signInAnonymously().catch(e => {
        console.warn('[Firebase] Anon auth failed:', e.message);
        resolve();
      });
    });
  } catch (e) {
    console.warn('[Firebase] Init failed:', e.message);
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
   PHASE 4 — Dynamic Playlist Ordering (frozen at session start)
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
    return diff !== 0 ? diff : a.id - b.id; // tie → original order
  });
}

/* ══════════════════════════════════════════════════════════════
/* ══════════════════════════════════════════════════════════════
   PLAYLIST METADATA & UI SYNC
   ══════════════════════════════════════════════════════════════ */
function updateUIFromPlaylist() {
  if (!ytPlayerReady || !ytPlayer || !ytPlayer.getVideoData) return;

  const videoData = ytPlayer.getVideoData();
  if (!videoData || !videoData.video_id) return;

  if (videoData.video_id === lastVideoId) return;
  lastVideoId = videoData.video_id;

  console.log('[YouTube Playlist] Playing video:', videoData.title, 'id:', videoData.video_id);

  // Match with our polished local track metadata if available
  const matched = sessionPlaylist.find(t => t.youtubeId === videoData.video_id);
  const title  = matched ? matched.title  : (videoData.title || 'Navratri Garba Track');
  const artist = matched ? matched.artist : (videoData.author || 'Live Radio');
  const trackId = matched ? matched.id : 1;

  const titleEl  = document.getElementById('track-title');
  const artistEl = document.getElementById('track-artist');
  if (titleEl)  titleEl.innerText  = title;
  if (artistEl) artistEl.innerText = artist;

  // Calculate Up Next from YT Playlist API
  const nextEl = document.getElementById('next-up-name');
  if (nextEl && ytPlayer.getPlaylist && ytPlayer.getPlaylistIndex) {
    const list = ytPlayer.getPlaylist() || [];
    const idx  = ytPlayer.getPlaylistIndex() || 0;
    const nextVideoId = list[(idx + 1) % list.length];
    const nextMatched = sessionPlaylist.find(t => t.youtubeId === nextVideoId);
    if (nextMatched) {
      nextEl.innerText = `${nextMatched.title} — ${nextMatched.artist}`;
    } else {
      nextEl.innerText = `Track ${((idx + 1) % list.length) + 1} in Playlist`;
    }
  }

  attachTrackFirebaseListeners(trackId);
}

/* ══════════════════════════════════════════════════════════════
   YOUTUBE ENGINE CONTROLS
   ══════════════════════════════════════════════════════════════ */
function playNextVideo() {
  hasStarted = true;
  if (ytPlayerReady && ytPlayer && ytPlayer.nextVideo) {
    ytPlayer.nextVideo();
  }
}

function playPrevVideo() {
  hasStarted = true;
  if (ytPlayerReady && ytPlayer && ytPlayer.previousVideo) {
    ytPlayer.previousVideo();
  }
}

function skipSeconds(delta) {
  if (!ytPlayerReady || !ytPlayer || !ytPlayer.getCurrentTime) return;
  const cur = ytPlayer.getCurrentTime() || 0;
  const dur = ytPlayer.getDuration() || 0;
  ytPlayer.seekTo(Math.max(0, Math.min(dur - 0.1, cur + delta)), true);
}

function togglePlayPause() {
  hasStarted = true;
  const prompt = document.getElementById('autoplay-prompt');
  if (prompt) prompt.style.display = 'none';

  if (!ytPlayerReady || !ytPlayer) return;

  const state = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
  if (state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
}

/* ══════════════════════════════════════════════════════════════
   PHASE 3 — Like System
   ══════════════════════════════════════════════════════════════ */
let currentTrackId = 1;

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

  // Listen for current user's like status on this active track
  const myLikeRef = db.ref(`/likes/${trackId}/${firebaseUid}`);
  const onMyLike  = myLikeRef.on('value', snap => {
    likeBtn.classList.toggle('liked', snap.exists());
  });
  likeUnsub = () => myLikeRef.off('value', onMyLike);

  // Listen for total like count on active track
  const likesRef = db.ref(`/likes/${trackId}`);
  const onLikesChange = likesRef.on('value', snap => {
    const totalLikes = snap.numChildren();
    likeCount.textContent = totalLikes;
    db.ref(`/likeCounts/${trackId}`).set(totalLikes);
  });
  likeCountUnsub = () => likesRef.off('value', onLikesChange);
}

async function toggleLike() {
  if (!firebaseReady || !firebaseUid || !db) {
    console.warn('[Firebase] Like ignored: Auth or database not ready');
    return;
  }

  const trackId = currentTrackId || 1;
  const likeBtn = document.getElementById('like-btn');
  const isCurrentlyLiked = likeBtn?.classList.contains('liked');

  // Optimistic UI update for instantaneous visual feedback
  if (likeBtn) likeBtn.classList.toggle('liked', !isCurrentlyLiked);

  const myRef = db.ref(`/likes/${trackId}/${firebaseUid}`);
  try {
    if (isCurrentlyLiked) {
      await myRef.remove();
    } else {
      await myRef.set(true);
    }
  } catch (err) {
    console.error('[Firebase] Like toggle failed:', err);
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

    const go = () => { 
      hasStarted = true; 
      if (ytPlayerReady && ytPlayer && ytPlayer.getPlaylist && ytPlayer.playVideoAt) {
        const list = ytPlayer.getPlaylist() || [];
        const ytIndex = list.findIndex(id => id === t.youtubeId);
        if (ytIndex !== -1) {
          ytPlayer.playVideoAt(ytIndex);
        } else {
          ytPlayer.playVideoAt(rank);
        }
      }
    };
    item.onclick = go;
    item.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    container.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════════════════
   UI — Now Playing + Controls
   ══════════════════════════════════════════════════════════════ */
function updateNowPlayingUI(track, index) {
  const titleEl  = document.getElementById('track-title');
  const artistEl = document.getElementById('track-artist');
  const nextEl   = document.getElementById('next-up-name');
  if (titleEl)  titleEl.innerText  = track.title;
  if (artistEl) artistEl.innerText = track.artist;
  const nextIndex = (index + 1) % sessionPlaylist.length;
  const next = sessionPlaylist[nextIndex];
  if (nextEl) nextEl.innerText = next ? `${next.title} — ${next.artist}` : 'End of queue';
}

function updatePlayBtnUI() {
  const btn = document.getElementById('play-btn');
  if (!btn) return;
  const playing = ytPlayerReady && ytPlayer && ytPlayer.getPlayerState && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING;
  btn.innerHTML = playing
    ? '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function startProgressPolling() {
  if (progressPollTimer) clearInterval(progressPollTimer);
  progressPollTimer = setInterval(updateProgress, 500);
}

function updateProgress() {
  if (!ytPlayerReady || !ytPlayer || !ytPlayer.getCurrentTime) return;
  const fill = document.getElementById('progress-fill-bar');
  const cur  = document.getElementById('time-current');
  const rem  = document.getElementById('time-remaining');
  const wrap = document.getElementById('player-progress-wrap');

  const c = ytPlayer.getCurrentTime() || 0;
  const d = ytPlayer.getDuration() || (sessionPlaylist[currentIndex]?.duration || 1);
  const pct = Math.min(100, (c / d) * 100);

  if (fill) fill.style.width = `${pct}%`;
  if (cur)  cur.innerText   = formatTime(c);
  if (rem)  rem.innerText   = `-${formatTime(Math.max(0, d - c))}`;
  if (wrap) wrap.setAttribute('aria-valuenow', Math.round(pct));
}

const progressWrap = document.getElementById('player-progress-wrap');
if (progressWrap) {
  progressWrap.addEventListener('click', e => {
    if (!ytPlayerReady || !ytPlayer || !ytPlayer.getDuration) return;
    const r = progressWrap.getBoundingClientRect();
    const d = ytPlayer.getDuration() || 1;
    const targetSeconds = ((e.clientX - r.left) / r.width) * d;
    ytPlayer.seekTo(targetSeconds, true);
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
    void el.offsetWidth; // trigger reflow
    el.classList.add('count-pop');
  }
}

/* ══════════════════════════════════════════════════════════════
   PHASE 6 — Wire Up Controls, Theme, FAQ, Keyboard
   ══════════════════════════════════════════════════════════════ */
function wireControls() {
  const $ = id => document.getElementById(id);

  $('play-btn')     ?.addEventListener('click', togglePlayPause);
  $('btn-prev')     ?.addEventListener('click', playPrevVideo);
  $('btn-next')     ?.addEventListener('click', playNextVideo);
  $('btn-next-mini')?.addEventListener('click', playNextVideo);
  $('btn-skip-back')?.addEventListener('click', () => skipSeconds(-15));
  $('btn-skip-fwd') ?.addEventListener('click', () => skipSeconds(15));
  $('autoplay-join-btn')?.addEventListener('click', () => { 
    hasStarted = true; 
    const prompt = $('autoplay-prompt');
    if (prompt) prompt.style.display = 'none';
    if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo(); 
  });
  $('like-btn')     ?.addEventListener('click', toggleLike);

  $('btn-shuffle')?.addEventListener('click', () => {
    isShuffle = !isShuffle;
    $('btn-shuffle')?.classList.toggle('active', isShuffle);
  });
  $('btn-repeat')?.addEventListener('click', () => {
    isRepeat = !isRepeat;
    $('btn-repeat')?.classList.toggle('active', isRepeat);
  });

  // Theme toggle
  const SUN  = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-2.24-5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0zm-12.37 12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z"/></svg>`;
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
    if (e.code === 'ArrowRight') { e.preventDefault(); isShuffle ? skipTo(Math.floor(Math.random() * sessionPlaylist.length)) : skipTo(currentIndex + 1); }
    if (e.code === 'ArrowLeft')  { e.preventDefault(); skipTo(currentIndex - 1); }
    if (e.code === 'KeyM')       { 
      e.preventDefault(); 
      if (ytPlayer && ytPlayer.isMuted) {
        if (ytPlayer.isMuted()) ytPlayer.unMute(); else ytPlayer.mute();
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   BOOT — DOMContentLoaded
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  wireControls();

  await initFirebase();

  let rawPlaylist = [];
  try {
    rawPlaylist = await fetch('/api/playlist').then(r => r.json());
  } catch (e) { console.error('Failed to fetch playlist:', e); return; }

  sessionPlaylist = await buildSessionPlaylist(rawPlaylist);

  attachScheduleFirebaseListener();
  renderSchedule();

  updateListenerCount(1);
});
