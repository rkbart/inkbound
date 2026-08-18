import { interactWithNemotron } from './nemotron.js';
import { detectThemes } from './themes.js';
import { dbService } from './db.js';
import { selectResponsePool } from './brancher.js';
import { pickResponse, pickSilentResponse } from './picker.js';

export async function interactWithDiary(userMessage, personaName = 'Tom Riddle', username = 'anonymous') {
  console.log('diary: calling nemotron');
  const nemotronResult = await interactWithNemotron(userMessage, personaName, username);
  if (nemotronResult) {
    console.log('diary: nemotron succeeded', { hasResponse: !!nemotronResult.response_text });
    return nemotronResult;
  }

  console.log('diary: nemotron failed, using fallback');
  return fallbackResponse(userMessage, personaName, username);
}

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
