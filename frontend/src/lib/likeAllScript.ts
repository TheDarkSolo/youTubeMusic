/**
 * Browser-console script for adding a whole playlist to Liked Music without going through the
 * YouTube API. It clicks Like on the YouTube Music page itself, using the session already open
 * in the user's browser.
 *
 * Adapted from a widely-circulated community script
 * (https://gist.github.com/merlijn-sebrechts/f65d7b62b8214a94a136e997ecd7dca9).
 *
 * ## Three earlier versions failed, each for a different wrong assumption
 *
 * All three reported success on a real 793-track playlist while doing almost nothing, so the
 * design below is shaped mostly by what turned out not to be true:
 *
 * - v1 collected every Like button up front: found 16 (one screenful), liked 16, said "done".
 *   YouTube Music only renders a row's controls while the row is near the viewport.
 * - v2 walked rows by index, scrolling each into view: reported "784 already liked" when only
 *   ~647 tracks were really in Liked Music. The page keeps roughly 100 rows in the DOM and
 *   recycles the nodes, so indices are meaningless past the first window and a recycled node
 *   can still carry the previous track's `like-status`.
 * - v3 swept the list using `scrollTop` on an element picked by `scrollHeight > clientHeight`.
 *   That element was not the one that actually scrolls, so nothing moved: the sweep sat at the
 *   top of the list (where everything was already liked), saw no progress twice, and announced
 *   "Finished! 0 tracks liked."
 *
 * So this version does not guess how to scroll — it **tests** each candidate by scrolling and
 * checking whether the rows actually moved, and falls back to `scrollIntoView` on a row (the
 * one method v1 proved works) if none of them do. It also refuses to claim success when it
 * never managed to move: "found nothing to like" and "never got anywhere" are reported
 * differently, because the previous version conflated them.
 *
 * Completion is still decided by sweeping the whole list until a full pass clicks nothing —
 * that part holds regardless of how the page virtualises rows.
 *
 * Built as a string rather than a real module: it never executes in this app (it can't —
 * different origin), it's only ever copied to the clipboard for the user to paste into the
 * console on music.youtube.com.
 *
 * @param expectedTracks total tracks the playlist is known to contain, per the backend's
 *   like-preview. Used to warn when the sweep clearly never covered the whole list; pass 0 to
 *   skip that check.
 */
export function buildLikeAllScript(expectedTracks: number): string {
  return `(async () => {
  const EXPECTED_TRACKS = ${Math.max(0, Math.floor(expectedTracks))};
  const CLICK_DELAY_MS = 400;   // raise if YouTube Music starts missing clicks
  const SETTLE_MS = 600;        // time for newly scrolled-in rows to render
  const MAX_PASSES = 6;
  const MAX_STEPS_PER_PASS = 2000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const ROW = 'ytmusic-responsive-list-item-renderer';
  const UNLIKED = 'ytmusic-like-button-renderer[like-status="INDIFFERENT"] button[aria-label="Like"]';

  // Playlist tracks live in the shelf; recommendations sit outside it. Scope to the shelf so
  // we never like a suggestion by accident.
  const scope = document.querySelector('ytmusic-playlist-shelf-renderer') || document;
  if (scope === document) {
    console.warn('Playlist container not found - falling back to the whole page. Check afterwards that no recommended tracks were liked.');
  }

  const rows = () => scope.querySelectorAll(ROW);
  // Where the list currently sits, measured from the rows themselves rather than from any
  // element's scrollTop - this is what "did it actually move?" has to be judged against.
  function anchor() {
    const r = rows();
    const first = r[0];
    return first ? Math.round(first.getBoundingClientRect().top) : null;
  }

  // Work out how to scroll by trying it and checking the rows moved. v3 picked an element that
  // merely looked scrollable and silently did nothing for a whole run.
  let scroller = null;
  for (const el of [
    document.querySelector('ytmusic-app-layout #contentContainer'),
    document.querySelector('#contentContainer'),
    document.querySelector('ytmusic-app-layout'),
    document.scrollingElement,
    document.documentElement,
    document.body,
  ]) {
    if (!el) continue;
    const before = anchor();
    const topBefore = el.scrollTop;
    el.scrollTop = topBefore + 300;
    await sleep(150);
    if (el.scrollTop !== topBefore && anchor() !== before) { scroller = el; break; }
    el.scrollTop = topBefore;
  }
  console.log(scroller
    ? 'Scrolling via the page container.'
    : 'Scrolling by bringing rows into view.');

  function stepDown() {
    if (scroller) {
      // Half a screen at a time, so the viewport never skips over a row.
      scroller.scrollTop += Math.max(200, scroller.clientHeight * 0.5);
      return;
    }
    const r = rows();
    const last = r[r.length - 1];
    if (last) last.scrollIntoView({ block: 'end' });
  }

  function toTop() {
    if (scroller) { scroller.scrollTop = 0; return; }
    const first = rows()[0];
    if (first) first.scrollIntoView({ block: 'start' });
  }

  // One top-to-bottom pass: like whatever is currently rendered, move down, repeat.
  async function sweep(passNumber) {
    toTop();
    await sleep(SETTLE_MS);

    let clicked = 0;
    let steps = 0;
    let maxRows = 0;
    let stuck = 0;
    let lastAnchor = null;
    let moved = false;

    for (let i = 0; i < MAX_STEPS_PER_PASS; i++) {
      maxRows = Math.max(maxRows, rows().length);

      // Re-query after every click: nodes are recycled, so a list captured a moment ago is stale.
      let btn = scope.querySelector(UNLIKED);
      while (btn) {
        btn.click();
        clicked++;
        if (clicked % 25 === 0) console.log('  pass ' + passNumber + ': ' + clicked + ' liked so far...');
        await sleep(CLICK_DELAY_MS);
        btn = scope.querySelector(UNLIKED);
      }

      const before = anchor();
      stepDown();
      await sleep(SETTLE_MS);
      steps++;

      const now = anchor();
      if (now !== before) moved = true;
      if (now === before && now === lastAnchor) {
        stuck++;
        if (stuck >= 3) break; // genuinely at the bottom (or cannot move at all)
      } else {
        stuck = 0;
      }
      lastAnchor = before;
    }

    return { clicked: clicked, steps: steps, maxRows: maxRows, moved: moved };
  }

  console.log('Starting. Keep this tab open and in the foreground.');

  let total = 0;
  let maxRowsSeen = 0;
  let movedAtAll = false;
  let passes = 0;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    passes = pass;
    const r = await sweep(pass);
    total += r.clicked;
    maxRowsSeen = Math.max(maxRowsSeen, r.maxRows);
    if (r.moved) movedAtAll = true;
    console.log('Pass ' + pass + ': liked ' + r.clicked + ' (' + r.steps + ' scroll steps, up to ' + r.maxRows + ' rows loaded).');
    if (r.clicked === 0) break;
  }

  // "Nothing left to like" and "never managed to scroll" look identical in the totals, so
  // separate them explicitly - conflating the two is exactly how the previous version
  // reported a successful run that had done nothing.
  if (!movedAtAll) {
    console.error(
      'The list never scrolled, so only the tracks already on screen were checked. Nothing ' +
      'reliable was done. Scroll the playlist manually with the mouse to confirm it moves, ' +
      'then run the script again - and if it still reports this, the page layout has changed.'
    );
    return;
  }

  console.log('Finished! ' + total + ' track' + (total === 1 ? '' : 's') + ' liked. Enjoy 🎵');

  if (passes >= MAX_PASSES) {
    console.warn('Stopped after ' + MAX_PASSES + ' passes while still finding tracks. Run it again to continue.');
  }
  if (EXPECTED_TRACKS > 0 && maxRowsSeen < EXPECTED_TRACKS * 0.5) {
    console.warn(
      'Only ' + maxRowsSeen + ' rows of ' + EXPECTED_TRACKS + ' were ever loaded. ' +
      'YouTube Music keeps just part of the list in memory, so that can be normal - but if the ' +
      'liked count looks low, run the script once more.'
    );
  }
  console.log(
    'If Liked Music shows fewer songs than were liked here, that is YouTube filtering rather ' +
    'than a missed track: only items it treats as music appear there, so liked plain YouTube ' +
    'videos are left out.'
  );
})();`;
}
