// Display helpers for the streamed diary reply.
//
// The model is asked to write its prose, then a "---MEMORIES---" marker, then a
// JSON block the server parses. The reply is streamed to the client in chunks,
// so the marker can arrive split across two of them ("---MEMO" + "RIES---").
// A naive indexOf() cut on the accumulated text would therefore flash partial
// marker characters on the page for a frame.
//
// The rule here is to always *derive* the display text from the whole raw
// stream rather than mutating it in place: that way hiding a trailing partial
// marker is safe, because the characters it hides are still in the raw text and
// reappear if they turn out to be genuine prose.

export const MEMORIES_MARKER = '---MEMORIES---';

/**
 * Returns the part of a raw streamed reply that is safe to display.
 *
 * @param {string} raw everything received for this reply so far
 * @returns {string} the text to show, without the memories section and without
 *   a trailing fragment that may still grow into the marker
 */
export const displayFromStream = (raw) => {
  if (!raw) return '';

  const cut = raw.indexOf(MEMORIES_MARKER);
  if (cut !== -1) return raw.slice(0, cut);

  // No complete marker yet: hide a trailing fragment that is a prefix of it.
  // Longest match first, so "---MEMO" is removed rather than just "-".
  for (let len = MEMORIES_MARKER.length - 1; len > 0; len--) {
    if (raw.endsWith(MEMORIES_MARKER.slice(0, len))) {
      return raw.slice(0, raw.length - len);
    }
  }

  return raw;
};
