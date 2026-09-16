// Unit tests for chunkText — the word-boundary splitter used to stream the
// reply from every path (AI, offline fallback, and marker-less model output).
//
// The invariant the client and the rest of the server rely on is that joining
// the chunks reproduces the original text exactly. A dropped or duplicated
// character would show up as a mangled word on the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from '../../api/_lib/diary.js';

test('returns no chunks for empty input', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText(null), []);
  assert.deepEqual(chunkText(undefined), []);
});

test('splits into chunks near the size limit', () => {
  const text = 'word '.repeat(40).trim(); // 199 chars
  const chunks = chunkText(text, 48);
  assert.ok(chunks.length > 1, 'expected multiple chunks');
  for (const c of chunks) {
    assert.ok(c.length <= 48, `chunk too long: ${c.length}`);
  }
});

test('rejoining the chunks reproduces the text exactly', () => {
  const samples = [
    'A short reply.',
    'A rather longer reply that will certainly need to be split across several chunks because it keeps going.',
    'One   two\tthree\n\nfour', // irregular whitespace must survive
    'Trailing space kept ',
    '   leading spaces',
    'punctuation! yes? indeed; maybe: "quoted" — em dash.',
    'a'.repeat(200),
    'x '.repeat(150)
  ];
  for (const text of samples) {
    assert.equal(chunkText(text, 48).join(''), text, `round-trip failed for ${JSON.stringify(text.slice(0, 30))}`);
    assert.equal(chunkText(text, 1).join(''), text, 'round-trip failed with maxChars=1');
    assert.equal(chunkText(text, 1000).join(''), text, 'round-trip failed with a huge maxChars');
  }
});

test('emits a single word longer than the limit whole, not truncated', () => {
  const longWord = 'supercalifragilisticexpialidociousandthensomemoreletters';
  const chunks = chunkText(longWord, 10);
  assert.deepEqual(chunks, [longWord]);
  assert.equal(chunks.join(''), longWord);
});

test('never splits a word across two chunks', () => {
  // The chunks are allowed to carry the whitespace they absorbed (that is why
  // joining reproduces the input), so the property to check is that every
  // boundary falls on whitespace — i.e. no word is cut in half.
  const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
  const chunks = chunkText(text, 20);
  assert.ok(chunks.length > 1, 'expected the sample to need splitting');
  for (let i = 0; i < chunks.length - 1; i++) {
    const endsWithSpace = /\s$/.test(chunks[i]);
    const nextStartsWithSpace = /^\s/.test(chunks[i + 1]);
    assert.ok(
      endsWithSpace || nextStartsWithSpace,
      `boundary ${i} splits a word: ${JSON.stringify(chunks[i].slice(-12))} | ${JSON.stringify(chunks[i + 1].slice(0, 12))}`
    );
  }
});

test('produces no empty chunks', () => {
  const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
  for (const chunk of chunkText(text, 20)) {
    assert.ok(chunk.length > 0, 'chunks must be non-empty');
  }
});

test('keeps the text in one chunk when it already fits', () => {
  const text = 'It fits.';
  assert.deepEqual(chunkText(text, 48), [text]);
});
