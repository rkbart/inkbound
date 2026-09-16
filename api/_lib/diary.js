import { interactWithNemotronStream } from './nemotron.js';
import { detectThemes } from './themes.js';
import { dbService } from './db.js';
import { selectResponsePool } from './brancher.js';
import { pickResponse, pickSilentResponse } from './picker.js';

// Maximum characters accepted for a single diary entry. Enforced by the
// Vercel handler, the local dev server, and the frontend textarea.
export const MAX_CONTENT_LENGTH = 4000;

// Fallback engine (offline / no API key): detect themes, pick a curated
// response, and persist everything — mirroring what the AI path does.
async function fallbackResponse(userMessage, personaName, username) {
  const [memories, history] = await Promise.all([
    dbService.getMemories(username),
    dbService.getRecentHistory(username, 20)
  ]);

  if (username !== 'anonymous' && !memories.find(m => m.key === 'User Name')) {
    await dbService.upsertMemory('Identity', 'User Name', username, username, 5);
  }

  const { themes, extracted } = detectThemes(userMessage);

  for (const mem of Object.values(extracted)) {
    await dbService.upsertMemory(mem.category, mem.key, mem.value, username, mem.importance);
  }

  if (userMessage.length < 8 && !extracted.name && themes[0] === 'generic') {
    const silentResponse = pickSilentResponse();
    await dbService.addEntry(userMessage, silentResponse, username);
    return {
      should_reply: true,
      response_text: silentResponse,
      extracted_memories: []
    };
  }

  const primaryTheme = themes[0] || 'generic';
  const freshMemories = await dbService.getMemories(username);
  const pool = selectResponsePool(primaryTheme, freshMemories, history);
  const responseText = pickResponse(pool.pool, pool.tier, freshMemories, personaName);

  await Promise.all([
    dbService.addMessage('user', userMessage, username),
    dbService.addMessage('assistant', responseText, username),
    dbService.addEntry(userMessage, responseText, username)
  ]);

  return {
    should_reply: true,
    response_text: responseText,
    extracted_memories: Object.values(extracted)
  };
}

function writeNdjson(res, obj) {
  res.write(JSON.stringify(obj) + '\n');
}

/**
 * Streams one diary interaction to the client as newline-delimited JSON:
 *   {"t":"chunk","v":"<reply text delta>"}   (0..n times, in order)
 *   {"t":"done","should_reply":bool,"extracted_memories":[...]}
 *
 * Primary path: an LLM from MODEL_CHAIN via NVIDIA NIM, streamed — the reply
 * text is forwarded while the model is still writing. Fallback: the offline
 * branching-response engine (instant, sent as a single chunk). Persistence
 * happens inside either path BEFORE the done event, so the client's
 * post-stream refresh always sees the saved entry.
 */
export async function streamDiaryInteraction(res, userMessage, personaName = 'Tom Riddle', username = 'anonymous') {
  let streamed = false;
  let result = await interactWithNemotronStream(userMessage, personaName, username, (piece) => {
    streamed = true;
    writeNdjson(res, { t: 'chunk', v: piece });
  });

  if (!result) {
    result = await fallbackResponse(userMessage, personaName, username);
    if (result.should_reply && result.response_text) {
      streamed = true;
      writeNdjson(res, { t: 'chunk', v: result.response_text });
    }
  } else if (!streamed && result.should_reply && result.response_text) {
    // The model ignored the ---REPLY--- marker, so nothing could be forwarded
    // live. Deliver the reply now instead of dropping it — without this the
    // writer would see the "ink sinks quietly" placeholder for a real reply.
    writeNdjson(res, { t: 'chunk', v: result.response_text });
  }

  writeNdjson(res, {
    t: 'done',
    should_reply: !!result.should_reply && !!result.response_text,
    // Redundant with the chunk above, but it makes the stream self-contained:
    // a client that only reads the final event still gets the reply.
    response_text: result.response_text || null,
    extracted_memories: result.extracted_memories || []
  });
  res.end();
}
