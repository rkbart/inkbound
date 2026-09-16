// Unit tests for the fallback engine's theme detection.
//
// detectThemes is the "understanding" step when no LLM is available: it maps a
// free-text entry to a theme (fear/love/secret/…) and extracts a memory. It is
// pure, which makes it the easiest place to learn how the offline engine thinks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectThemes } from '../../api/_lib/themes.js';

test('returns a generic theme when nothing matches', () => {
  const { themes, extracted } = detectThemes('Hmm. Quite so.');
  assert.ok(themes.includes('generic'));
  assert.deepEqual(extracted, {});
});

test('detects fear and extracts what the writer is afraid of', () => {
  const { themes, extracted } = detectThemes('I am terrified of the dark.');
  assert.ok(themes.includes('fear'));
  assert.equal(extracted.fear.category, 'Fear');
  assert.equal(extracted.fear.importance, 4);
  assert.match(extracted.fear.value, /dark/i);
});

test('detects a secret confession', () => {
  const { themes, extracted } = detectThemes('I have a secret I have never told anyone.');
  assert.ok(themes.includes('secret'));
  assert.equal(extracted.secret.category, 'Secret');
});

test('detects love as a desire', () => {
  const { themes, extracted } = detectThemes('I think I love her, and it frightens me.');
  assert.ok(themes.includes('love'));
  assert.equal(extracted.love.key, 'Love Interest');
});

test('detects questions about the diary itself', () => {
  const { themes } = detectThemes('Who are you, really?');
  assert.ok(themes.includes('identity_question'));
});

test('detects an introduction and stores the name at top importance', () => {
  const { themes, extracted } = detectThemes('Hello, my name is Corvus Blackwood.');
  assert.ok(themes.includes('name_intro'));
  assert.equal(extracted.name.category, 'Identity');
  assert.equal(extracted.name.key, 'User Name');
  assert.equal(extracted.name.importance, 5);
  assert.match(extracted.name.value, /Corvus/);
});

test('does not mistake an adjective for a name', () => {
  // "I am afraid" is the classic false positive: the name extractor must rely
  // on the exclusion list rather than capturing the next word blindly.
  const { extracted } = detectThemes('I am afraid of the dark.');
  assert.equal(extracted.name, undefined, 'a feeling must not become a name');
});

test('handles several themes in one entry', () => {
  const { themes, extracted } = detectThemes('My name is Corvus and I am afraid of the dark because I love her.');
  assert.ok(themes.includes('name_intro'));
  assert.ok(themes.includes('fear'));
  assert.ok(themes.includes('love'));
  assert.ok(Object.keys(extracted).length >= 2, 'expected multiple memories');
});

test('every extracted memory has the shape the DB expects', () => {
  const samples = [
    'I am afraid of spiders.',
    'I have a secret: I never told anyone about the letter.',
    'I dream of becoming a healer someday.',
    'My brother says I am too quiet.'
  ];
  for (const s of samples) {
    const { extracted } = detectThemes(s);
    for (const [key, mem] of Object.entries(extracted)) {
      assert.equal(typeof key, 'string');
      assert.ok(['Identity', 'Secret', 'Fear', 'Desire', 'Relationship', 'Fact'].includes(mem.category), `unexpected category ${mem.category}`);
      assert.ok(typeof mem.key === 'string' && mem.key.length > 0);
      assert.ok(typeof mem.value === 'string' && mem.value.length > 0);
      assert.ok(mem.importance >= 1 && mem.importance <= 5, `importance out of range: ${mem.importance}`);
    }
  }
});

test('is case-insensitive', () => {
  const upper = detectThemes('I AM TERRIFIED OF THE DARK.');
  const lower = detectThemes('i am terrified of the dark.');
  assert.deepEqual(upper.themes.sort(), lower.themes.sort());
});