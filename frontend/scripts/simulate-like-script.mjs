/**
 * Run with:  node frontend/scripts/simulate-like-script.mjs
 *
 * There is no way to test likeAllScript.ts against the real page from here - it only runs on
 * music.youtube.com, in the user's logged-in session. Three versions of it shipped broken as a
 * result, each reporting success while doing nothing. So this fakes the page instead, modelled
 * on how it actually misbehaved, and asserts two things the earlier versions got wrong:
 * everything unliked gets liked, and a run that cannot scroll says so rather than claiming
 * success.
 *
 * Simulates the YouTube Music playlist page the way it actually behaved in the failures:
 *  - 793 tracks, but only a ~100-row window is present in the DOM at a time
 *  - a row's Like control only exists while the row is near the viewport
 *  - only ONE element actually scrolls; the others merely look scrollable
 * Then runs the generated script against it and checks every unliked track got clicked.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const TOTAL = 793;
const ROW_H = 56;
const VIEW_H = 700;
const DOM_WINDOW = 100;   // rows kept in the DOM
const RENDER_NEAR = 16;   // rows around the viewport whose controls exist

function makeWorld({ scrollWorks }) {
  const liked = new Array(TOTAL).fill(false);
  // Mirror the reported state: the top of the list is already liked, the rest is not.
  for (let i = 0; i < 640; i++) liked[i] = true;
  const clicks = [];
  let scrollTop = 0;
  const maxScroll = TOTAL * ROW_H - VIEW_H;

  const firstDomIndex = () => {
    const centre = Math.floor((scrollTop + VIEW_H / 2) / ROW_H);
    return Math.max(0, Math.min(TOTAL - DOM_WINDOW, centre - Math.floor(DOM_WINDOW / 2)));
  };

  function makeRow(index) {
    const centre = Math.floor((scrollTop + VIEW_H / 2) / ROW_H);
    const rendered = Math.abs(index - centre) <= RENDER_NEAR;
    return {
      _index: index,
      getBoundingClientRect: () => ({ top: index * ROW_H - scrollTop }),
      scrollIntoView(opts) {
        if (!scrollWorks) return; // scrollIntoView also does nothing in the "broken" world
        const target = opts && opts.block === 'end'
          ? index * ROW_H - VIEW_H + ROW_H
          : index * ROW_H;
        scrollTop = Math.max(0, Math.min(maxScroll, target));
      },
      querySelector(sel) {
        if (!rendered) return null;
        if (sel.includes('like-status="INDIFFERENT"') || sel.includes('aria-label="Like"')) {
          return liked[index] ? null : { click: () => { liked[index] = true; clicks.push(index); } };
        }
        return null;
      },
    };
  }

  const domRows = () => {
    const start = firstDomIndex();
    const out = [];
    for (let i = start; i < Math.min(TOTAL, start + DOM_WINDOW); i++) out.push(makeRow(i));
    return out;
  };

  const scope = {
    querySelectorAll: () => domRows(),
    querySelector: (sel) => {
      for (const r of domRows()) {
        const hit = r.querySelector(sel);
        if (hit) return hit;
      }
      return null;
    },
  };

  const realScroller = {
    get scrollTop() { return scrollTop; },
    set scrollTop(v) { if (scrollWorks) scrollTop = Math.max(0, Math.min(maxScroll, v)); },
    clientHeight: VIEW_H,
    scrollHeight: TOTAL * ROW_H,
  };
  // Decoys: look scrollable, ignore writes - this is what broke v3.
  const decoy = () => ({ scrollTop: 0, clientHeight: VIEW_H, scrollHeight: TOTAL * ROW_H });

  const document = {
    querySelector: (sel) => {
      if (sel === 'ytmusic-playlist-shelf-renderer') return scope;
      if (sel === 'ytmusic-app-layout #contentContainer') return decoy();
      if (sel === '#contentContainer') return decoy();
      if (sel === 'ytmusic-app-layout') return realScroller;
      return null;
    },
    scrollingElement: decoy(),
    documentElement: decoy(),
    body: decoy(),
  };

  return { document, liked, clicks, unlikedAtStart: liked.filter((l) => !l).length };
}

async function run(scrollWorks) {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const ts = fs.readFileSync(path.join(here, '..', 'src', 'lib', 'likeAllScript.ts'), 'utf8');
  const body = ts.slice(ts.indexOf('return `') + 8, ts.lastIndexOf('`;'));
  const src = body.replace('${Math.max(0, Math.floor(expectedTracks))}', String(TOTAL));

  const world = makeWorld({ scrollWorks });
  const logs = [];
  const logger = (...a) => logs.push(a.join(' '));
  const fastSleepSrc = src
    .replace(/const CLICK_DELAY_MS = \d+;/, 'const CLICK_DELAY_MS = 0;')
    .replace(/const SETTLE_MS = \d+;/, 'const SETTLE_MS = 0;')
    .replace(/await sleep\(150\)/g, 'await sleep(0)');

  const fn = new Function('document', 'console', 'return ' + fastSleepSrc.replace(/^\(async \(\) => \{/, '(async () => {'));
  await fn(world.document, { log: logger, warn: logger, error: logger });

  return { world, logs };
}

(async () => {
  for (const scrollWorks of [true, false]) {
    const { world, logs } = await run(scrollWorks);
    const missed = world.liked.filter((l) => !l).length;
    console.log('=== scrolling ' + (scrollWorks ? 'WORKS' : 'IS BROKEN') + ' ===');
    console.log(logs.filter((l) => !l.includes('liked so far')).join('\n'));
    console.log('unliked at start:', world.unlikedAtStart, '| clicked:', world.clicks.length, '| still unliked:', missed);
    console.log(scrollWorks
      ? (missed === 0 ? 'PASS - everything got liked' : 'FAIL - ' + missed + ' tracks missed')
      : (logs.some((l) => l.includes('never scrolled')) ? 'PASS - reported the failure instead of claiming success' : 'FAIL - claimed success while stuck'));
    console.log('');
  }
})();
