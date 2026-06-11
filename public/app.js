// ══════════════════════════════════════════════════════════════════════
//  SERIALIST — Open Source TV & YouTube Series Tracker
//  Author: SushiPL-coder | https://github.com/SushiPL-coder/Serialist
//  License: MIT
// ══════════════════════════════════════════════════════════════════════

'use strict';

/* ─────────────────────────────────────────────────────────────────────
   1. CONSTANTS
   ───────────────────────────────────────────────────────────────────── */

const PLATFORMS = [
  { key: 'netflix',  name: 'Netflix',      color: '#E50914', icon: 'tv' },
  { key: 'hbo',      name: 'HBO Max',      color: '#B535F6', icon: 'tv' },
  { key: 'disney',   name: 'Disney+',      color: '#0063E5', icon: 'tv' },
  { key: 'prime',    name: 'Prime',        color: '#00A8E0', icon: 'tv' },
  { key: 'apple',    name: 'Apple TV+',    color: '#A0A5B0', icon: 'tv' },
  { key: 'hulu',     name: 'Hulu',         color: '#1CE783', icon: 'tv' },
  { key: 'sky',      name: 'SkyShowtime',  color: '#0050CC', icon: 'tv' },
  { key: 'canal',    name: 'Canal+',       color: '#E2001A', icon: 'tv' },
  { key: 'youtube',  name: 'YouTube',      color: '#FF0000', icon: 'yt' },
  { key: 'other',    name: 'Inne',         color: '#6B7280', icon: 'tv' },
];

const PLATFORM_GRADIENTS = {
  netflix:  'linear-gradient(160deg,#1a0000,#600010)',
  hbo:      'linear-gradient(160deg,#1a0a28,#4B1870)',
  disney:   'linear-gradient(160deg,#000a30,#001880)',
  prime:    'linear-gradient(160deg,#000a1a,#001840)',
  apple:    'linear-gradient(160deg,#141414,#303030)',
  hulu:     'linear-gradient(160deg,#001a0a,#005028)',
  sky:      'linear-gradient(160deg,#000d28,#001a66)',
  canal:    'linear-gradient(160deg,#1a0000,#600008)',
  youtube:  'linear-gradient(160deg,#1a0000,#550000)',
  other:    'linear-gradient(160deg,#101020,#202040)',
};

const DAYS_PL   = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];
const MONTHS_PL = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
const MONTHS_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

const BACKLOG_DAYS = 30;  // how far back to look for missed episodes

/* ─────────────────────────────────────────────────────────────────────
   2. INDEXEDDB
   ───────────────────────────────────────────────────────────────────── */

const DB = (() => {
  let _db = null;
  const NAME = 'serialist', VER = 1;

  async function open() {
    if (_db) return _db;
    return new Promise((res, rej) => {
      const req = indexedDB.open(NAME, VER);
      req.onerror = () => rej(req.error);
      req.onsuccess = () => { _db = req.result; res(_db); };
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('series')) {
          db.createObjectStore('series', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('watchlist')) {
          db.createObjectStore('watchlist', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('episodes')) {
          const ep = db.createObjectStore('episodes', { keyPath: 'id' });
          ep.createIndex('seriesId', 'seriesId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async function getAll(store) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror  = () => rej(req.error);
    });
  }

  async function get(store, key) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror  = () => rej(req.error);
    });
  }

  async function put(store, obj) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(obj);
      req.onsuccess = () => res(req.result);
      req.onerror  = () => rej(req.error);
    });
  }

  async function del(store, key) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => res();
      req.onerror  = () => rej(req.error);
    });
  }

  async function getByIndex(store, index, val) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).index(index).getAll(val);
      req.onsuccess = () => res(req.result);
      req.onerror  = () => rej(req.error);
    });
  }

  return { getAll, get, put, del, getByIndex };
})();

/* ─────────────────────────────────────────────────────────────────────
   3. STATE
   ───────────────────────────────────────────────────────────────────── */

const S = {
  series:      [],       // all series
  watchlist:   [],       // watchlist items
  episodes:    {},       // keyed by episodeId  {id, seriesId, date, label, watched}
  currentTab:  'calendar',
  weekOffset:  0,
  selectedDay: null,     // Date object
  detailId:    null,     // series id open in detail view
  editId:      null,     // series id being edited (null = new)
  coverB64:    null,     // base64 cover for current modal
  tmdbId:      null,     // tmdb id selected in modal
  pendingConfirmFn: null,
  settings: {
    vapidKey:  '',
    tmdbKey:   '',
    pushEnabled: false,
  },
};

/* ─────────────────────────────────────────────────────────────────────
   4. DATE & SCHEDULE HELPERS
   ───────────────────────────────────────────────────────────────────── */

function today()  { return toDateStr(new Date()); }
function toDate(str)  { const [y,m,d] = str.split('-').map(Number); return new Date(y,m-1,d); }
function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
// Day index: 0=Mon…6=Sun (Polish week)
function dayIdx(date) { const d = date.getDay(); return d === 0 ? 6 : d - 1; }

function getWeekDates(offset = 0) {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - dayIdx(now) + offset * 7);
  mon.setHours(0,0,0,0);
  return Array.from({length: 7}, (_, i) => addDays(mon, i));
}

function formatWeekLabel(dates) {
  const [s, e] = [dates[0], dates[6]];
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS_PL[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
}

function formatDatePL(dateStr) {
  const d = toDate(dateStr);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatDayLong(date) {
  return `${DAYS_PL[dayIdx(date)]}, ${date.getDate()} ${MONTHS_PL[date.getMonth()]}`;
}

/** Generate all episode dates for a series between fromStr and toStr (inclusive) */
function generateEpisodeDates(series, fromStr, toStr) {
  const sched = series.schedule;
  const from  = toDate(fromStr);
  const to    = toDate(toStr);
  const dates = [];

  if (sched.type === 'weekly') {
    const days = sched.days || [];
    let cur = new Date(from);
    while (cur <= to) {
      if (days.includes(dayIdx(cur))) dates.push(toDateStr(cur));
      cur = addDays(cur, 1);
    }

  } else if (sched.type === 'interval') {
    const interval = sched.interval || 3;
    const lastStr  = sched.lastEpisodeDate || series.trackingSince;
    if (!lastStr) return [];
    let cur = toDate(lastStr);
    // step forward from last episode
    while (cur < from) cur = addDays(cur, interval);
    while (cur <= to) {
      if (cur >= from) dates.push(toDateStr(cur));
      cur = addDays(cur, interval);
    }

  } else if (sched.type === 'manual') {
    (sched.dates || []).forEach(d => {
      if (d >= fromStr && d <= toStr) dates.push(d);
    });
  }

  return dates;
}

/** Get episode label for nth episode in series */
function episodeId(seriesId, dateStr, index) {
  // backward-compatible: index 0 lub brak → stary format bez sufiksu
  if (index !== undefined && index > 0) return `${seriesId}__${dateStr}__${index}`;
  return `${seriesId}__${dateStr}`;
}

/** Get episode label for nth episode in series */
function getEpisodeLabel(series, episodeDateStr, releaseIndex = 0) {
  const since   = series.trackingSince || series.createdAt?.slice(0,10) || today();
  const datesTo = generateEpisodeDates(series, since, episodeDateStr);
  const count   = Math.max(1, series.releaseCount || 1);
  // pozycja odcinka: (index daty) * count + releaseIndex + 1
  const n = (datesTo.length - 1) * count + releaseIndex + 1;

  if (series.platform === 'youtube') return `Odc. ${(series.startEpisode || 1) + n - 1}`;

  const startEp  = series.startEpisode || 1;
  const startSsn = series.startSeason  || 1;
  const epsPerS  = Math.max(1, series.episodesPerSeason || 10); // guard: brak div/0

  const totalEp  = startEp + n - 1;
  const season   = startSsn + Math.floor((totalEp - 1) / epsPerS);
  const episode  = ((totalEp - 1) % epsPerS) + 1;

  return `S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`;
}

/* ─────────────────────────────────────────────────────────────────────
   5. EPISODE & BACKLOG LOGIC
   ───────────────────────────────────────────────────────────────────── */

/** Get all unwatched episodes from past BACKLOG_DAYS days */
function getBacklog() {
  const todayStr = today();
  const cutoffStr = toDateStr(addDays(new Date(), -BACKLOG_DAYS));
  const backlog = [];

  S.series.forEach(series => {
    const since = series.trackingSince || cutoffStr;
    const from  = since > cutoffStr ? since : cutoffStr;
    const dates = generateEpisodeDates(series, from, todayStr);
    const count = Math.max(1, series.releaseCount || 1);

    dates.forEach(dateStr => {
      if (dateStr >= todayStr) return; // tylko przeszłe
      for (let i = 0; i < count; i++) {
        const eid    = episodeId(series.id, dateStr, count > 1 ? i : undefined);
        const record = S.episodes[eid];
        if (!record || !record.watched) {
          backlog.push({ series, dateStr, eid, label: getEpisodeLabel(series, dateStr, i) });
        }
      }
    });
  });

  return backlog.sort((a, b) => b.dateStr.localeCompare(a.dateStr)); // newest first
}

/** Backlog count per series */
function getSeriesBacklogCount(seriesId) {
  const todayStr  = today();
  const cutoffStr = toDateStr(addDays(new Date(), -BACKLOG_DAYS));
  const series    = S.series.find(s => s.id === seriesId);
  if (!series) return 0;
  const since = series.trackingSince || cutoffStr;
  const from  = since > cutoffStr ? since : cutoffStr;
  const dates = generateEpisodeDates(series, from, todayStr);
  return dates.filter(d => {
    if (d >= todayStr) return false;
    const r = S.episodes[episodeId(seriesId, d)];
    return !r || !r.watched;
  }).length;
}

/** Toggle watched status */
async function toggleWatched(seriesId, dateStr) {
  const eid    = episodeId(seriesId, dateStr);
  const series = S.series.find(s => s.id === seriesId);
  if (!series) return;

  const existing = S.episodes[eid];
  const nowWatched = existing ? !existing.watched : true;

  const record = {
    id: eid,
    seriesId,
    date: dateStr,
    label: getEpisodeLabel(series, dateStr),
    watched:   nowWatched,
    watchedAt: nowWatched ? new Date().toISOString() : null,
  };

  await DB.put('episodes', record);
  S.episodes[eid] = record;

  // For interval series: update lastEpisodeDate when marking watched
  if (nowWatched && series.schedule.type === 'interval') {
    const currentLast = series.schedule.lastEpisodeDate || '';
    if (dateStr > currentLast) {
      series.schedule.lastEpisodeDate = dateStr;
      await DB.put('series', series);
    }
  }

  return nowWatched;
}

/** Mark all backlog items as watched */
async function markAllBacklogWatched() {
  const backlog = getBacklog();
  for (const item of backlog) {
    await toggleWatched(item.series.id, item.dateStr);
    const btn = document.querySelector(`[data-watch="${item.eid}"]`);
    if (btn) {
      btn.classList.add('watched');
      btn.closest('.ecard')?.classList.add('watched');
    }
  }
  showToast(`Oznaczono ${backlog.length} odcinków jako obejrzane`);
  renderDay(S.selectedDay);
  renderSeriesList();
}

/* ─────────────────────────────────────────────────────────────────────
   6. CALENDAR RENDERING
   ───────────────────────────────────────────────────────────────────── */

function renderCalendar() {
  const dates = getWeekDates(S.weekOffset);

  // Week label
  document.getElementById('week-label').textContent = formatWeekLabel(dates);

  // Day strip
  const todayStr = today();
  const strip    = document.getElementById('day-strip');
  strip.innerHTML = dates.map((d, i) => {
    const ds = toDateStr(d);
    const eps = getEpisodesForDay(d);
    const bl  = getBacklogForDay(d);
    const isToday  = ds === todayStr;
    const isActive = S.selectedDay && toDateStr(S.selectedDay) === ds;

    const dots = eps.slice(0,4).map(e =>
      `<div class="ddot" style="background:${getPlatform(e.series.platform).color}"></div>`
    ).join('');

    return `<button class="dpill${isToday?' today':''}${isActive?' active':''}"
              data-day="${i}" data-date="${ds}"
              aria-label="${DAYS_PL[i]}, ${d.getDate()}"
              ${isActive?'aria-selected="true"':''}>
      <span class="dname">${DAYS_PL[i]}</span>
      <span class="dnum">${d.getDate()}</span>
      <div class="ddots">${dots}</div>
      ${bl.length > 0 && !isActive ? '<div class="backlog-pip"></div>' : ''}
    </button>`;
  }).join('');

  // Today's alert banner
  renderAlert();

  // Render selected day or today
  if (!S.selectedDay) S.selectedDay = new Date();
  renderDay(S.selectedDay);
}

function renderAlert() {
  const wrap     = document.getElementById('cal-alert-wrap');
  const todayStr = today();
  const todayEps = getEpisodesForDay(new Date());
  const upcoming = todayEps.filter(e => {
    const [h, m] = e.series.time.split(':').map(Number);
    const now = new Date();
    return (h * 60 + m) > (now.getHours() * 60 + now.getMinutes());
  });

  if (!upcoming.length) { wrap.innerHTML = ''; return; }
  const next = upcoming[0];
  wrap.innerHTML = `
    <div class="alert">
      <div class="alert-icon"><svg width="18" height="18"><use href="#ic-bell"/></svg></div>
      <div class="alert-body">
        <div class="alert-title">${next.series.title} · ${next.label}</div>
        <div class="alert-sub">${getPlatform(next.series.platform).name} · dziś</div>
      </div>
      <div class="alert-time">${next.series.time}</div>
    </div>`;
}

function renderDay(date) {
  S.selectedDay = date;
  const ds      = toDateStr(date);
  const todayStr = today();
  const isToday  = ds === todayStr;
  const isPast   = ds < todayStr;
  const content  = document.getElementById('day-content');
  const episodes = getEpisodesForDay(date);

  // Update active day pill
  document.querySelectorAll('.dpill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.date === ds);
    btn.removeAttribute('aria-selected');
    if (btn.dataset.date === ds) btn.setAttribute('aria-selected','true');
  });

  let html = '';

  // Section label
  const liveTag = isToday && episodes.length ? '<span class="live-tag">LIVE</span>' : '';
  html += `<div class="sec-label">
    ${isToday ? `<svg width="9" height="9" viewBox="0 0 9 9"><circle cx="4.5" cy="4.5" r="4.5" fill="#FF5353"/></svg> Dziś` : formatDayLong(date)}
    ${liveTag}
  </div>`;

  if (!episodes.length && !isPast) {
    html += `<div class="empty-day">
      <svg width="44" height="44"><use href="#ic-tv"/></svg>
      <p class="empty-day-txt">Brak odcinków tego dnia.</p>
      <button class="empty-link" onclick="switchTab('watchlist')">Przejdź do watchlisty →</button>
    </div>`;
  } else {
    episodes.forEach(e => {
      html += renderEpisodeCard(e, ds, isPast);
    });
  }

  // ── Backlog section ──────────────────────────────────────────────
  // Today:     show ALL unwatched from past 30 days
  // Past day:  show only what was missed specifically on that day
  // Future:    nothing

  let backlogItems = [];
  let backlogLabel = 'Do nadrobienia';
  let showMarkAll  = false;

  if (isToday) {
    backlogItems = getBacklog();          // global: all missed episodes
    showMarkAll  = true;
  } else if (isPast) {
    backlogItems = getBacklog().filter(b => b.dateStr === ds);  // only this day's missed
    backlogLabel = 'Pominięte tego dnia';
  }

  if (backlogItems.length > 0) {
    html += `<div class="backlog-section">
      <div class="backlog-header">
        <div class="sec-label" style="margin-bottom:0">
          <svg width="16" height="16" style="color:var(--warn)"><use href="#ic-inbox"/></svg>
          ${backlogLabel}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="backlog-count-badge">${backlogItems.length}</span>
          ${showMarkAll ? `<button class="btn-mark-backlog-all" onclick="markAllBacklogWatched()">Wszystkie ✓</button>` : ''}
        </div>
      </div>
      ${backlogItems.map(b => renderEpisodeCard(
        { series: b.series, dateStr: b.dateStr, label: b.label,
          eid: b.eid, watched: !!(S.episodes[b.eid]?.watched) },
        b.dateStr, true, true
      )).join('')}
    </div>`;
  }

  content.innerHTML = html;
}

function getEpisodesForDay(date) {
  const ds = toDateStr(date);
  const result = [];
  S.series.forEach(series => {
    const dates = generateEpisodeDates(series, ds, ds);
    if (dates.includes(ds)) {
      const count = Math.max(1, series.releaseCount || 1);
      for (let i = 0; i < count; i++) {
        const eid = episodeId(series.id, ds, count > 1 ? i : undefined);
        result.push({
          series,
          dateStr: ds,
          eid,
          label:   getEpisodeLabel(series, ds, i),
          watched: !!(S.episodes[eid]?.watched),
        });
      }
    }
  });
  return result.sort((a, b) => a.series.time.localeCompare(b.series.time));
}

function getBacklogForDay(date) {
  const ds = toDateStr(date);
  return getBacklog().filter(b => b.dateStr === ds);
}

function renderEpisodeCard({ series, dateStr, label, eid, watched }, currentDayStr, isPast, isBacklog = false) {
  const plat   = getPlatform(series.platform);
  const cover  = series.cover ? `background-image:url(${series.cover})` : `background:${PLATFORM_GRADIENTS[series.platform]||PLATFORM_GRADIENTS.other}`;
  const ytIcon = series.platform === 'youtube' ? `<svg width="9" height="9" style="color:#fff"><use href="#ic-yt"/></svg>` : '';
  const isYt   = series.platform === 'youtube';
  const pc     = plat.color;
  const pg     = pc + '22';
  const intBadge = (series.schedule?.type === 'interval') ? `<span class="int-badge">CO ~${series.schedule.interval||3} DNI</span>` : '';

  return `<div class="ecard${watched?' watched':''}${isBacklog?' backlog-item':''}"
            style="--pc:${pc};--pg:${pg}"
            data-series="${series.id}" data-date="${dateStr}">
    <div class="ecard-glow"></div>
    <div class="ecover">
      <div class="ecover-bg" style="${cover}"></div>
      <svg width="16" height="16"><use href="#ic-img"/></svg>
      <div class="plat-pip" style="background:${pc}">${ytIcon}</div>
    </div>
    <div class="einfo">
      <div class="etitle">${series.title}</div>
      <div class="emeta">
        <span>${label}</span>
        <div class="emeta-dot"></div>
        <span>${plat.name}</span>
        ${intBadge}
        ${isBacklog ? `<div class="emeta-dot"></div><span style="color:var(--warn)">${formatDatePL(dateStr)}</span>` : ''}
      </div>
    </div>
    <div class="eright">
      ${!isBacklog ? `<div class="etime">${series.time}</div>` : ''}
      <button class="btn-watch${watched?' watched':''}" data-watch="${eid}"
              onclick="handleWatchToggle('${series.id}','${dateStr}',event)"
              aria-label="${watched?'Oznacz jako nieobejrzany':'Oznacz jako obejrzany'}">
        <svg width="16" height="16"><use href="#ic-check"/></svg>
      </button>
    </div>
  </div>`;
}

async function handleWatchToggle(seriesId, dateStr, event) {
  event.stopPropagation();
  const nowWatched = await toggleWatched(seriesId, dateStr);
  const eid  = episodeId(seriesId, dateStr);

  // Update all matching buttons
  document.querySelectorAll(`[data-watch="${eid}"]`).forEach(btn => {
    btn.classList.toggle('watched', nowWatched);
    btn.closest('.ecard')?.classList.toggle('watched', nowWatched);
  });

  // Update detail view if open
  if (S.detailId === seriesId) {
    document.querySelectorAll(`.dep-watch-btn[data-watch="${eid}"]`).forEach(btn => {
      btn.classList.toggle('watched', nowWatched);
      btn.closest('.dep-item')?.classList.toggle('watched', nowWatched);
    });
    refreshDetailStats();
  }

  // Refresh backlog indicators
  renderDayStrip();
  showToast(nowWatched ? '✓ Obejrzane!' : 'Oznaczono jako nieobejrzane');
}

function renderDayStrip() {
  document.querySelectorAll('.dpill').forEach(pill => {
    const ds     = pill.dataset.date;
    if (!ds) return;
    const d      = toDate(ds);
    const bl     = getBacklogForDay(d);
    const isAct  = pill.classList.contains('active');
    const pip    = pill.querySelector('.backlog-pip');
    if (bl.length > 0 && !isAct) {
      if (!pip) {
        const el = document.createElement('div');
        el.className = 'backlog-pip';
        pill.appendChild(el);
      }
    } else if (pip) pip.remove();
  });
}

/* ─────────────────────────────────────────────────────────────────────
   7. SERIES LIST
   ───────────────────────────────────────────────────────────────────── */

function renderSeriesList() {
  const list  = document.getElementById('series-list');
  const empty = document.getElementById('series-empty');
  document.getElementById('series-count').textContent = `${S.series.length} ${S.series.length === 1 ? 'tytuł' : 'tytułów'}`;

  if (!S.series.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = S.series.map(series => {
    const plat   = getPlatform(series.platform);
    const cover  = series.cover ? `background-image:url(${series.cover})` : `background:${PLATFORM_GRADIENTS[series.platform]||PLATFORM_GRADIENTS.other}`;
    const bl     = getSeriesBacklogCount(series.id);
    const sched  = scheduleLabel(series);

    return `<div class="scard" onclick="openDetail('${series.id}')">
      <div class="scover2">
        <div class="scover2-bg" style="${cover}"></div>
        <svg width="13" height="13"><use href="#ic-img"/></svg>
      </div>
      <div class="sinfo">
        <div class="stitle2">${series.title}</div>
        <div class="ssched">
          <svg width="11" height="11" style="color:var(--tm)"><use href="#ic-${series.schedule?.type==='interval'?'repeat':'cal'}"/></svg>
          ${sched} · ${plat.name}
        </div>
      </div>
      <div class="scard-right">
        ${bl > 0 ? `<span class="backlog-badge">+${bl} do nadrobienia</span>` : ''}
        <div class="toggle" role="switch" aria-checked="${series.notify?'true':'false'}"
             onclick="toggleSeriesNotify('${series.id}',event)"></div>
      </div>
    </div>`;
  }).join('');
}

function scheduleLabel(series) {
  const s = series.schedule;
  if (!s) return '—';
  if (s.type === 'weekly') {
    const days = (s.days || []).map(d => DAYS_PL[d]).join(', ');
    return `${days || '?'} · ${series.time}`;
  }
  if (s.type === 'interval') return `Co ~${s.interval||3} dni · ${series.time}`;
  if (s.type === 'manual')   return `Ręczny harmonogram`;
  return '—';
}

async function toggleSeriesNotify(id, event) {
  event.stopPropagation();
  const series = S.series.find(s => s.id === id);
  if (!series) return;
  series.notify = !series.notify;
  await DB.put('series', series);
  const toggle = event.currentTarget;
  toggle.setAttribute('aria-checked', series.notify ? 'true' : 'false');
  showToast(series.notify ? `Powiadomienia włączone dla "${series.title}"` : `Powiadomienia wyłączone`);
}

/* ─────────────────────────────────────────────────────────────────────
   8. SERIES DETAIL VIEW
   ───────────────────────────────────────────────────────────────────── */

function openDetail(id) {
  S.detailId = id;
  const series = S.series.find(s => s.id === id);
  if (!series) return;

  const overlay = document.getElementById('detail-overlay');
  const plat    = getPlatform(series.platform);
  const cover   = series.cover ? `background-image:url(${series.cover})` : `background:${PLATFORM_GRADIENTS[series.platform]||PLATFORM_GRADIENTS.other}`;

  document.getElementById('det-cover').style.cssText  = `${cover};background-size:cover;background-position:center`;
  document.getElementById('det-title').textContent    = series.title;
  document.getElementById('det-schedule').textContent = scheduleLabel(series);
  const badge = document.getElementById('det-plat-badge');
  badge.textContent = plat.name;
  badge.style.background = plat.color;

  refreshDetailStats();
  renderDetailEpisodes(series);

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');

  document.getElementById('btn-detail-edit').onclick   = () => { closeDetail(); openSeriesModal(id); };
  document.getElementById('btn-detail-delete').onclick = () => confirmDeleteSeries(id);
  document.getElementById('btn-mark-all-watched').onclick = () => markAllWatchedForSeries(id);
}

function closeDetail() {
  const overlay = document.getElementById('detail-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
  S.detailId = null;
}

function refreshDetailStats() {
  const series  = S.series.find(s => s.id === S.detailId);
  if (!series) return;
  const todayStr   = today();
  const since      = series.trackingSince || todayStr;
  const allPast    = generateEpisodeDates(series, since, todayStr);
  const watchedCnt = allPast.filter(d => {
    if (d >= todayStr) return false;
    return !!(S.episodes[episodeId(series.id, d)]?.watched);
  }).length;
  const backlog  = getSeriesBacklogCount(series.id);
  const upcoming = generateEpisodeDates(series, todayStr, toDateStr(addDays(new Date(), 30)));

  document.getElementById('det-stats').innerHTML = `
    <div class="stat-item"><div class="stat-num">${watchedCnt}</div><div class="stat-lbl">Obejrzane</div></div>
    <div class="stat-item"><div class="stat-num" style="color:var(--warn)">${backlog}</div><div class="stat-lbl">Do nadrobienia</div></div>
    <div class="stat-item"><div class="stat-num" style="color:var(--ok)">${upcoming.length}</div><div class="stat-lbl">Nadchodzi (30 dni)</div></div>`;
}

function renderDetailEpisodes(series) {
  const todayStr  = today();
  const since     = series.trackingSince || toDateStr(addDays(new Date(), -60));
  const fromStr   = since < toDateStr(addDays(new Date(), -90)) ? toDateStr(addDays(new Date(), -90)) : since;
  const toStr     = toDateStr(addDays(new Date(), 30));
  const dates     = generateEpisodeDates(series, fromStr, toStr);

  if (!dates.length) {
    document.getElementById('det-ep-list').innerHTML = '<p style="color:var(--td);font-size:13px;padding:20px 0;text-align:center">Brak odcinków w tym zakresie.</p>';
    return;
  }

  // Show newest first
  const sorted = [...dates].sort((a,b) => b.localeCompare(a));
  document.getElementById('det-ep-list').innerHTML = sorted.map(dateStr => {
    const eid      = episodeId(series.id, dateStr);
    const rec      = S.episodes[eid];
    const watched  = !!(rec?.watched);
    const isFuture = dateStr > todayStr;
    const isToday  = dateStr === todayStr;
    const label    = getEpisodeLabel(series, dateStr);

    return `<div class="dep-item${watched?' watched':''}${isFuture?' future':''}">
      <div class="dep-date${isToday?' today':''}${isFuture?' future':''}">${formatDatePL(dateStr)}</div>
      <div class="dep-label">${label}</div>
      <button class="dep-watch-btn${watched?' watched':''}" data-watch="${eid}"
              ${isFuture?'disabled title="Odcinek jeszcze nie wyszedł"':''}
              onclick="handleWatchToggle('${series.id}','${dateStr}',event)">
        <svg width="14" height="14"><use href="#ic-check"/></svg>
      </button>
    </div>`;
  }).join('');
}

async function markAllWatchedForSeries(id) {
  const series = S.series.find(s => s.id === id);
  if (!series) return;
  const todayStr = today();
  const since    = series.trackingSince || toDateStr(addDays(new Date(), -90));
  const dates    = generateEpisodeDates(series, since, todayStr);
  let   count    = 0;
  for (const dateStr of dates) {
    if (dateStr >= todayStr) continue;
    const eid = episodeId(id, dateStr);
    if (!S.episodes[eid]?.watched) {
      await toggleWatched(id, dateStr);
      count++;
    }
  }
  renderDetailEpisodes(series);
  refreshDetailStats();
  renderSeriesList();
  renderDay(S.selectedDay);
  showToast(`Oznaczono ${count} odcinków jako obejrzane`);
}

/* ─────────────────────────────────────────────────────────────────────
   9. WATCHLIST RENDERING
   ───────────────────────────────────────────────────────────────────── */

function renderWatchlist() {
  const grid  = document.getElementById('wl-grid');
  const empty = document.getElementById('wl-empty');
  document.getElementById('wl-count').textContent = `${S.watchlist.length} ${S.watchlist.length === 1 ? 'tytuł' : 'tytułów'}`;

  if (!S.watchlist.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const today = new Date();

  const cards = S.watchlist.map(item => {
    const plat   = getPlatform(item.platform);
    const cover  = item.cover ? `background-image:url(${item.cover})` : `background:${PLATFORM_GRADIENTS[item.platform]||PLATFORM_GRADIENTS.other}`;
    const releaseTag = releaseTagHTML(item.releaseDate, today);

    return `<div class="wlcard" onclick="openWlDetail('${item.id}')">
      <div class="wlthumb">
        <div class="wlthumb-bg" style="${cover};background-size:cover;background-position:center"></div>
        <div class="wlplay"><svg><use href="#ic-play"/></svg></div>
        ${releaseTag}
      </div>
      <div class="wlinfo">
        <div class="wltitle">${item.title}</div>
        <div class="wlsub">${plat.name}${item.season ? ` · S${String(item.season).padStart(2,'0')}` : ''}</div>
      </div>
    </div>`;
  }).join('');

  const addBtn = `<button class="wl-add" onclick="openWlModal()">
    <svg width="22" height="22"><use href="#ic-plus"/></svg>
    <span>Dodaj tytuł</span>
  </button>`;

  grid.innerHTML = cards + addBtn;
}

function releaseTagHTML(releaseDate, today) {
  if (!releaseDate) return `<span class="rtag tba">TBA</span>`;
  const d = toDate(releaseDate);
  const diffMs = d - today;
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return `<span class="rtag later">Dostępne</span>`;
  if (diffDays <= 90) return `<span class="rtag soon">${formatDatePL(releaseDate)}</span>`;
  const y = d.getFullYear();
  return `<span class="rtag later">${y}</span>`;
}

function openWlDetail(id) {
  // Simple: open the edit modal for watchlist
  openWlModal(id);
}

/* ─────────────────────────────────────────────────────────────────────
   10. ADD / EDIT SERIES MODAL
   ───────────────────────────────────────────────────────────────────── */

function openSeriesModal(id = null) {
  S.editId   = id;
  S.coverB64 = null;
  S.tmdbId   = null;

  const overlay = document.getElementById('overlay-series');
  const title   = document.getElementById('modal-series-title');

  // Build platform pills
  buildPlatformPills('pplats', 'netflix');
  // Build day buttons
  buildDayButtons('day-btns', []);
  // Build manual dates
  document.getElementById('manual-dates-list').innerHTML = '';

  if (id) {
    // Edit mode
    const series = S.series.find(s => s.id === id);
    if (!series) return;
    title.textContent = 'Edytuj serial';
    document.getElementById('edit-series-id').value = id;
    document.getElementById('inp-title').value       = series.title;
    document.getElementById('inp-time').value        = series.time || '21:00';
    document.getElementById('inp-season').value      = series.startSeason || 1;
    document.getElementById('inp-start-ep').value    = series.startEpisode || 1;
    document.getElementById('inp-eps-per-season').value = series.episodesPerSeason || 10;
    document.getElementById('inp-release-count').value  = series.releaseCount || 1;
    document.getElementById('inp-tracking-since').value = series.trackingSince || today();
    setToggle('toggle-notify', series.notify !== false);
    S.coverB64 = series.cover || null;
    S.tmdbId   = series.tmdbId || null;
    buildPlatformPills('pplats', series.platform);
    if (series.schedule) {
      setSchedType(series.schedule.type);
      if (series.schedule.type === 'weekly') buildDayButtons('day-btns', series.schedule.days||[]);
      if (series.schedule.type === 'interval') document.getElementById('inp-interval').value = series.schedule.interval||3;
      if (series.schedule.type === 'manual') {
        (series.schedule.dates||[]).forEach(d => addManualDateRow(d));
      }
    }
    if (series.cover) showCoverPreview(series.cover);
  } else {
    title.textContent = 'Dodaj serial';
    document.getElementById('edit-series-id').value = '';
    document.getElementById('inp-title').value = '';
    document.getElementById('inp-time').value  = '21:00';
    document.getElementById('inp-season').value = 1;
    document.getElementById('inp-start-ep').value = 1;
    document.getElementById('inp-eps-per-season').value = 10;
    document.getElementById('inp-release-count').value  = 1;
    document.getElementById('inp-tracking-since').value = today();
    setToggle('toggle-notify', true);
    setSchedType('weekly');
    buildDayButtons('day-btns', []);
    hideCoverPreview();
  }

  document.getElementById('tmdb-results').hidden = true;

  openOverlay('overlay-series');
}

async function saveSeriesModal() {
  const id      = document.getElementById('edit-series-id').value;
  const title   = document.getElementById('inp-title').value.trim();
  if (!title) { showToast('Wpisz tytuł serialu'); return; }

  const platform  = document.querySelector('#pplats .ppill.sel')?.dataset.key || 'other';
  const schedType = document.querySelector('#sched-tabs .stab.active')?.dataset.type || 'weekly';
  const time      = document.getElementById('inp-time').value || '21:00';
  const notify    = document.getElementById('toggle-notify').getAttribute('aria-checked') === 'true';

  let schedule = { type: schedType };
  if (schedType === 'weekly') {
    schedule.days = [...document.querySelectorAll('#day-btns .dbtn.sel')].map(b => Number(b.dataset.day));
  } else if (schedType === 'interval') {
    schedule.interval = parseInt(document.getElementById('inp-interval').value) || 3;
    if (id) schedule.lastEpisodeDate = S.series.find(s=>s.id===id)?.schedule?.lastEpisodeDate || null;
  } else if (schedType === 'manual') {
    schedule.dates = [...document.querySelectorAll('.manual-date-input')].map(i=>i.value).filter(Boolean);
  }

  const series = {
    id:              id || uid(),
    title,
    platform,
    schedule,
    time,
    notify,
    startSeason:     parseInt(document.getElementById('inp-season').value) || 1,
    startEpisode:    parseInt(document.getElementById('inp-start-ep').value) || 1,
    episodesPerSeason: Math.max(1, parseInt(document.getElementById('inp-eps-per-season').value) || 10),
    releaseCount:      Math.max(1, parseInt(document.getElementById('inp-release-count').value) || 1),
    trackingSince:   document.getElementById('inp-tracking-since').value || today(),
    cover:           S.coverB64,
    tmdbId:          S.tmdbId,
    createdAt:       id ? (S.series.find(s=>s.id===id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
  };

  await DB.put('series', series);
  if (id) {
    const idx = S.series.findIndex(s => s.id === id);
    if (idx !== -1) S.series[idx] = series; else S.series.push(series);
  } else {
    S.series.push(series);
  }

  closeOverlay('overlay-series');
  renderCalendar();
  renderSeriesList();
  renderWatchlist();
  showToast(id ? `"${title}" zaktualizowany` : `"${title}" dodany do kalendarza`);
}

function confirmDeleteSeries(id) {
  const series = S.series.find(s => s.id === id);
  if (!series) return;
  document.getElementById('confirm-title').textContent = 'Usuń serial?';
  document.getElementById('confirm-msg').textContent   = `Usuniesz "${series.title}" i wszystkie wpisy oglądania. Tej operacji nie można cofnąć.`;
  S.pendingConfirmFn = () => deleteSeries(id);
  openOverlay('overlay-confirm');
}

async function deleteSeries(id) {
  await DB.del('series', id);
  // Delete all episode records for this series
  const epRecs = await DB.getByIndex('episodes','seriesId', id);
  for (const ep of epRecs) {
    await DB.del('episodes', ep.id);
    delete S.episodes[ep.id];
  }
  S.series = S.series.filter(s => s.id !== id);
  closeDetail();
  closeOverlay('overlay-confirm');
  renderCalendar();
  renderSeriesList();
  showToast('Serial usunięty');
}

/* ─────────────────────────────────────────────────────────────────────
   11. WATCHLIST MODAL
   ───────────────────────────────────────────────────────────────────── */

function openWlModal(id = null) {
  buildPlatformPills('wl-pplats', 'other');
  document.getElementById('wl-title').value   = '';
  document.getElementById('wl-season').value  = '1';
  document.getElementById('wl-release').value = '';
  document.getElementById('wl-notes').value   = '';
  document.getElementById('wl-tmdb-results').hidden = true;

  if (id) {
    const item = S.watchlist.find(w => w.id === id);
    if (item) {
      document.getElementById('wl-title').value   = item.title;
      document.getElementById('wl-season').value  = item.season || 1;
      document.getElementById('wl-release').value = item.releaseDate || '';
      document.getElementById('wl-notes').value   = item.notes || '';
      buildPlatformPills('wl-pplats', item.platform);
      document.getElementById('btn-save-wl').dataset.editId = id;
    }
  } else {
    delete document.getElementById('btn-save-wl').dataset.editId;
  }
  openOverlay('overlay-wl');
}

async function saveWlModal() {
  const title = document.getElementById('wl-title').value.trim();
  if (!title) { showToast('Wpisz tytuł'); return; }
  const editId   = document.getElementById('btn-save-wl').dataset.editId || null;
  const platform = document.querySelector('#wl-pplats .ppill.sel')?.dataset.key || 'other';

  const item = {
    id:          editId || uid(),
    title,
    platform,
    season:      parseInt(document.getElementById('wl-season').value) || null,
    releaseDate: document.getElementById('wl-release').value || null,
    notes:       document.getElementById('wl-notes').value.trim(),
    cover:       null,
    tmdbId:      null,
    createdAt:   editId ? (S.watchlist.find(w=>w.id===editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
  };

  await DB.put('watchlist', item);
  if (editId) {
    const idx = S.watchlist.findIndex(w => w.id === editId);
    if (idx !== -1) S.watchlist[idx] = item; else S.watchlist.push(item);
  } else {
    S.watchlist.push(item);
  }
  closeOverlay('overlay-wl');
  renderWatchlist();
  showToast(`"${title}" dodane do listy`);
}

/* ─────────────────────────────────────────────────────────────────────
   12. TMDB INTEGRATION
   ───────────────────────────────────────────────────────────────────── */

async function searchTMDB(query, resultContainerId) {
  const container = document.getElementById(resultContainerId);
  if (!query.trim()) { container.hidden = true; return; }

  container.innerHTML = '<div style="padding:8px;color:var(--tm);font-size:12px"><span class="spinner"></span> Szukam w TMDB…</div>';
  container.hidden = false;

  try {
    let data = null;

    // --- Próba 1: Cloudflare Worker (serwer z TMDB_API_KEY) ---
    try {
      const res = await fetch(`/api/tmdb-search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!json.error && json.results) {
        data = json;
      }
    } catch { /* Worker niedostępny – próbujemy bezpośrednio */ }

    // --- Próba 2: bezpośrednie API z kluczem z Ustawień ---
    if (!data && S.settings.tmdbKey) {
      const apiRes = await fetch(
        `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=pl-PL&page=1`,
        { headers: { 'Authorization': `Bearer ${S.settings.tmdbKey}`, 'Accept': 'application/json' } }
      );
      if (apiRes.ok) {
        const json = await apiRes.json();
        data = { results: json.results?.slice(0, 8) || [] };
      }
    }

    // --- Brak klucza / błąd ---
    if (!data) {
      container.innerHTML = `<p style="padding:8px;color:var(--warn);font-size:12px">
        Brak klucza TMDB. Dodaj <strong>API Read Access Token</strong> w
        <a href="#" onclick="openSettings();return false;" style="color:var(--a)">Ustawieniach</a>.
      </p>`;
      return;
    }

    if (!data.results?.length) {
      container.innerHTML = '<p style="padding:8px;color:var(--td);font-size:12px">Brak wyników.</p>';
      return;
    }

    container.innerHTML = data.results.slice(0, 6).map(r => {
      const thumb = r.poster_path
        ? `<img src="https://image.tmdb.org/t/p/w200${r.poster_path}" alt="${r.name}" loading="lazy">`
        : `<div class="tmr-thumb-bg" style="background:var(--card)"></div>`;
      return `<div class="tmr" data-tmdb-id="${r.id}" data-title="${escapeAttr(r.name)}"
                   data-poster="${r.poster_path||''}"
                   onclick="pickTMDB(this,'${resultContainerId}')">
        <div class="tmr-thumb">${thumb}</div>
        <div class="tmr-name">${r.name}</div>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p style="padding:8px;color:var(--td);font-size:12px">Błąd TMDB — sprawdź połączenie.</p>';
  }
}

async function pickTMDB(el, containerId) {
  el.closest('.tmdb-results').querySelectorAll('.tmr').forEach(t => t.classList.remove('sel'));
  el.classList.add('sel');

  const title   = el.dataset.title;
  const tmdbId  = Number(el.dataset.tmdbId);
  const poster  = el.dataset.poster;

  // Set title in the nearest input
  const modal = el.closest('.modal');
  const inp   = modal.querySelector('.fi[id^="inp-title"], .fi[id^="wl-title"]');
  if (inp) inp.value = title;

  S.tmdbId = tmdbId;

  if (poster) {
    // Fetch poster as base64 to store locally
    try {
      const imgRes  = await fetch(`https://image.tmdb.org/t/p/w300${poster}`);
      const blob    = await imgRes.blob();
      const b64     = await blobToBase64(blob);
      S.coverB64    = b64;
      showCoverPreview(b64);
    } catch {
      // Poster load failed, skip
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   13. PUSH NOTIFICATIONS
   ───────────────────────────────────────────────────────────────────── */

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Twoja przeglądarka nie obsługuje push notifications');
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    showToast('Brak zgody na powiadomienia');
    return;
  }

  const vapidKey = S.settings.vapidKey || '';
  if (!vapidKey) {
    showToast('Brak VAPID Public Key — skonfiguruj w Ustawieniach');
    return;
  }

  try {
    const reg  = await navigator.serviceWorker.ready;
    const sub  = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await fetch('/api/push-subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription: sub }),
    });
    S.settings.pushEnabled = true;
    await DB.put('settings', { key: 'pushEnabled', value: true });
    setToggle('toggle-push-global', true);
    document.getElementById('push-status-label').textContent = 'Włączone';
    showToast('Push notifications włączone!');
  } catch (e) {
    showToast('Błąd subskrypcji push: ' + e.message);
  }
}

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function renderNotifPanel() {
  const todayStr = today();
  const now      = new Date();
  const items    = [];

  S.series.forEach(series => {
    if (!series.notify) return;
    const dates = generateEpisodeDates(series, todayStr, toDateStr(addDays(now, 7)));
    dates.forEach(dateStr => {
      const [h, m] = series.time.split(':').map(Number);
      const airing = new Date(toDate(dateStr)); airing.setHours(h, m, 0, 0);
      const diffMs = airing - now;
      items.push({ series, dateStr, airing, diffMs, label: getEpisodeLabel(series, dateStr) });
    });
  });

  items.sort((a, b) => a.diffMs - b.diffMs);

  const pip  = document.getElementById('notif-pip');
  const list = document.getElementById('notif-list');

  if (!items.length) {
    pip.hidden = true;
    list.innerHTML = '<p class="np-empty">Brak nadchodzących odcinków.</p>';
    return;
  }

  pip.hidden = false;
  list.innerHTML = items.slice(0, 5).map(item => {
    const plat  = getPlatform(item.series.platform);
    const when  = formatWhen(item.diffMs);
    return `<div class="ni2">
      <div class="niico" style="background:${plat.color}22">
        <svg width="15" height="15" style="color:${plat.color}"><use href="#ic-${item.series.platform==='youtube'?'yt':'tv'}"/></svg>
      </div>
      <div class="nibody">
        <div class="nititle">${item.series.title} ${item.label}</div>
        <div class="nisub">${plat.name} · ${(()=>{const d=Math.round((new Date(item.dateStr)-new Date(todayStr))/86400000);return d===0?'dziś':d===1?'jutro':`za ${d} dni`;})()}&nbsp;${item.series.time}</div>
      </div>
      <div class="nitime">${when}</div>
    </div>`;
  }).join('');
}

function formatWhen(diffMs) {
  if (diffMs < 0) return 'trwa';
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  if (h < 1) return `za ${m}min`;
  if (h < 24) return `za ${h}h`;
  const d = Math.floor(h / 24);
  return `za ${d} ${d===1?'dzień':'dni'}`;
}

/* ─────────────────────────────────────────────────────────────────────
   14. SETTINGS
   ───────────────────────────────────────────────────────────────────── */

async function loadSettings() {
  const vapid  = await DB.get('settings','vapidKey');
  const tmdb   = await DB.get('settings','tmdbKey');
  const pushEn = await DB.get('settings','pushEnabled');
  S.settings.vapidKey     = vapid?.value  || '';
  S.settings.tmdbKey      = tmdb?.value   || '';
  S.settings.pushEnabled  = !!pushEn?.value;
}

async function saveSettings() {
  const vapid = document.getElementById('inp-vapid-key').value.trim();
  const tmdb  = document.getElementById('inp-tmdb-key').value.trim();
  S.settings.vapidKey  = vapid;
  S.settings.tmdbKey   = tmdb;
  await DB.put('settings', { key: 'vapidKey',  value: vapid });
  await DB.put('settings', { key: 'tmdbKey',   value: tmdb  });
  closeOverlay('overlay-settings');
  showToast('Ustawienia zapisane');
}

function openSettings() {
  document.getElementById('inp-vapid-key').value = S.settings.vapidKey;
  document.getElementById('inp-tmdb-key').value  = S.settings.tmdbKey;
  setToggle('toggle-push-global', S.settings.pushEnabled);
  document.getElementById('push-status-label').textContent = S.settings.pushEnabled ? 'Włączone' : 'Wyłączone';
  openOverlay('overlay-settings');
}

/* ─────────────────────────────────────────────────────────────────────
   15. UI HELPERS
   ───────────────────────────────────────────────────────────────────── */

function switchTab(tab) {
  S.currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${tab}`));
  document.querySelectorAll('.ni').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.getElementById('fab').style.display = tab === 'watchlist' ? 'none' : 'flex';
}

function openOverlay(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  el.setAttribute('aria-hidden','false');
}

function closeOverlay(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.setAttribute('aria-hidden','true');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getPlatform(key) {
  return PLATFORMS.find(p => p.key === key) || PLATFORMS.find(p => p.key === 'other');
}

function escapeAttr(str) {
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

function buildPlatformPills(containerId, selected) {
  const el = document.getElementById(containerId);
  el.innerHTML = PLATFORMS.map(p =>
    `<button class="ppill${p.key===selected?' sel':''}" type="button"
             data-key="${p.key}"
             style="${p.key===selected?`background:${p.color};color:#fff;border-color:transparent`:''}"
             onclick="selectPlatform(this,'${containerId}')">
      ${p.key==='youtube'?`<svg width="10" height="10" style="color:${p.key===selected?'#fff':p.color}"><use href="#ic-yt"/></svg>`:''}${p.name}
    </button>`
  ).join('');
}

function selectPlatform(el, containerId) {
  el.closest('.pplats').querySelectorAll('.ppill').forEach(p => {
    p.classList.remove('sel');
    p.style.cssText = '';
  });
  el.classList.add('sel');
  const plat = getPlatform(el.dataset.key);
  el.style.background    = plat.color;
  el.style.color         = '#fff';
  el.style.borderColor   = 'transparent';

  // Auto-switch schedule type for YouTube
  if (el.dataset.key === 'youtube') {
    setSchedType('interval');
    document.getElementById('inp-time').value = '12:00';
  }
}

function buildDayButtons(containerId, selected = []) {
  const el = document.getElementById(containerId);
  el.innerHTML = DAYS_PL.map((d, i) =>
    `<button class="dbtn${selected.includes(i)?' sel':''}" type="button" data-day="${i}" onclick="this.classList.toggle('sel')">${d}</button>`
  ).join('');
}

function setSchedType(type) {
  document.querySelectorAll('#sched-tabs .stab').forEach(t => t.classList.toggle('active', t.dataset.type === type));
  document.querySelectorAll('.spanel').forEach(p => p.classList.toggle('active', p.id === `sp-${type}`));
}

function setToggle(id, val) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('aria-checked', val ? 'true' : 'false');
}

function addManualDateRow(val = '') {
  const div = document.createElement('div');
  div.className = 'manual-date-row';
  div.innerHTML = `<input class="fi manual-date-input" type="date" value="${val}">
    <button type="button" class="btn-remove-date" onclick="this.parentElement.remove()">
      <svg width="12" height="12"><use href="#ic-x"/></svg>
    </button>`;
  document.getElementById('manual-dates-list').appendChild(div);
}

function showCoverPreview(src) {
  document.getElementById('cover-preview-img').src = src;
  document.getElementById('cover-preview').hidden  = false;
  document.getElementById('upzone').style.display  = 'none';
}

function hideCoverPreview() {
  document.getElementById('cover-preview').hidden = true;
  document.getElementById('upzone').style.display = '';
  S.coverB64 = null;
}

/* ─────────────────────────────────────────────────────────────────────
   16. EVENT WIRING
   ───────────────────────────────────────────────────────────────────── */

function wireEvents() {
  // Bottom nav
  document.querySelectorAll('.ni').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // FAB
  document.getElementById('fab').addEventListener('click', () => {
    if (S.currentTab === 'watchlist') openWlModal();
    else openSeriesModal();
  });

  // Week navigation
  document.getElementById('btn-prev-week').addEventListener('click', () => { S.weekOffset--; S.selectedDay = null; renderCalendar(); });
  document.getElementById('btn-next-week').addEventListener('click', () => { S.weekOffset++; S.selectedDay = null; renderCalendar(); });

  // Day strip (delegated)
  document.getElementById('day-strip').addEventListener('click', e => {
    const pill = e.target.closest('.dpill');
    if (!pill) return;
    renderDay(toDate(pill.dataset.date));
  });

  // Notification bell
  document.getElementById('btn-notif').addEventListener('click', () => {
    document.getElementById('notif-panel').classList.toggle('open');
  });
  document.getElementById('btn-close-notif').addEventListener('click', () => {
    document.getElementById('notif-panel').classList.remove('open');
  });

  // Settings
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

  // Close overlays on background click
  ['overlay-series','overlay-wl','overlay-confirm','overlay-settings'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === document.getElementById(id)) closeOverlay(id);
    });
  });

  // Save series
  document.getElementById('btn-save-series').addEventListener('click', saveSeriesModal);
  document.getElementById('btn-series-add-first').addEventListener('click', () => openSeriesModal());

  // Schedule tabs
  document.querySelectorAll('#sched-tabs .stab').forEach(btn => {
    btn.addEventListener('click', () => setSchedType(btn.dataset.type));
  });

  // Notification toggle
  document.getElementById('toggle-notify').addEventListener('click', function() {
    const cur = this.getAttribute('aria-checked') === 'true';
    setToggle('toggle-notify', !cur);
  });

  // Save watchlist
  document.getElementById('btn-save-wl').addEventListener('click', saveWlModal);
  document.getElementById('btn-wl-add-first').addEventListener('click', openWlModal);
  // wl-add button is rendered dynamically in renderWatchlist()

  // Confirm dialog
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => closeOverlay('overlay-confirm'));
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    if (S.pendingConfirmFn) { S.pendingConfirmFn(); S.pendingConfirmFn = null; }
    closeOverlay('overlay-confirm');
  });

  // Detail back
  document.getElementById('btn-detail-back').addEventListener('click', closeDetail);

  // Mark all backlog
  document.getElementById('btn-mark-all-watched').addEventListener('click', () => {
    if (S.detailId) markAllWatchedForSeries(S.detailId);
  });

  // Cover upload
  document.getElementById('upzone').addEventListener('click', () => document.getElementById('inp-cover').click());
  document.getElementById('inp-cover').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Plik za duży — max 2 MB'); return; }
    const b64   = await blobToBase64(file);
    S.coverB64  = b64;
    showCoverPreview(b64);
  });
  document.getElementById('btn-cover-remove').addEventListener('click', hideCoverPreview);

  // TMDB search (series modal) - debounced
  let tmdbTimer;
  document.getElementById('inp-title').addEventListener('input', e => {
    clearTimeout(tmdbTimer);
    tmdbTimer = setTimeout(() => searchTMDB(e.target.value, 'tmdb-results'), 600);
  });
  document.getElementById('btn-tmdb-search').addEventListener('click', () => {
    const q = document.getElementById('inp-title').value;
    searchTMDB(q, 'tmdb-results');
  });

  // TMDB search (watchlist modal)
  let tmdbTimerWl;
  document.getElementById('wl-title').addEventListener('input', e => {
    clearTimeout(tmdbTimerWl);
    tmdbTimerWl = setTimeout(() => searchTMDB(e.target.value, 'wl-tmdb-results'), 600);
  });
  document.getElementById('btn-wl-tmdb').addEventListener('click', () => {
    searchTMDB(document.getElementById('wl-title').value, 'wl-tmdb-results');
  });

  // Add manual date
  document.getElementById('btn-add-date').addEventListener('click', () => addManualDateRow());

  // Push enable
  document.getElementById('btn-enable-push').addEventListener('click', enablePush);
  document.getElementById('toggle-push-global').addEventListener('click', () => {
    if (S.settings.pushEnabled) {
      S.settings.pushEnabled = false;
      setToggle('toggle-push-global', false);
      document.getElementById('push-status-label').textContent = 'Wyłączone';
    } else {
      enablePush();
    }
  });

  // Close notif panel when clicking outside
  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    const btn   = document.getElementById('btn-notif');
    if (panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  // Keyboard nav (Escape closes overlays/detail)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('detail-overlay').classList.contains('open')) { closeDetail(); return; }
    ['overlay-settings','overlay-confirm','overlay-wl','overlay-series'].forEach(id => closeOverlay(id));
  });
}

/* ─────────────────────────────────────────────────────────────────────
   17. SERVICE WORKER REGISTRATION
   ───────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────
   17. SERVICE WORKER + PWA INSTALL
   ───────────────────────────────────────────────────────────────────── */

let _swReg        = null;
let _swWaiting    = null;
let _installPrompt = null;  // Android beforeinstallprompt

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    _swReg = await navigator.serviceWorker.register('/sw.js');

    // Jeśli nowy SW czeka już teraz
    if (_swReg.waiting) { _swWaiting = _swReg.waiting; showUpdateBar(); }

    // Nowy SW zainstalowany podczas sesji
    _swReg.addEventListener('updatefound', () => {
      const nw = _swReg.installing;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          _swWaiting = nw;
          showUpdateBar();
        }
      });
    });

    // Gdy SW przejmie kontrolę → przeładuj stronę
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  } catch (e) {
    console.warn('SW registration failed:', e);
  }
}

function showUpdateBar() {
  document.getElementById('update-bar')?.classList.add('show');
}

function applyUpdate() {
  if (_swWaiting) {
    _swWaiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

// ── iOS pinch-zoom + scroll prevention ──────────────────────────────
function initZoomPrevention() {
  // gesturestart/change — Safari legacy pinch-zoom block
  document.addEventListener('gesturestart',  e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });

  // iOS czasem przesuwa window.scrollY mimo body{overflow:hidden} gdy focus na input
  // Reset do 0 przy każdej próbie scrolla — identycznie jak SolidOffer
  window.addEventListener('scroll', () => {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  }, { passive: true });

  // Reset po opuszczeniu inputa (keyboard hide)
  document.addEventListener('focusout', () => {
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, true);
}

// ── PWA Install Banner ───────────────────────────────────────────────
function initInstallBanner() {
  // Jeśli już uruchomione jako PWA — nie pokazuj
  const standalone = window.navigator.standalone === true ||
                     matchMedia('(display-mode: standalone)').matches ||
                     matchMedia('(display-mode: fullscreen)').matches;
  if (standalone) return;
  if (localStorage.getItem('serialist_install_dismissed')) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    setTimeout(() => {
      document.getElementById('ios-banner')?.classList.add('show');
    }, 3000);
  }

  // Android / Chrome Desktop: native prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _installPrompt = e;
    document.getElementById('android-banner')?.classList.add('show');
  });

  window.addEventListener('appinstalled', () => {
    document.getElementById('android-banner')?.classList.remove('show');
    _installPrompt = null;
    localStorage.setItem('serialist_install_dismissed', '1');
    showToast('✅ Serialist zainstalowany!');
  });
}

function androidInstall() {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  _installPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') {
      document.getElementById('android-banner')?.classList.remove('show');
      _installPrompt = null;
    }
  });
}

function dismissInstallBanner() {
  document.getElementById('ios-banner')?.classList.remove('show');
  document.getElementById('android-banner')?.classList.remove('show');
  localStorage.setItem('serialist_install_dismissed', '1');
}

// ── Data Export / Import ─────────────────────────────────────────────
async function exportData() {
  const [series, watchlist, episodes] = await Promise.all([
    DB.getAll('series'), DB.getAll('watchlist'), DB.getAll('episodes'),
  ]);
  const blob = new Blob(
    [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), series, watchlist, episodes }, null, 2)],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `serialist-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📦 Eksport gotowy!');
}

async function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.series || !Array.isArray(data.series)) throw new Error('Nieprawidłowy format');

      // Zapisz do IDB
      await Promise.all([
        ...data.series.map(s => DB.put('series', s)),
        ...(data.watchlist || []).map(w => DB.put('watchlist', w)),
        ...(data.episodes  || []).map(e => DB.put('episodes',  e)),
      ]);

      // Odśwież stan
      S.series    = await DB.getAll('series');
      S.watchlist = await DB.getAll('watchlist');
      const eps   = await DB.getAll('episodes');
      eps.forEach(ep => { S.episodes[ep.id] = ep; });

      renderCalendar(); renderSeriesList(); renderWatchlist();
      showToast(`✅ Zaimportowano ${data.series.length} seriali`);
    } catch (err) {
      showToast('❌ Błąd importu: ' + err.message);
    }
  };
  input.click();
}

/* ─────────────────────────────────────────────────────────────────────
   18. INIT
   ───────────────────────────────────────────────────────────────────── */

async function init() {
  // Load all data
  const [series, watchlist, episodes] = await Promise.all([
    DB.getAll('series'),
    DB.getAll('watchlist'),
    DB.getAll('episodes'),
  ]);

  S.series    = series;
  S.watchlist = watchlist;
  episodes.forEach(ep => { S.episodes[ep.id] = ep; });

  await loadSettings();

  // Wire all events
  wireEvents();

  // Initial render
  renderCalendar();
  renderSeriesList();
  renderWatchlist();
  renderNotifPanel();

  // Register service worker + PWA features
  registerSW();
  initZoomPrevention();
  initInstallBanner();
}

document.addEventListener('DOMContentLoaded', init);
