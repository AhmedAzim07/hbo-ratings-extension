// ============================================================
//  HBO Ratings Overlay — content.js v1
//  Triggered on HBO Max title detail pages (show/movie hero)
//  Pill injected in the hero section, in the circled empty
//  space between the action-buttons row and the episode/synopsis text
// ============================================================

// OMDB_KEY is injected from config.js (loaded before this script in manifest.json)
// Copy config.example.js → config.js and add your key there

let lastKey     = null;   // fingerprint of "which title, which URL" we last handled
let currentPill = null;   // the injected pill element
const cache     = new Map();

// ─── SELECTORS ───────────────────────────────────────────────

const HERO_SEL = '[data-testid="details-hero-container"]';

// Visible labels on the buttons that sit right above the circled gap.
// Matching on label text (rather than the hashed "Fuse-Web-Play__sc-xxxx"
// class names) is what survives HBO Max's next CSS rebuild.
const ACTION_LABELS = ['My List', 'Add to My List', 'Remove from List', 'Rate', 'Trailer', 'Watch Trailer'];

// ─── TITLE EXTRACTION ────────────────────────────────────────
//
//  HBO Max sets the show/movie name as the accessible name on the
//  page's <main> — e.g. <main aria-label="Game of Thrones"> — even
//  while a specific episode's synopsis is on screen. That's a much
//  more stable hook than scraping the stylised title-logo graphic,
//  so it's strategy #1. document.title (kept in sync by react-helmet
//  on every route change) is the universal fallback.

function extractTitle(hero) {
  const main = document.querySelector('main[aria-label]');
  const mainLabel = main?.getAttribute('aria-label')?.trim();
  if (mainLabel && mainLabel.length > 1 && mainLabel.length < 100) {
    console.log('[HR] Title from main[aria-label]:', mainLabel);
    return mainLabel;
  }

  const raw = document.title?.trim();
  if (raw) {
    const cleaned = raw.replace(/\s*[|\-–]\s*(HBO Max|Max|HBO)\s*$/i, '').trim();
    if (cleaned) {
      console.log('[HR] Title from document.title:', cleaned);
      return cleaned;
    }
  }

  const heading = hero.querySelector('h1, [role="heading"]');
  const headingText = heading?.textContent?.trim();
  if (headingText) {
    console.log('[HR] Title from heading fallback:', headingText);
    return headingText;
  }

  console.warn('[HR] Could not extract title — inspect the hero DOM with DevTools.');
  return null;
}

// ─── OMDB API ────────────────────────────────────────────────
// same lookup chain as the Netflix build: exact → strip subtitle → search fallback

async function omdb(params) {
  const r = await fetch(`https://www.omdbapi.com/?${params}&apikey=${OMDB_KEY}`);
  return r.json();
}

async function getRatings(title) {
  if (cache.has(title)) return cache.get(title);

  let data = await omdb(`t=${encodeURIComponent(title)}`);

  if (data.Response !== 'True') {
    const noColon = title.replace(/\s*:.*$/, '').trim();
    if (noColon && noColon !== title) data = await omdb(`t=${encodeURIComponent(noColon)}`);
  }

  if (data.Response !== 'True') {
    const s = await omdb(`s=${encodeURIComponent(title)}`);
    if (s.Response === 'True' && s.Search?.length) {
      data = await omdb(`i=${s.Search[0].imdbID}`);
    }
  }

  cache.set(title, data);
  return data;
}

// ─── PILL ────────────────────────────────────────────────────

const esc = s => {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

function makePill(title) {
  const p = document.createElement('div');
  p.id = 'hr-pill';
  p.innerHTML = `
    <span class="hr-pname">${esc(title)}</span>
    <span class="hr-pdot">·</span>
    <span class="hr-pscore">⭐ …</span>
    <span class="hr-pdot">·</span>
    <span class="hr-pscore">🍅 …</span>
  `;
  return p;
}

function fillPill(pill, imdb, rt) {
  const scores = pill.querySelectorAll('.hr-pscore');
  if (scores[0]) scores[0].textContent = `⭐ ${imdb}`;
  if (scores[1]) scores[1].textContent = `🍅 ${rt}`;
  pill.classList.remove('hr-loading');
}

function removePill() {
  document.getElementById('hr-pill')?.remove();
  currentPill = null;
}

// ─── INJECTION ───────────────────────────────────────────────
//
//  Target: the empty gap directly below the My List / Rate /
//  Trailer row, above the episode heading + synopsis — the
//  circled area in the reference screenshot.
//
//  We find that row by its visible button labels, take the
//  closest shared ancestor of those buttons as "the row", and
//  insert right after it.

function matchesActionLabel(el) {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const aria = (el.getAttribute('aria-label') || '').trim();
  return ACTION_LABELS.some(l => text === l || aria === l || text.startsWith(l) || aria.startsWith(l));
}

function findActionsRow(hero) {
  const found = [];
  for (const el of hero.querySelectorAll('button, a, [role="button"]')) {
    if (matchesActionLabel(el)) found.push(el);
  }
  if (found.length < 2) return null; // need 2+ buttons to triangulate a shared row

  let ancestor = found[0];
  while (ancestor && ancestor !== hero) {
    if (found.every(el => ancestor.contains(el))) return ancestor;
    ancestor = ancestor.parentElement;
  }
  return null;
}

function inject(hero, title) {
  removePill();
  if (document.getElementById('hr-pill')) return currentPill;

  const pill = makePill(title);
  pill.classList.add('hr-loading');

  let injected = false;

  // Primary: right after the My List / Rate / Trailer row
  const row = findActionsRow(hero);
  if (row) {
    row.after(pill);
    injected = true;
    console.log('[HR] Pill injected after actions row');
  }

  // Fallback: right after the primary Watch button's row
  if (!injected) {
    const playBtn = [...hero.querySelectorAll('button, a')].find(el => {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
      return /^watch\b/i.test(label) || /^play\b/i.test(label);
    });
    const playRow = playBtn?.parentElement;
    if (playRow) {
      playRow.after(pill);
      injected = true;
      console.log('[HR] Pill injected after Watch button row (fallback)');
    }
  }

  // Last resort: top of the hero container
  if (!injected) {
    hero.prepend(pill);
    console.log('[HR] Pill prepended to hero container (fallback)');
  }

  currentPill = pill;
  return pill;
}

// ─── MAIN FLOW ───────────────────────────────────────────────

function pageKey() {
  const hero = document.querySelector(HERO_SEL);
  if (!hero) return null;
  const title = extractTitle(hero);
  return title ? `${location.pathname}::${title}` : null;
}

// The full-screen player renders into this layer (named for exactly
// that in HBO Max's own DOM — see #layer-root-player-screen in
// DevTools). If it's populated, playback has taken over and the
// pill should disappear. We check this specific layer rather than
// "is any <video> tag playing" because the hero itself autoplays a
// muted background preview — a generic video check would kill the
// pill the instant that preview clip starts.
function isPlayerActive() {
  const layer = document.getElementById('layer-root-player-screen');
  return !!(layer && layer.childElementCount > 0);
}

async function handlePageReady(expectedKey) {
  if (pageKey() !== expectedKey) return; // state moved on again during our delay

  const hero = document.querySelector(HERO_SEL);
  if (!hero) return;
  const title = extractTitle(hero);
  if (!title) return;

  const pill = inject(hero, title);
  if (!pill) return;

  try {
    const data = await getRatings(title);
    if (data.Response === 'True') {
      const imdb = data.imdbRating ?? 'N/A';
      const rt   = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value ?? 'N/A';
      fillPill(pill, imdb, rt);
    } else {
      fillPill(pill, 'N/A', 'N/A');
    }
  } catch (e) {
    console.error('[HR] Fetch error:', e);
    fillPill(pill, '—', '—');
  }
}

function checkState() {
  if (isPlayerActive()) {
    if (currentPill) removePill();
    lastKey = null;
    return;
  }

  const key = pageKey();
  if (key === lastKey) return;
  lastKey = key;

  if (!key) {
    removePill();
    return;
  }

  // Give the SPA a beat to finish rendering the action row before we anchor to it
  setTimeout(() => handlePageReady(key), 500);
}

// ─── SPA NAVIGATION ──────────────────────────────────────────

const _push = history.pushState.bind(history);
history.pushState = (...a) => { _push(...a); checkState(); };
window.addEventListener('popstate', checkState);

// Fallback poll — catches episode swaps and navigation that skip pushState
setInterval(checkState, 800);

// ─── MUTATION OBSERVER (backup) ──────────────────────────────
//
//  Debounced — HBO Max's React tree mutates constantly; we only
//  want to react once things settle.

let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(checkState, 300);
});

observer.observe(document.body, { childList: true, subtree: true });

// ─── KEYBOARD ────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { removePill(); lastKey = null; }
});

console.log('[HR] HBO Ratings Overlay v1 ✅');
