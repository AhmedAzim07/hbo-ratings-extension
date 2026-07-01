# HBO Ratings Overlay

A Chrome extension that injects IMDb and Rotten Tomatoes scores directly into HBO Max title pages — no tab-switching, no searching.

![Version](https://img.shields.io/badge/version-1.0-blue) ![Manifest](https://img.shields.io/badge/manifest-v3-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

Open any show or movie page on HBO Max and a translucent pill badge appears between the My List / Rate / Trailer row and the episode/synopsis text:

```
Title Name · ⭐ 9.2 · 🍅 89%
```

The pill updates automatically as you browse between titles and disappears once full playback starts.

---

## Setup

### 1. API key

This zip already has your OMDB key dropped into `config.js` (same key as the Netflix build, since it's the same free account). If you need a fresh one: [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (1,000 requests/day, no card needed).

Starting from scratch instead of this zip?

```bash
cp config.example.js config.js
```

Then edit `config.js`:

```js
const OMDB_KEY = "your_key_here";
```

`config.js` is gitignored — it never gets committed if you push this to GitHub.

### 2. Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `hbo-ratings-overlay` folder

Done. Open HBO Max and click into any title.

---

## How it works — and how it differs from the Netflix build

HBO Max isn't a modal-over-a-grid like Netflix — clicking a title takes you to a dedicated hero page. Two of the three load-bearing tricks from v3 had to change:

| Step | What happens |
|------|-------------|
| You navigate to a title page | URL pathname changes (SPA routing, no `jbv` param to watch) |
| Extension detects the change | Waits 500ms for React to render the action row |
| Title extraction | Reads `aria-label` off `<main>` — HBO Max keeps this in sync with the show/movie name even while a specific episode's synopsis is on screen |
| OMDB lookup | Exact match → strip subtitle → search fallback (unchanged from the Netflix build) |
| Pill injection | Finds the My List / Rate / Trailer buttons by their visible labels, then inserts right after that row — the circled gap in your screenshot |
| Cleanup | Removed when the hero disappears, the full-screen player takes over, or you hit Escape |

**Title extraction:** Netflix renders its title as a logo image with an `alt` tag, so v3 scraped that. HBO Max's title treatment isn't guaranteed to be an image, but every hero page's `<main>` carries an `aria-label` matching the title exactly — same trick, more stable anchor. `document.title` is the fallback if that's ever missing.

**Pill placement:** Everything else in that DOM (`StyledMainContainer-Fuse-Web-Play__sc-1at9oi8-1 hmurVw`) is a hashed styled-components class that'll shuffle on HBO's next deploy. "My List," "Rate," and "Trailer" are the actual words on screen — the extension finds those three buttons, walks up to their shared parent, and drops the pill right after it.

**Cleanup:** instead of watching for a `/watch/` URL like Netflix, this checks whether HBO Max's own `#layer-root-player-screen` div has content in it — that's the layer the real player renders into. It deliberately does *not* just check for any `<video>` tag, because the hero itself autoplays a muted background preview clip, which would've made the pill flicker in and out constantly.

---

## File structure

```
hbo-ratings-overlay/
├── manifest.json        # Extension config (MV3)
├── content.js           # Core logic — detection, extraction, ratings, UI
├── styles.css           # Pill styles (translucent, injected into hero)
├── config.js            # Your OMDB key — gitignored, never committed
├── config.example.js    # Template to copy for setup
├── .gitignore
└── README.md
```

---

## Debugging

Open DevTools on HBO Max (`F12`) and check the console for `[HR]` logs:

```
[HR] Title from main[aria-label]: Game of Thrones
[HR] Pill injected after actions row
```

That second line tells you which injection strategy actually fired. If it says "Watch button row (fallback)" or "prepended to hero container (fallback)" instead, the primary strategy couldn't find the My List/Rate/Trailer buttons by label — inspect the actual markup and update `ACTION_LABELS` in `content.js` to match whatever text/aria-labels HBO Max is serving you (regional wording, A/B tests, etc. can all vary this).

---

## Limitations

- OMDB free tier: 1,000 requests/day, shared with the Netflix build if you're reusing the same key. Results are cached per session.
- Domain matches `play.hbomax.com` and `play.max.com` (added the second as a hedge for the branding back-and-forth) — if your title pages load somewhere else, add it to `matches` in `manifest.json`.
- Titles that don't exist in OMDB (some HBO originals, international content) will show N/A.
- Built from your DevTools screenshots, not a live session — the selector fallbacks and console logging above exist specifically so you can debug quickly if HBO Max's actual markup differs from what the screenshot showed.

---

## Tech

- Chrome Extensions Manifest V3
- Vanilla JS — no build step, no dependencies
- OMDB API for ratings data
- MutationObserver + History API for SPA navigation detection

---

## License

MIT
