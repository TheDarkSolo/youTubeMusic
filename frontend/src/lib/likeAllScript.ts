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
 * (https://gist.github.com/merlijn-sebrechts/f65d7b62b8214a94a136e997ecd7dca9), with two
 * fixes for problems that bite on large playlists:
 *
 * 1. **Auto-scroll first.** YouTube Music renders playlist rows lazily, so the original only
 *    liked the handful of tracks currently in the DOM. This scrolls to the bottom until the
 *    row count stops growing, so the whole playlist is loaded before any clicking starts.
 * 2. **Scoped to the playlist shelf.** The original's own caveat was that it could
 *    accidentally like the recommendation rows YouTube appends below the playlist. This
 *    restricts the search to the playlist's own container when it can find it.
 *
 * Kept as a plain string rather than a real module: it never executes in this app (it can't —
 * different origin), it's only ever copied to the clipboard for the user to paste into the
 * console on music.youtube.com.
 */
export const LIKE_ALL_CONSOLE_SCRIPT = `(async () => {
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
    const scroller = document.querySelector('ytmusic-app-layout #contentContainer') || document.scrollingElement;
    scroller.scrollTop = scroller.scrollHeight;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(SCROLL_DELAY_MS);
    console.log('  loaded ' + count + ' rows...');
  }
  console.log('Loaded ' + previous + ' rows.');

  // 2. Like everything not already liked, bottom-up so the list does not shift under us.
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
