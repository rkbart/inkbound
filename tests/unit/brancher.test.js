// Unit tests for fallback response-pool selection.
//
// The tier decides which variant of a curated reply is used, so that asking
// about the same thing repeatedly does not produce the same sentence. These
// tests encode the intended escalation rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectResponsePool } from '../../api/_lib/brancher.js';

const userTurns = (...contents) => contents.map(content => ({ role: 'user', content }));

test('uses tier 1 for a theme never mentioned before', () => {
  const { pool, tier } = selectResponsePool('fear', [], userTurns('hello there'));
  assert.equal(pool, 'fear');
  assert.equal(tier, 1);
});

test('escalates to tier 2 on a repeat of the same theme', () => {
  const history = userTurns('I am afraid of spiders');
  assert.equal(selectResponsePool('fear', [], history).tier, 2);
});

test('escalates to tier 3 after three mentions', () => {
  const history = userTurns('I am afraid of spiders', 'afraid again', 'still scared');
  assert.equal(selectResponsePool('fear', [], history).tier, 3);
});

test('ignores the diary own turns when counting', () => {
  // Only the writer's messages count — otherwise the diary's reply echoing the
  // theme back would inflate the tier on its own.
  const history = [
    { role: 'assistant', content: 'I am afraid of nothing, my friend.' },
    { role: 'assistant', content: 'What scares you?' }
  ];
  assert.equal(selectResponsePool('fear', [], history).tier, 1);
});

test('moves an experienced writer off tier 1 even for a new theme', () => {
  const many = userTurns('one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven');
  assert.equal(selectResponsePool('fear', [], many).tier, 2);
});

test('does not downgrade a repeatedly-mentioned theme for a long-time writer', () => {
  const many = [...userTurns('afraid', 'afraid', 'afraid'), ...userTurns('x', 'y', 'z', 'q', 'w', 'e', 'r', 't')];
  assert.equal(selectResponsePool('fear', [], many).tier, 3);
});

test('returns the theme as the pool name so pickResponse can look it up', () => {
  assert.equal(selectResponsePool('generic', [], []).pool, 'generic');
});