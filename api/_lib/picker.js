import { RESPONSES, getRandomSilentResponse } from './responses.js';

export function pickResponse(pool, tier, memories, personaName) {
  const poolResponses = RESPONSES[pool]?.[tier] || RESPONSES.generic[1];
  const chosen = poolResponses[Math.floor(Math.random() * poolResponses.length)];
  return personalize(chosen, memories, personaName);
}

export function pickSilentResponse() {
  return getRandomSilentResponse();
}

function personalize(text, memories, personaName) {
  const nameMem = memories.find(m => m.key === 'User Name');
  const name = nameMem ? nameMem.value : 'stranger';

  return text
    .replace(/{name}/g, name)
    .replace(/{personaName}/g, personaName);
}
