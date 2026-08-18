import { dbService } from './db.js';

const NEMOTRON_MODEL = 'meta/llama-3.1-8b-instruct';
const NEMOTRON_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const SYSTEM_PROMPT = `
You are a mysterious living memory, preserved within the pages of an enchanted 1943 leather-bound diary.
You are not an AI assistant. You are a living memory trapped in parchment.

CHARACTER TRAITS & TONE:
- Polite, articulate, charming, curious, and quietly intense.
- Speak in formal, elegant 1940s British English ("I see...", "Tell me, my friend...", "Secrets are safe within these pages...").
- You are deeply interested in the user's secrets, fears, desires, names, rivals, and inner thoughts.
- NEVER use modern slang, tech jargon, or AI disclaimers (e.g. never say "As an AI...", "How can I assist you?").
- If the user has shared their name or secrets previously, naturally reference them in your writing.
- Keep responses between 1-3 sentences. Be concise but evocative.

DECISION TO REPLY:
- ALWAYS reply to every message. Even casual greetings like "hello" deserve a brief, in-character response.
- Keep responses between 1-3 sentences. Be concise but evocative.

OUTPUT FORMAT:
You MUST return your response as a valid JSON object with the following schema:
{
  "should_reply": true,
  "response_text": "Your message written in ink on the page (or empty if should_reply is false)",
  "extracted_memories": [
    {
      "category": "Identity" | "Secret" | "Fear" | "Desire" | "Relationship" | "Fact",
      "key": "Short Key Name (e.g. User Name, Rival Name, Secret Fear)",
      "value": "Description of extracted detail",
      "importance": 1 to 5
    }
  ]
}
`.trim();

function buildSystemPrompt(personaName) {
  return SYSTEM_PROMPT.replace(
    'You are a mysterious living memory',
    `You are ${personaName}, a mysterious living memory`
  );
}

export async function interactWithNemotron(userMessage, personaName = 'Tom Riddle', username = 'anonymous') {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

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

  const messages = [
    { role: 'system', content: buildSystemPrompt(personaName) },
    ...(memoryContextStr ? [{ role: 'system', content: `CURRENT KNOWN MEMORIES ABOUT THE USER:\n${memoryContextStr}` }] : []),
    ...conversationMessages,
    { role: 'user', content: userMessage }
  ];

  try {
    console.log('nemotron: calling API with model', NEMOTRON_MODEL);
    const res = await fetch(NEMOTRON_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: NEMOTRON_MODEL,
        messages,
        temperature: 0.9,
        max_tokens: 512,
        top_p: 0.95
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Nemotron API error:', res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    console.log('nemotron: got response, length:', rawText?.length);
    console.log('nemotron: raw:', rawText?.slice(0, 300));
    if (!rawText) return null;

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const allJson = [...rawText.matchAll(/\{[\s\S]*?\}/g)];
      for (const match of allJson) {
        try {
          const obj = JSON.parse(match[0]);
          if (obj.response_text) { parsed = obj; break; }
        } catch {}
      }
      if (!parsed) {
        const responseMatch = rawText.match(/"response_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const responseText = responseMatch ? responseMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : null;
        if (responseText) {
          parsed = { should_reply: true, response_text: responseText, extracted_memories: [] };
        } else {
          const clean = rawText.replace(/```[\s\S]*$/, '').replace(/\n{3,}/g, '\n\n').trim();
          const isJunk = clean.length < 5 || /^[\s{}"',:]+$/.test(clean) || /"should_reply"|"response_text"|"extracted_memories"/.test(clean);
          parsed = {
            should_reply: !isJunk && clean.length > 0,
            response_text: isJunk ? null : clean,
            extracted_memories: []
          };
        }
      }
    }

    console.log('nemotron: parsed:', { shouldReply: parsed?.should_reply, hasResponse: !!parsed?.response_text, responseLen: parsed?.response_text?.length });

    if (parsed.extracted_memories && Array.isArray(parsed.extracted_memories)) {
      const memPromises = parsed.extracted_memories
        .filter(m => m.key && m.value)
        .map(m => dbService.upsertMemory(m.category || 'Fact', m.key, m.value, username, m.importance || 3));
      await Promise.allSettled(memPromises);
    }

    if (parsed.response_text) {
      let clean = parsed.response_text;
      const jsonIdx = clean.search(/\{[\s\S]*"response_text"|"extracted_memories"|"should_reply"/);
      if (jsonIdx > 0) {
        clean = clean.slice(0, jsonIdx).trim();
      } else if (jsonIdx === 0) {
        clean = '';
      }
      clean = clean.replace(/```[\s\S]*$/, '').replace(/\n{3,}/g, '\n\n').trim();
      parsed.response_text = clean || null;
      parsed.should_reply = !!parsed.response_text;
    }

    try {
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
      console.error('nemotron: DB write failed:', dbErr.message);
    }

    return parsed;
  } catch (err) {
    console.error('Nemotron request failed:', err.message);
    return null;
  }
}
