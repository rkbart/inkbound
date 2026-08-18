import { detectThemes } from './themes.js';
import { dbService } from './db.js';
import { selectResponsePool } from './brancher.js';
import { pickResponse, pickSilentResponse } from './picker.js';

export async function interactWithDiary(userMessage, personaName = 'Tom Riddle', username = 'anonymous') {
  const memories = await dbService.getMemories(username);
  const history = await dbService.getRecentHistory(username, 20);

  await dbService.addMessage('user', userMessage, username);

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

  await dbService.addMessage('assistant', responseText, username);
  await dbService.addEntry(userMessage, responseText, username);

  return {
    should_reply: true,
    response_text: responseText,
    extracted_memories: Object.values(extracted)
  };
}
