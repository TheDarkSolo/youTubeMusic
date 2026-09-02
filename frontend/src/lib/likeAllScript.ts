/**
 * Browser-console script for adding a whole playlist to Liked Music **without spending any
 * YouTube Data API quota**.
 *
 * Where the app's own "Add to Liked Music" action calls `videos.rate` (50 quota units per
 * track, against a 10,000/day cap), this instead clicks the Like button on each row of the
 * YouTube Music page itself, using the session already open in the user's browser. No API,
 * no quota — the tradeoff is that it's driving the UI, so it's slower and less precise.
 *
 * Adapted from a widely-circulated community script
 * (https://gist.github.com/merlijn-sebrechts/f65d7b62b8214a94a136e997ecd7dca9), with three
 * fixes for problems that bite on large playlists:
 *
 * 1. **Auto-scroll first.** YouTube Music renders playlist rows lazily, so the original only
 *    liked the handful of tracks currently in the DOM — which is why other versions of this
 *    script tell the user to scroll to the bottom by hand first. This does it for them,
 *    scrolling until the row count stops growing.
 * 2. **Verify the load before clicking anything.** The scroll container selector can't be
 *    verified from this codebase (it lives on music.youtube.com), and if YouTube changes it
 *    the scroll silently does nothing — leaving the original failure mode intact but hidden.
 *    So the caller passes in how many tracks the playlist actually has, and the script
 *    refuses to start if it loaded fewer, telling the user to scroll manually and re-run.
 *    Better to stop with a clear message than to half-like a playlist and report success.
 * 3. **Scoped to the playlist shelf.** The original's own caveat was that it could
 *    accidentally like the recommendation rows YouTube appends below the playlist. This
 *    restricts the search to the playlist's own container when it can find it.
 *
 * Built as a string rather than a real module: it never executes in this app (it can't —
 * different origin), it's only ever copied to the clipboard for the user to paste into the
 * console on music.youtube.com.
 *
 * @param expectedTracks total tracks the playlist is known to contain, per the backend's
 *   like-preview. Used only for the sanity check in (2); pass 0 to skip that check.
 */
export function buildLikeAllScript(expectedTracks: number): string {
  return `(async () => {
  const EXPECTED_TRACKS = ${Math.max(0, Math.floor(expectedTracks))};
  const CLICK_DELAY_MS = 500;   // raise if YouTube Music starts missing clicks
  const SCROLL_DELAY_MS = 700;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const rowSelector = 'ytmusic-responsive-list-item-renderer';
  const likeSelector =
    'ytmusic-like-button-renderer[like-status="INDIFFERENT"] button[aria-label="Like"][aria-pressed="false"]';

  // Playlist tracks live in the shelf; recommendations sit outside it. Scope to the shelf so
  // we never like a suggestion by accident. Fall back to the whole page if the layout differs.
  const scope = document.querySelector('ytmusic-playlist-shelf-renderer') || document;
  if (scope === document) {
    console.warn('Playlist container not found - falling back to the whole page. Check afterwards that no recommended tracks were liked.');
  }

  // 1. Load every row: YouTube Music adds them lazily as you scroll.
  console.log('Loading the full playlist...');
  let previous = -1;
  for (let i = 0; i < 300; i++) {
    const count = scope.querySelectorAll(rowSelector).length;
    if (count === previous) break;
    previous = count;
    // Try every plausible scroll target - YouTube Music has changed which element actually
    // scrolls more than once, and a wrong guess here would silently load nothing.
    const scroller = document.querySelector('ytmusic-app-layout #contentContainer')
      || document.scrollingElement
      || document.documentElement;
    scroller.scrollTop = scroller.scrollHeight;
    window.scrollTo(0, document.documentElement.scrollHeight);
    const lastRow = scope.querySelectorAll(rowSelector)[count - 1];
    if (lastRow) lastRow.scrollIntoView({ block: 'end' });
    await sleep(SCROLL_DELAY_MS);
    console.log('  loaded ' + count + ' rows...');
  }
  const loaded = scope.querySelectorAll(rowSelector).length;
  console.log('Loaded ' + loaded + ' rows.');

  // 2. Refuse to run on a partially-loaded page: liking half a playlist and reporting
  //    success is worse than stopping and saying why.
  if (EXPECTED_TRACKS > 0 && loaded < EXPECTED_TRACKS) {
    console.error(
      'Stopping: only ' + loaded + ' of ' + EXPECTED_TRACKS + ' tracks are loaded on this page, ' +
      'so most of the playlist would be skipped. Scroll to the very bottom yourself until all ' +
      EXPECTED_TRACKS + ' rows have loaded, then paste this script again. Nothing was liked.'
    );
    return;
  }

  // 3. Like everything not already liked, bottom-up so the list does not shift under us.
  const buttons = Array.from(scope.querySelectorAll(likeSelector)).reverse();
  console.log('Found ' + buttons.length + ' tracks to like. Keep this tab open.');

  for (let i = 0; i < buttons.length; i++) {
    buttons[i].click();
    if ((i + 1) % 10 === 0 || i === buttons.length - 1) {
      console.log('Liked ' + (i + 1) + '/' + buttons.length);
    }
    await sleep(CLICK_DELAY_MS);
  }

  console.log('Done - liked ' + buttons.length + ' tracks, without using any API quota.');
})();`;
}
