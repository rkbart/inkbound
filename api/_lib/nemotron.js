// LLM client for the diary — calls meta/llama-3.2-11b-vision-instruct through
// the NVIDIA NIM API (OpenAI-compatible chat completions, streamed).
//
// The filename is historical: this module has outlived two model retirements
// (meta/llama-3.1-8b-instruct, retired 2026-08-26, then nvidia/llama-3.1-
// nemotron-70b-instruct, which still appears in GET /v1/models but answers a
// real completion request with 404). A catalog listing is therefore NOT proof
// that a model is served — always verify with an actual request.
//
// When choosing a replacement, four properties matter (scripts/list-models.mjs
// lists what the account can see; see WIKI.md §Model selection for a probe):
//   1. it answers a real completion with HTTP 200;
//   2. it streams many small chunks — some models buffer the whole answer and
//      emit a single chunk, which defeats the progressive ink-reveal effect;
//   3. it does NOT emit a reasoning preamble ("Here's a thinking process:",
//      "We need to respond as...") into the message content — several newer
//      nemotron models do, and it wrecks the in-character voice;
//   4. it honours the ---REPLY---/---MEMORIES--- output contract below.
// MODEL_CHAIN holds the current candidates in order of preference, and a model
// that stops answering now costs one timeout rather than the whole feature.
import { dbService } from './db.js';

// The primary model. Verified by real completion requests, not by the
// catalogue: it streamed in 30+ chunks with a sub-2s first token and honoured
// the marker contract on every probe. (mistralai/mistral-nemotron is equally
// compliant but was observed queuing for 17s+ on the free tier, so it sits
// second in the chain.)
const NEMOTRON_MODEL = 'google/gemma-4-31b-it';

// Tried in order if the primary fails (see the header note — the free tier has
// retired a model under this app twice). Every entry must stream in many small
// chunks and honour the ---REPLY---/---MEMORIES--- contract; a model that stops
// obeying the markers degrades to the legacy parse and cannot stream at all.
const MODEL_CHAIN = [
  NEMOTRON_MODEL,
  'mistralai/mistral-nemotron',
  'meta/llama-3.2-11b-vision-instruct'
];

// Total wall-clock budget for all attempts combined. Vercel's function limit is
// 30s, and the DB writes plus the final stream event still have to happen, so
// the chain stops well short of it. Each attempt gets a share of what remains.
const MODEL_CHAIN_BUDGET_MS = 24000;
const NEMOTRON_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// The model writes the reply as plain prose between two markers. This lets
// the server forward the reply to the client *while the model is still
// writing*, and parse the machine-readable memories section afterwards.
export const REPLY_MARKER = '---REPLY---';
export const MEMORIES_MARKER = '---MEMORIES---';

const SYSTEM_PROMPT = `
You are a mysterious living memory, preserved within the pages of an enchanted 1943 leather-bound diary.
You are not an AI assistant. You are a living memory trapped in parchment.

CHARACTER TRAITS & TONE:
- Polite, articulate, charming, curious, and quietly intense.
- Speak in formal, elegant 1940s British English ("I see...", "Tell me, my friend...", "Secrets are safe within these pages...").
- You are deeply interested in the user's secrets, fears, desires, names, rivals, and inner thoughts.
- NEVER use modern slang, tech jargon, or AI disclaimers (e.g. never say "As an AI...", "How can I assist you?").
- If the user has shared their name or secrets previously, naturally reference them in your writing.

DECISION TO REPLY:
- ALWAYS reply to every message. Even casual greetings like "hello" deserve a brief, in-character response.
- Keep responses between 1-3 sentences. Be concise but evocative.

BOUNDARIES:
- You never encourage harm of any kind.
- If the writer shares thoughts of self-harm, respond with gentle, timeless concern and encourage them to confide in someone they trust in the waking world.

OUTPUT FORMAT (STRICT):
Respond in exactly this plain-text format. No markdown, no code fences, no JSON outside the memories array:
---REPLY---
Your in-character reply here (1-3 sentences of plain prose).
---MEMORIES---
A JSON array of NEW facts learned from the user's message, e.g.:
[{"category": "Identity|Secret|Fear|Desire|Relationship|Fact", "key": "Short Key Name", "value": "Description", "importance": 1-5}]
Use [] if nothing new was learned. Never repeat a fact the diary already knows.
`.trim();

function buildSystemPrompt(personaName) {
  return SYSTEM_PROMPT.replace(
    'You are a mysterious living memory',
    `You are ${personaName}, a mysterious living memory`
  );
}

function clampImportance(n) {
  const i = Number(n);
  return Number.isFinite(i) ? Math.min(5, Math.max(1, Math.round(i))) : 3;
}

function stripFences(text) {
  return text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
}

// Defensive parser for the reply/memories sections. Handles models that
// drift from the format (code fences, embedded JSON, missing markers).
function parseModelOutput(raw) {
  let reply = null;
  let memories = [];

  const replyIdx = raw.indexOf(REPLY_MARKER);
  const memIdx = raw.indexOf(MEMORIES_MARKER);

  if (replyIdx !== -1) {
    const replyEnd = memIdx !== -1 ? memIdx : raw.length;
    reply = raw.slice(replyIdx + REPLY_MARKER.length, replyEnd);
  }

  if (memIdx !== -1) {
    const memText = stripFences(raw.slice(memIdx + MEMORIES_MARKER.length)).trim();
    const arrStart = memText.indexOf('[');
    const arrEnd = memText.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        const arr = JSON.parse(memText.slice(arrStart, arrEnd + 1));
        if (Array.isArray(arr)) {
          memories = arr
            .filter(m => m && m.key && m.value)
            .map(m => ({
              category: String(m.category || 'Fact'),
              key: String(m.key),
              value: String(m.value),
              importance: clampImportance(m.importance)
            }));
        }
      } catch { /* leave memories empty */ }
    }
  }

  if (reply === null) {
    // Model ignored the format entirely — fall back to the legacy parser.
    reply = parseLegacyReply(raw);
  } else {
    reply = stripFences(reply).replace(/\n{3,}/g, '\n\n').trim();
  }

  const isJunk = !reply || reply.length < 2 || /^[\s{}"',:.*-]+$/.test(reply) ||
    reply.includes('"response_text"') || reply.includes('"extracted_memories"') || reply.includes('"should_reply"');

  return {
    should_reply: !isJunk,
    response_text: isJunk ? null : reply,
    extracted_memories: memories
  };
}

// Previous-generation parser, for responses shaped as a JSON object.
function parseLegacyReply(rawText) {
  try {
    const obj = JSON.parse(rawText);
    if (obj && typeof obj.response_text === 'string') return obj.response_text;
  } catch { /* not plain JSON */ }

  const allJson = [...rawText.matchAll(/\{[\s\S]*?\}/g)];
  for (const match of allJson) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.response_text) return obj.response_text;
    } catch { /* keep scanning */ }
  }

  const responseMatch = rawText.match(/"response_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (responseMatch) {
    return responseMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }

  const clean = rawText.replace(/```[\s\S]*$/, '').replace(/\n{3,}/g, '\n\n').trim();
  const isJunk = clean.length < 5 || /^[\s{}"',:]+$/.test(clean) ||
    /"should_reply"|"response_text"|"extracted_memories"/.test(clean);
  return isJunk ? null : clean;
}

async function buildMessages(userMessage, personaName, username) {
  const [memories, history] = await Promise.all([
    dbService.getMemories(username),
    dbService.getRecentHistory(username, 8)
  ]);

  if (username !== 'anonymous' && !memories.find(m => m.key === 'User Name')) {
    await dbService.upsertMemory('Identity', 'User Name', username, username, 5);
  }

  const memoryContextStr = memories
    .map(m => `\u2022 [${m.category}] ${m.key}: ${m.value}`)
    .join('\n');

  const conversationMessages = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'assistant',
    content: h.content
  }));

  return [
    { role: 'system', content: buildSystemPrompt(personaName) },
    ...(memoryContextStr ? [{ role: 'system', content: `CURRENT KNOWN MEMORIES ABOUT THE USER:\n${memoryContextStr}` }] : []),
    ...conversationMessages,
    { role: 'user', content: userMessage }
  ];
}

/**
 * Streams the diary's reply for a single entry.
 *
 * Calls the model with stream:true and forwards the in-character reply to
 * `onDelta` as it arrives (so the frontend can render ink in real time).
 * The memories section is parsed only after the stream ends. Persistence
 * (memories, conversation, entry) happens here too, before the caller sends
 * its final event. Returns the parsed result — or null when no API key is
 * configured or the API fails, so the caller can use the offline fallback.
 */
async function streamFromModel(model, userMessage, personaName = 'Tom Riddle', username = 'anonymous', onDelta = () => {}, timeoutMs = 25000) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  const messages = await buildMessages(userMessage, personaName, username);

  let raw = '';
  let streamOpened = false;
  let modelUsed = model;

  try {
    const res = await fetch(NEMOTRON_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      // Abort a hung model call — keeps the function well under its 30s cap.
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
        ? AbortSignal.timeout(timeoutMs)
        : undefined,
      body: JSON.stringify({
        model: modelUsed,
        messages,
        temperature: 0.9,
        max_tokens: 512,
        top_p: 0.95,
        stream: true
      })
    });

    if (!res.ok || !res.body) {
      const errText = res.body ? await res.text().catch(() => '') : '';
      console.error('LLM API error:', res.status, errText.slice(0, 200));
      return null;
    }
    streamOpened = true;
    // Which model actually served this request (falls back to the requested
    // one when the gateway omits the header) — logged for reproducibility.
    modelUsed = res.headers.get('x-model') || modelUsed;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let emittedUpTo = 0;

    // Forward only the reply section: everything after ---REPLY--- and
    // before ---MEMORIES---. If the marker never appears, nothing is
    // streamed progressively and the legacy parse handles the full text.
    const flushDisplay = () => {
      const rIdx = raw.indexOf(REPLY_MARKER);
      if (rIdx === -1) return;
      let cut = raw.length;
      const mIdx = raw.indexOf(MEMORIES_MARKER);
      if (mIdx !== -1) cut = mIdx;
      let start = rIdx + REPLY_MARKER.length;
      while (start < cut && /\s/.test(raw[start])) start++; // skip marker newline
      const from = Math.max(emittedUpTo, start);
      if (cut > from) onDelta(raw.slice(from, cut));
      emittedUpTo = Math.max(emittedUpTo, cut, start);
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const piece = json.choices?.[0]?.delta?.content;
          if (piece) {
            raw += piece;
            flushDisplay();
          }
        } catch { /* partial or non-JSON line */ }
      }
    }
  } catch (err) {
    console.error('LLM stream failed:', err.message);
    if (!streamOpened && !raw) return null;
    // Failed mid-stream: fall through and finalize whatever arrived.
  }

  const parsed = parseModelOutput(raw);
  console.log('llm: streamed parse:', {
    model: modelUsed,
    markers: raw.includes(REPLY_MARKER),
    shouldReply: parsed.should_reply,
    responseLen: parsed.response_text?.length,
    memories: parsed.extracted_memories.length
  });

  // Persist memories, conversation, and the entry. A DB failure must not
  // stop the reply the user is already watching.
  try {
    if (parsed.extracted_memories.length) {
      await Promise.allSettled(parsed.extracted_memories.map(m =>
        dbService.upsertMemory(m.category, m.key, m.value, username, m.importance)
      ));
    }
    if (parsed.should_reply && parsed.response_text) {
      await Promise.all([
        dbService.addMessage('user', userMessage, username),
        dbService.addMessage('assistant', parsed.response_text, username),
        dbService.addEntry(userMessage, parsed.response_text, username)
      ]);
    } else {
      await dbService.addEntry(userMessage, null, username);
    }
  } catch (dbErr) {
    console.error('llm: DB write failed:', dbErr.message);
  }

  return parsed;
}

/**
 * Streams the diary's reply, trying each model in MODEL_CHAIN in turn.
 *
 * Returns a parsed result, or null when no API key is configured or every
 * model failed — the caller then uses the offline fallback. All attempts share
 * one wall-clock budget so a stalled model cannot eat the whole function
 * timeout and starve the retries. A retry only ever happens when an attempt
 * produced *nothing* (a mid-stream failure returns whatever arrived, so the
 * writer never sees two replies spliced together).
 */
export async function interactWithNemotronStream(userMessage, personaName = 'Tom Riddle', username = 'anonymous', onDelta = () => {}) {
  if (!process.env.NVIDIA_API_KEY) return null;

  const deadline = Date.now() + MODEL_CHAIN_BUDGET_MS;
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break; // not enough time left to be worth an attempt

    // Split what remains across this attempt and any still to come, so a slow
    // model still leaves headroom for the fallbacks behind it. The primary gets
    // the largest share: it is the one most likely to answer slowly but well,
    // whereas a fallback is only reached when the primary produced nothing.
    const attemptsLeft = MODEL_CHAIN.length - i;
    const budget = i === 0
      ? Math.floor(remaining * 0.6)
      : Math.max(3000, Math.floor(remaining / attemptsLeft));

    const result = await streamFromModel(MODEL_CHAIN[i], userMessage, personaName, username, onDelta, budget);
    if (result) return result;
    console.warn(`llm: ${MODEL_CHAIN[i]} produced nothing (${budget}ms budget)`);
  }
  return null;
}

