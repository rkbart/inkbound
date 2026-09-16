// Integration tests for the Vercel handlers in api/.
//
// These exist because server-dev.js has its own routing: the api/*.js files are
// what actually run in production, and nothing else in the suite touches them.
// A bug that only lived in a handler (the PATCH/DELETE username lookup, for
// example) would otherwise pass every other test and only appear on a deploy.
//
// They talk to the real Turso database, but only ever under throwaway
// usernames, and they clean up after themselves. When TURSO_* is absent the
// whole file skips, so `npm test` still works on a fresh clone.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/env.js';
import { callHandler, hasDbCredentials, testUsername } from '../helpers/http.js';
import memoriesHandler from '../../api/memories.js';
import entriesHandler from '../../api/entries.js';
import resetHandler from '../../api/reset.js';
import { dbService } from '../../api/_lib/db.js';

const skip = !hasDbCredentials
  ? 'no TURSO_DATABASE_URL / TURSO_AUTH_TOKEN — skipping DB-backed handler tests'
  : false;

test('handler tests', { skip }, async (t) => {
  const U = testUsername('handlers');
  const OTHER = testUsername('other');

  t.after(async () => {
    // Never leave test rows behind, even if an assertion failed mid-way.
    await dbService.clearUserData(U);
    await dbService.clearUserData(OTHER);
  });

  await t.test('seed: memories and an entry for the test user', async () => {
    await dbService.upsertMemory('Fear', 'Spiders', 'A dread of spiders', U, 4);
    await dbService.upsertMemory('Identity', 'User Name', U, U, 5);
    const entry = await dbService.addEntry('a seeded entry', 'a seeded reply', U);
    assert.ok(entry, 'expected addEntry to succeed');
  });

  await t.test('GET /api/memories reads the username from the query string', async () => {
    const res = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonPayload.length, 2);
    assert.ok(res.jsonPayload.every(m => typeof m.key === 'string'));
  });

  await t.test('PATCH /api/memories resolves the username from the BODY', async () => {
    // Regression: the handler once read only the query string, so a client that
    // sent the username in the JSON body edited the 'anonymous' partition
    // instead — the edit appeared to work, then vanished on the next refresh.
    const before = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    const target = before.jsonPayload.find(m => m.key === 'Spiders');

    const res = await callHandler(memoriesHandler, {
      method: 'PATCH',
      url: '/api/memories',
      body: { id: target.id, username: U, value: 'A dread of spiders and their webs' }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonPayload.updated, 1, 'expected exactly one row updated');

    const after = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    assert.equal(after.jsonPayload.find(m => m.id === target.id).value, 'A dread of spiders and their webs');
  });

  await t.test('PATCH /api/memories never writes to the anonymous partition', async () => {
    const res = await callHandler(memoriesHandler, { method: 'GET', url: '/api/memories?username=anonymous' });
    assert.equal(res.statusCode, 200);
    const leaked = res.jsonPayload.filter(m => m.key === 'Spiders' || String(m.value).includes('their webs'));
    assert.deepEqual(leaked, [], 'the edit leaked into another partition');
  });

  await t.test('DELETE /api/memories resolves the username from the BODY', async () => {
    const before = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    const target = before.jsonPayload.find(m => m.key === 'Spiders');

    const res = await callHandler(memoriesHandler, {
      method: 'DELETE',
      url: '/api/memories',
      body: { id: target.id, username: U }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonPayload.deleted, 1);

    const after = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    assert.equal(after.jsonPayload.find(m => m.id === target.id), undefined, 'memory was not actually deleted');
    assert.equal(after.jsonPayload.filter(m => m.key === 'User Name').length, 1, 'User Name must survive');
  });


  await t.test('DELETE /api/entries is scoped to the caller', async () => {
    const list = await callHandler(entriesHandler, { method: 'GET', url: `/api/entries?username=${U}` });
    assert.equal(list.statusCode, 200);
    const entryId = list.jsonPayload[0].id;

    const res = await callHandler(entriesHandler, {
      method: 'DELETE',
      url: '/api/entries',
      body: { id: entryId, username: U }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonPayload.deleted, 1);

    // The same id under a different name must delete nothing.
    await dbService.addEntry('second entry', 'second reply', U);
    const mine = await callHandler(entriesHandler, { method: 'GET', url: `/api/entries?username=${U}` });
    const id2 = mine.jsonPayload[0].id;
    const foreign = await callHandler(entriesHandler, {
      method: 'DELETE',
      url: '/api/entries',
      body: { id: id2, username: OTHER }
    });
    assert.equal(foreign.statusCode, 200);
    assert.equal(foreign.jsonPayload.deleted, 0, 'another user must not delete this entry');

    const still = await callHandler(entriesHandler, { method: 'GET', url: `/api/entries?username=${U}` });
    assert.equal(still.jsonPayload.length, 1);
  });

  await t.test('input validation rejects bad requests', async () => {
    let res = await callHandler(memoriesHandler, { method: 'PATCH', url: '/api/memories', body: { id: 'nope', username: U, value: 'x' } });
    assert.equal(res.statusCode, 400, 'non-numeric id');

    res = await callHandler(memoriesHandler, { method: 'PATCH', url: '/api/memories', body: { id: 1, username: U, value: '   ' } });
    assert.equal(res.statusCode, 400, 'blank value');

    res = await callHandler(memoriesHandler, { method: 'PATCH', url: '/api/memories', body: { id: 1, username: U, value: 'x'.repeat(501) } });
    assert.equal(res.statusCode, 400, 'over-long value');

    res = await callHandler(memoriesHandler, { method: 'PATCH', url: '/api/memories', body: { id: 1, username: U, category: 'Nonsense' } });
    assert.equal(res.statusCode, 400, 'unknown category');

    res = await callHandler(memoriesHandler, { method: 'PATCH', url: '/api/memories', body: { id: 1, username: U, importance: 9 } });
    assert.equal(res.statusCode, 400, 'importance out of range');

    res = await callHandler(entriesHandler, { method: 'DELETE', url: '/api/entries', body: { id: 1 } });
    assert.equal(res.statusCode, 400, 'delete without username');

    res = await callHandler(entriesHandler, { method: 'PUT', url: '/api/entries' });
    assert.equal(res.statusCode, 405, 'unsupported method');
  });

  await t.test('POST /api/reset refuses to wipe everything', async () => {
    // The dangerous case: no username at all. This must never clear the table.
    let res = await callHandler(resetHandler, { method: 'POST', url: '/api/reset', body: {} });
    assert.equal(res.statusCode, 400);

    res = await callHandler(resetHandler, { method: 'POST', url: '/api/reset', body: { username: '   ' } });
    assert.equal(res.statusCode, 400, 'blank username must be rejected too');

    // And the data is still there afterwards.
    const list = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    assert.ok(list.jsonPayload.length > 0, 'a rejected reset must not have cleared anything');
  });

  await t.test('POST /api/reset only clears the named user', async () => {
    await dbService.upsertMemory('Fact', 'Control', "must survive the other user's reset", U, 3);

    const res = await callHandler(resetHandler, { method: 'POST', url: '/api/reset', body: { username: OTHER } });
    assert.equal(res.statusCode, 200);

    const mine = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    // Two rows are expected: the Control memory just added, plus the User Name
    // memory that survived the delete in the test above.
    assert.equal(mine.jsonPayload.length, 2, "the other user's reset touched my rows");
    assert.ok(mine.jsonPayload.some(m => m.key === 'Control'), 'the Control memory was lost');
    assert.ok(mine.jsonPayload.some(m => m.key === 'User Name'), 'the User Name memory was lost');

    const wiped = await callHandler(resetHandler, { method: 'POST', url: '/api/reset', body: { username: U } });
    assert.equal(wiped.statusCode, 200);

    const after = await callHandler(memoriesHandler, { method: 'GET', url: `/api/memories?username=${U}` });
    const entries = await callHandler(entriesHandler, { method: 'GET', url: `/api/entries?username=${U}` });
    assert.deepEqual(after.jsonPayload, [], 'reset left memories behind');
    assert.deepEqual(entries.jsonPayload, [], 'reset left entries behind');
  });
});
