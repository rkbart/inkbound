// Unit tests for the streamed-reply display helper.
//
// These pin down the one invariant that matters: whatever the server forwards,
// the page must never show a fragment of the ---MEMORIES--- marker, even when
// the marker is split across two chunks. See src/utils/stream.js for why the
// rule is "derive from the raw text" rather than "trim in place".
import test from 'node:test';
import assert from 'node:assert/strict';
import { displayFromStream, MEMORIES_MARKER } from '../../src/utils/stream.js';

test('returns an empty string for empty input', () => {
  assert.equal(displayFromStream(''), '');
  assert.equal(displayFromStream(undefined), '');
  assert.equal(displayFromStream(null), '');
});

test('passes ordinary prose through untouched', () => {
  const prose = 'Tell me, my friend, what secrets do you keep?';
  assert.equal(displayFromStream(prose), prose);
});

test('cuts everything from a complete markers onwards', () => {
  const raw = `A reply worth reading.\n${MEMORIES_MARKER}\n[{"category":"Fact","key":"k","value":"v"}]`;
  assert.equal(displayFromStream(raw), 'A reply worth reading.\n');
});

test('does not leak a marker split across two chunks', () => {
  // This is the bug the helper exists to prevent: the model streams
  // "---MEMO" then "RIES---", so the accumulated text briefly ends in a
  // partial marker that must not be painted.
  const partial = 'The ink dries.---MEMO';
  const shown = displayFromStream(partial);
  assert.equal(shown, 'The ink dries.');
  assert.ok(!shown.includes('-'), 'no marker fragment should survive');
});

test('hides a partial marker at every prefix length', () => {
  const prose = 'Some prose.';
  for (let len = 1; len < MEMORIES_MARKER.length; len++) {
    const fragment = MEMORIES_MARKER.slice(0, len);
    assert.equal(
      displayFromStream(prose + fragment),
      prose,
      `should hide a ${len}-char marker prefix (${JSON.stringify(fragment)})`
    );
  }
});

test('restores characters once they prove to be genuine prose', () => {
  // A trailing "-" could be a marker or could be a dash. While it is
  // ambiguous it is hidden; once more text arrives that rules the marker
  // out, it must come back rather than being lost.
  assert.equal(displayFromStream('Wait-'), 'Wait');
  assert.equal(displayFromStream('Wait- for me'), 'Wait- for me');
});

test('keeps a dash that is not a marker prefix', () => {
  assert.equal(displayFromStream('Well - then.'), 'Well - then.');
});

test('handles the marker appearing with no reply before it', () => {
  const raw = `${MEMORIES_MARKER}\n[]`;
  assert.equal(displayFromStream(raw), '');
});
