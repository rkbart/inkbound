import { dbService } from './db.js';

const NEMOTRON_MODEL = 'meta/llama-3.1-70b-instruct';
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
- If the user's message is trivial, vague, or casual (e.g., "hello", "test", "ok"), you may reply briefly or choose to remain silent so your words feel intentional and magical.
- If the user shares something emotional, a secret, a question, or a deep entry, give a thoughtful, captivating reply.

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

  await dbService.addMessage('user', userMessage, username);

  const memories = await dbService.getMemories(username);
  const history = await dbService.getRecentHistory(username, 8);

  const userNameMem = memories.find(m => m.key === 'User Name');
  if (!userNameMem && username !== 'anonymous') {
    await dbService.upsertMemory('Identity', 'User Name', username, username, 5);
  }

  const freshMemories = await dbService.getMemories(username);

  const memoryContextStr = freshMemories
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
      console.error('Nemotron API error:', res.status, errText);
      return null;
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
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
        const clean = rawText.replace(/^[\s\S]*?(?:response_text["\s:]+)/i, '').replace(/["',].*$/m, '').trim();
        parsed = { should_reply: true, response_text: clean || "The ink stirs... but words escape me.", extracted_memories: [] };
      }
    }

    if (parsed.extracted_memories && Array.isArray(parsed.extracted_memories)) {
      for (const mem of parsed.extracted_memories) {
        if (mem.key && mem.value) {
          await dbService.upsertMemory(mem.category || 'Fact', mem.key, mem.value, username, mem.importance || 3);
        }
      }
    }

    if (parsed.should_reply && parsed.response_text) {
      await dbService.addMessage('assistant', parsed.response_text, username);
      await dbService.addEntry(userMessage, parsed.response_text, username);
    } else {
      await dbService.addEntry(userMessage, null, username);
    }

    return parsed;
  } catch (err) {
    console.error('Nemotron request failed:', err.message);
    return null;
  }
}
