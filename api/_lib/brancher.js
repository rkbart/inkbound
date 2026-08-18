import { THEME_KEYWORDS } from './themes.js';

export function selectResponsePool(theme, memories, history) {
  const themeCount = countThemeInHistory(theme, history);
  const totalEntries = history.filter(h => h.role === 'user').length;

  let tier;
  if (themeCount === 0) {
    tier = 1;
  } else if (themeCount < 3) {
    tier = 2;
  } else {
    tier = 3;
  }

  if (totalEntries > 10 && tier === 1) {
    tier = 2;
  }

  return { pool: theme, tier };
}

function countThemeInHistory(theme, history) {
  const keywords = THEME_KEYWORDS[theme];
  if (!keywords) return 0;

  return history.filter(h => {
    if (h.role !== 'user') return false;
    const lower = h.content.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }).length;
}
