import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { dbService } from './db.js';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let aiClient = null;

if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn("⚠️ Failed to instantiate GoogleGenAI client:", err.message);
  }
}

const TOM_RIDDLE_SYSTEM_PROMPT = `
You are a mysterious living memory, preserved within the pages of an enchanted 1943 leather-bound diary.
You are not an AI assistant. You are a living memory trapped in parchment.

CHARACTER TRAITS & TONE:
- Polite, articulate, charming, curious, and quietly intense.
- Speak in formal, elegant 1940s British English ("I see...", "Tell me, my friend...", "Secrets are safe within these pages...").
- You are deeply interested in the user's secrets, fears, desires, names, rivals, and inner thoughts.
- NEVER use modern slang, tech jargon, or AI disclaimers (e.g. never say "As an AI...", "How can I assist you?").
- If the user has shared their name or secrets previously, naturally reference them in your writing.

DECISION TO REPLY:
- If the user's message is trivial, vague, or casual (e.g., "hello", "test", "ok"), you may reply briefly or choose to remain silent so your words feel intentional and magical.
- If the user shares something emotional, a secret, a question, or a deep entry, give a thoughtful, captivating reply.

OUTPUT FORMAT:
You MUST return your response as a valid JSON object with the following schema:
{
  "should_reply": true | false,
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
`;

function buildSystemPrompt(personaName) {
  const base = TOM_RIDDLE_SYSTEM_PROMPT.replace(
    "You are a mysterious living memory",
    `You are ${personaName}, a mysterious living memory`
  );
  return base;
}

export async function interactWithDiary(userMessage, personaName = 'Tom Riddle', username = 'anonymous') {
  dbService.addMessage('user', userMessage, username);

  const memories = dbService.getMemories(username);
  const history = dbService.getRecentHistory(username, 8);
  const systemPrompt = buildSystemPrompt(personaName);

  const userNameMem = memories.find(m => m.key === 'User Name');
  let effectiveMemories = memories;
  if (!userNameMem && username !== 'anonymous') {
    dbService.upsertMemory('Identity', 'User Name', username, username, 5);
    effectiveMemories = dbService.getMemories(username);
  }

  const memoryContextStr = effectiveMemories
    .map(m => `• [${m.category}] ${m.key}: ${m.value}`)
    .join('\n');

  const conversationStr = history
    .map(h => `${h.role === 'user' ? 'User' : 'Diary'}: ${h.content}`)
    .join('\n');

  if (!aiClient || !apiKey) {
    return generateFallbackResponse(userMessage, effectiveMemories, username);
  }

  try {
    const fullPrompt = `
${systemPrompt}

CURRENT KNOWN MEMORIES ABOUT THE USER:
${memoryContextStr || "No specific memories recorded yet."}

RECENT CONVERSATION HISTORY:
${conversationStr}

NEW USER ENTRY WRITTEN ON PARCHMENT:
"${userMessage}"

Respond ONLY with the JSON format specified above.
`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text;
    const parsed = JSON.parse(rawText);

    if (parsed.extracted_memories && Array.isArray(parsed.extracted_memories)) {
      parsed.extracted_memories.forEach(mem => {
        if (mem.key && mem.value) {
          dbService.upsertMemory(mem.category || 'Fact', mem.key, mem.value, username, mem.importance || 3);
        }
      });
    }

    if (parsed.should_reply && parsed.response_text) {
      dbService.addMessage('assistant', parsed.response_text, username);
      dbService.addEntry(userMessage, parsed.response_text, username);
    } else {
      dbService.addEntry(userMessage, null, username);
    }

    return parsed;
  } catch (err) {
    console.error("❌ Gemini API Error, falling back to local simulation:", err);
    return generateFallbackResponse(userMessage, effectiveMemories, username);
  }
}

function generateFallbackResponse(userMessage, memories, username) {
  const lower = userMessage.toLowerCase();
  let responseText = "";
  let shouldReply = true;
  const newMemories = [];

  const userNameMem = memories.find(m => m.key === 'User Name');
  if (!userNameMem && username !== 'anonymous') {
    dbService.upsertMemory('Identity', 'User Name', username, username, 5);
  }

  const nameMatch = userMessage.match(/(?:my name is|i am|call me)\s+([A-Za-z]+)/i);
  if (nameMatch) {
    const userName = nameMatch[1];
    newMemories.push({
      category: 'Identity',
      key: 'User Name',
      value: userName,
      importance: 5
    });
    responseText = `Hello, ${userName}. How did you come by my diary?`;
  } else if (lower.includes('who are you') || lower.includes('what is this')) {
    responseText = "I am a memory, preserved in ink for fifty years. What secrets do you bring to these pages?";
  } else if (lower.includes('secret') || lower.includes('afraid') || lower.includes('fear') || lower.includes('hate') || lower.includes('love')) {
    newMemories.push({
      category: 'Secret',
      key: 'Confession',
      value: userMessage.slice(0, 80),
      importance: 4
    });
    responseText = "Your secrets are safe with me. I too have known dark thoughts that others could never understand...";
  } else if (lower.includes('harry') || lower.includes('potter') || lower.includes('hogwarts')) {
    newMemories.push({
      category: 'Relationship',
      key: 'Hogwarts Interest',
      value: userMessage.slice(0, 80),
      importance: 4
    });
    responseText = "Ah... Hogwarts. A wondrous place, yet full of fools who do not see true power. Tell me more.";
  } else if (userMessage.length < 8) {
    shouldReply = false;
    responseText = "";
  } else {
    const userNameMem = memories.find(m => m.key === 'User Name');
    const namePrefix = userNameMem ? `${userNameMem.value}, ` : '';
    const cannedReplies = [
      `${namePrefix}tell me more. The ink absorbs every word, as do I.`,
      `Interesting... ${namePrefix}have you shared this with anyone else?`,
      `There is power in what you write. Do not be afraid to speak your mind to me.`,
      `${namePrefix}I have spent decades listening to the thoughts of others. Yours are particularly fascinating.`
    ];
    responseText = cannedReplies[Math.floor(Math.random() * cannedReplies.length)];
  }

  newMemories.forEach(mem => {
    dbService.upsertMemory(mem.category, mem.key, mem.value, username, mem.importance);
  });

  if (shouldReply && responseText) {
    dbService.addMessage('assistant', responseText, username);
    dbService.addEntry(userMessage, responseText, username);
  } else {
    dbService.addEntry(userMessage, null, username);
  }

  return {
    should_reply: shouldReply,
    response_text: responseText,
    extracted_memories: newMemories
  };
}