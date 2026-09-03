/**
 * Browser-console script for adding a whole playlist to Liked Music without going through the
 * YouTube API. It clicks Like on the YouTube Music page itself, using the session already open
 * in the user's browser.
 *
 * Adapted from a widely-circulated community script
 * (https://gist.github.com/merlijn-sebrechts/f65d7b62b8214a94a136e997ecd7dca9).
 *
 * ## Why this is a sweep loop rather than "collect the buttons and click them"
 *
 * Two earlier versions of this file assumed things about the page that turned out to be false,
 * and each failed silently while reporting success on a real 793-track playlist:
 *
 * - v1 collected every Like button up front. It found 16 (one screenful) and reported "done",
 *   because YouTube Music only fills in a row's controls when the row is near the viewport.
 * - v2 walked rows by index, scrolling each into view. It reported "784 already liked" when
 *   only ~647 tracks were actually in Liked Music. The page keeps roughly **100 rows in the
 *   DOM at a time** and recycles the nodes as you scroll (confirmed by counting rows in the
 *   console after a run), so indexing into the row list is meaningless past the first
 *   hundred, and a recycled node can still carry the previous track's `like-status`.
 *
 * So this version assumes nothing about how many rows exist, whether indices are stable, or
 * whether an attribute can be trusted on a row that isn't on screen. It only ever acts on
 * what is visible right now: scroll a screen, like whatever unliked buttons are present,
 * repeat to the bottom — then sweep the whole list again, and again, until a complete pass
 * finds nothing left to like. That final empty pass is the completion signal, which is true
 * regardless of how the page virtualises its rows.
 *
 * The tradeoff is time: it re-walks the list at least twice. That's the price of a result
 * that's actually verifiable.
 *
 * Built as a string rather than a real module: it never executes in this app (it can't —
 * different origin), it's only ever copied to the clipboard for the user to paste into the
 * console on music.youtube.com.
 *
 * @param expectedTracks total tracks the playlist is known to contain, per the backend's
 *   like-preview. Only used to warn if far fewer rows were ever seen; pass 0 to skip.
 */
export function buildLikeAllScript(expectedTracks: number): string {
  return `(async () => {
  const EXPECTED_TRACKS = ${Math.max(0, Math.floor(expectedTracks))};
  const CLICK_DELAY_MS = 400;   // raise if YouTube Music starts missing clicks
  const SCROLL_SETTLE_MS = 600; // time for newly scrolled-in rows to render
  const MAX_PASSES = 6;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Playlist tracks live in the shelf; recommendations sit outside it. Scope to the shelf so
  // we never like a suggestion by accident.
  const scope = document.querySelector('ytmusic-playlist-shelf-renderer') || document;
  if (scope === document) {
    console.warn('Playlist container not found - falling back to the whole page. Check afterwards that no recommended tracks were liked.');
  }

  // Find whatever element actually scrolls, rather than guessing a selector: YouTube Music
  // has moved this more than once, and a wrong guess makes the whole script a no-op.
  function findScroller() {
    const candidates = [
      document.querySelector('ytmusic-app-layout #contentContainer'),
      document.querySelector('ytmusic-app-layout'),
      document.scrollingElement,
      document.documentElement,
    ];
    for (const el of candidates) {
      if (el && el.scrollHeight > el.clientHeight + 50) return el;
    }
    return document.scrollingElement || document.documentElement;
  }
  const scroller = findScroller();

  const unlikedSelector =
    'ytmusic-like-button-renderer[like-status="INDIFFERENT"] button[aria-label="Like"]';

  // One top-to-bottom sweep: like everything currently on screen, scroll a screen, repeat.
  async function sweep(passNumber) {
    scroller.scrollTop = 0;
    await sleep(SCROLL_SETTLE_MS);

    let clicked = 0;
    let maxRowsSeen = 0;
    let stuckScrolls = 0;

    while (true) {
      maxRowsSeen = Math.max(maxRowsSeen, scope.querySelectorAll('ytmusic-responsive-list-item-renderer').length);

      // Re-query every time: nodes get recycled, so a list captured a moment ago is stale.
      let button = scope.querySelector(unlikedSelector);
      while (button) {
        button.click();
        clicked++;
        if (clicked % 25 === 0) console.log('  pass ' + passNumber + ': liked ' + clicked + ' so far...');
        await sleep(CLICK_DELAY_MS);
        button = scope.querySelector(unlikedSelector);
      }

      const before = scroller.scrollTop;
      scroller.scrollTop = before + Math.max(200, scroller.clientHeight * 0.8);
      await sleep(SCROLL_SETTLE_MS);

      if (scroller.scrollTop <= before + 1) {
        // Bottom reached - but give lazily-loaded rows one more chance to appear.
        stuckScrolls++;
        if (stuckScrolls >= 2) break;
        await sleep(SCROLL_SETTLE_MS);
      } else {
        stuckScrolls = 0;
      }
    }

    return { clicked: clicked, maxRowsSeen: maxRowsSeen };
  }

  console.log('Starting. Keep this tab open and leave it in the foreground.');

  let total = 0;
  let rowsSeen = 0;
  let passes = 0;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    passes = pass;
    const result = await sweep(pass);
    total += result.clicked;
    rowsSeen = Math.max(rowsSeen, result.maxRowsSeen);
    console.log('Pass ' + pass + ': liked ' + result.clicked + '.');

    // A complete pass that found nothing left is the only trustworthy "done" signal here.
    if (result.clicked === 0) break;
  }

  console.log('Finished! ' + total + ' track' + (total === 1 ? '' : 's') + ' liked. Enjoy 🎵');

  if (passes >= MAX_PASSES) {
    console.warn(
      'Stopped after ' + MAX_PASSES + ' passes while still finding tracks to like. ' +
      'Run the script again to continue.'
    );
  }
  if (EXPECTED_TRACKS > 0 && rowsSeen < EXPECTED_TRACKS) {
    console.warn(
      'Note: this playlist has ' + EXPECTED_TRACKS + ' tracks, but at most ' + rowsSeen +
      ' rows were ever on screen at once. That is normal - YouTube Music keeps only part of ' +
      'the list loaded - but if the liked count looks low, run the script once more.'
    );
  }
  console.log(
    'If Liked Music shows fewer songs than were liked here, that is YouTube filtering, not a ' +
    'missed track: only items it treats as music appear there, so liked plain YouTube videos ' +
    'are left out.'
  );
})();`;
}
