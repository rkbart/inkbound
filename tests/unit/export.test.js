// Unit tests for the Markdown diary export.
//
// buildDiaryMarkdown is pure (the browser download is a separate function), so
// the transcript format can be verified without touching the DOM. The
// timestamps are formatted with the machine's locale/timezone, so these tests
// assert structure rather than exact date strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiaryMarkdown } from '../../src/utils/export.js';

const entry = (over = {}) => ({
  id: 1,
  content: 'I am afraid of the dark.',
  response: 'Fear is a door, my friend.',
  created_at: '2026-01-15T10:30:00.000Z',
  ...over
});

test('includes a header with the writer and entry count', () => {
  const md = buildDiaryMarkdown([entry()], 'Corvus');
  assert.match(md, /^# Inkbound Diary/);
  assert.match(md, /\*\*Writer:\*\* Corvus/);
  assert.match(md, /\*\*Entries:\*\* 1/);
  assert.match(md, /\*\*Exported:\*\*/);
});

test('falls back to "anonymous" when there is no username', () => {
  assert.match(buildDiaryMarkdown([], null), /\*\*Writer:\*\* anonymous/);
  assert.match(buildDiaryMarkdown([], ''), /\*\*Writer:\*\* anonymous/);
});

test('reports zero entries for an empty diary', () => {
  const md = buildDiaryMarkdown([], 'Corvus');
  assert.match(md, /\*\*Entries:\*\* 0/);
});

test('renders each entry with its text and the reply as a blockquote', () => {
  const md = buildDiaryMarkdown([entry()], 'Corvus');
  assert.match(md, /\*\*I am afraid of the dark\.\*\*/);
  assert.match(md, /> Fear is a door, my friend\./);
});

test('marks a silent entry instead of inventing a reply', () => {
  const md = buildDiaryMarkdown([entry({ response: null })], 'Corvus');
  assert.match(md, /> \*Ink absorbed in silence\*/);
});

test('uses "Undated" when an entry has no timestamp', () => {
  const md = buildDiaryMarkdown([entry({ created_at: null })], 'Corvus');
  assert.match(md, /## Undated/);
});

test('keeps a multi-line reply inside the blockquote', () => {
  const md = buildDiaryMarkdown([entry({ response: 'First line.\nSecond line.' })], 'Corvus');
  assert.match(md, /> First line\.\n> Second line\./);
});

test('renders every entry in order', () => {
  const entries = [
    entry({ id: 1, content: 'First entry.', response: 'First reply.' }),
    entry({ id: 2, content: 'Second entry.', response: 'Second reply.' }),
    entry({ id: 3, content: 'Third entry.', response: 'Third reply.' })
  ];
  const md = buildDiaryMarkdown(entries, 'Corvus');
  assert.match(md, /\*\*Entries:\*\* 3/);
  const positions = ['First entry.', 'Second entry.', 'Third entry.'].map(t => md.indexOf(t));
  assert.ok(positions.every(p => p !== -1), 'all entries must appear');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'entries must keep their order');
});

test('escapes nothing it should not — raw text survives verbatim', () => {
  // The diary is a personal document: the export must not mangle special
  // characters, because it is meant to be reread.
  const tricky = 'I said "hello" — then *emphasised* & left <angles> #hash.';
  const md = buildDiaryMarkdown([entry({ content: tricky })], 'Corvus');
  assert.ok(md.includes(tricky), 'entry text should appear unmodified');
});