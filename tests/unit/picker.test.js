// Unit tests for the fallback engine's personalization.
//
// This is what makes the offline diary feel like it knows you: the curated
// responses contain {name} / {personaName} placeholders. Note the deliberate
// "stranger" fallback — an unknown writer must still get a sensible sentence
// rather than a literal "{name}" in the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { personalize, pickResponse, pickSilentResponse } from '../../api/_lib/picker.js';

test('substitutes the remembered name', () => {
  const memories = [{ category: 'Identity', key: 'User Name', value: 'Corvus', importance: 5 }];
  assert.equal(
    personalize('Tell me, {name}, what troubles you?', memories, 'Tom Riddle'),
    'Tell me, Corvus, what troubles you?'
  );
});

test('substitutes every occurrence', () => {
  const memories = [{ key: 'User Name', value: 'Corvus' }];
  assert.equal(personalize('{name}? {name}!', memories, 'Tom'), 'Corvus? Corvus!');
});

test('falls back to "stranger" when the name is unknown', () => {
  assert.equal(personalize('Ah, {name}.', [], 'Tom Riddle'), 'Ah, stranger.');
  // A memory list with other facts but no name must behave the same way.
  const other = [{ category: 'Fear', key: 'Fear', value: 'the dark' }];
  assert.equal(personalize('Ah, {name}.', other, 'Tom Riddle'), 'Ah, stranger.');
});

test('substitutes the persona name', () => {
  const memories = [{ key: 'User Name', value: 'Corvus' }];
  assert.equal(
    personalize('I am {personaName}, and I know you, {name}.', memories, 'The Grey Lady'),
    'I am The Grey Lady, and I know you, Corvus.'
  );
});

test('leaves text with no placeholders untouched', () => {
  const text = 'The pages are quiet tonight.';
  assert.equal(personalize(text, [], 'Tom Riddle'), text);
});

test('pickResponse always returns a non-empty personalized string', () => {
  const memories = [{ key: 'User Name', value: 'Corvus' }];
  // Sample repeatedly because the picker chooses at random from a pool.
  for (let i = 0; i < 50; i++) {
    const text = pickResponse('fear', 1, memories, 'Tom Riddle');
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0, 'response must not be empty');
    assert.ok(!text.includes('{name}'), `placeholder left unsubstituted: ${text}`);
    assert.ok(!text.includes('{personaName}'), `placeholder left unsubstituted: ${text}`);
  }
});

test('pickResponse degrades gracefully for an unknown pool', () => {
  // An unrecognised theme must still produce a sentence (the generic pool),
  // not a crash or an empty page.
  const text = pickResponse('not-a-real-theme', 2, [], 'Tom Riddle');
  assert.ok(typeof text === 'string' && text.length > 0);
});

test('pickSilentResponse returns one of the curated silent replies', () => {
  const text = pickSilentResponse();
  assert.ok(typeof text === 'string' && text.length > 0);
});