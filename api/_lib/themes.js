const THEME_PATTERNS = {
  name_intro: {
    keywords: ['my name is', 'i am', 'call me', "i'm", 'i am called', 'they call me'],
    category: 'Identity',
    key: 'User Name',
    importance: 5,
    extractName: true
  },
  identity_question: {
    keywords: ['who are you', 'what is this', 'what are you', 'tell me about yourself'],
    category: null,
    key: null,
    importance: 0,
    extractName: false
  },
  fear: {
    keywords: ['afraid', 'scared', 'fear', 'terrified', 'anxious', 'worried', 'dread', 'panic', 'frightened', 'nightmare'],
    category: 'Fear',
    key: 'Fear',
    importance: 4,
    extractName: false
  },
  love: {
    keywords: ['love', 'adore', 'cherish', 'passion', 'heart', 'fond', 'romance', 'beloved', 'infatuation'],
    category: 'Desire',
    key: 'Love Interest',
    importance: 4,
    extractName: false
  },
  secret: {
    keywords: ['secret', 'confession', 'never told', "don't tell", 'hidden', 'concealed', 'private', 'between us'],
    category: 'Secret',
    key: 'Confession',
    importance: 4,
    extractName: false
  },
  anger: {
    keywords: ['angry', 'furious', 'hate', 'rage', 'frustrated', 'bitter', 'resent', 'outraged', 'livid'],
    category: 'Secret',
    key: 'Anger Source',
    importance: 4,
    extractName: false
  },
  sadness: {
    keywords: ['sad', 'lonely', 'miss', 'grief', 'lost', 'alone', 'sorrow', 'mourn', 'weep', 'tears'],
    category: 'Fear',
    key: 'Sadness',
    importance: 3,
    extractName: false
  },
  hope: {
    keywords: ['hope', 'dream', 'wish', 'goal', 'aspire', 'future', 'want to be', 'ambition', 'someday'],
    category: 'Desire',
    key: 'Dream',
    importance: 3,
    extractName: false
  },
  magic: {
    keywords: ['magic', 'mystical', 'enchanted', 'supernatural', 'occult', 'ritual', 'spell', 'curse', 'divination'],
    category: 'Relationship',
    key: 'Magic Interest',
    importance: 3,
    extractName: false
  },
  daily_life: {
    keywords: ['today', 'morning', 'work', 'school', 'tired', 'busy', 'routine', 'lunch', 'evening', ' commute'],
    category: 'Fact',
    key: 'Daily Detail',
    importance: 2,
    extractName: false
  },
  relationship: {
    keywords: ['friend', 'family', 'mother', 'father', 'brother', 'sister', 'they said', 'my partner', 'colleague'],
    category: 'Relationship',
    key: 'Person Mentioned',
    importance: 3,
    extractName: false
  }
};

export const THEME_KEYWORDS = {};
for (const [theme, config] of Object.entries(THEME_PATTERNS)) {
  THEME_KEYWORDS[theme] = config.keywords;
}

function extractNameFromMessage(message) {
  const patterns = [
    /my name is\s+([A-Z][a-z]+)/i,
    /\bi am\s+([A-Z][a-z]+)/i,
    /\bcall me\s+([A-Z][a-z]+)/i,
    /\bi'm\s+([A-Z][a-z]+)/i,
    /\bi am called\s+([A-Z][a-z]+)/i,
    /\bthey call me\s+([A-Z][a-z]+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractContext(message, theme) {
  const lower = message.toLowerCase();

  if (theme === 'fear') {
    const fearPatterns = ['afraid of', 'scared of', 'fear of', 'terrified of', 'frightened by'];
    for (const p of fearPatterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) {
        return message.slice(idx + p.length).trim().slice(0, 80);
      }
    }
  }

  if (theme === 'love') {
    const lovePatterns = ['love', 'adore', 'care about', 'fond of'];
    for (const p of lovePatterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) {
        const after = message.slice(idx).trim();
        if (after.length > 10) return after.slice(0, 80);
      }
    }
  }

  if (theme === 'anger') {
    const angerPatterns = ['angry at', 'angry about', 'furious about', 'hate', 'frustrated with'];
    for (const p of angerPatterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) {
        return message.slice(idx + p.length).trim().slice(0, 80);
      }
    }
  }

  if (theme === 'sadness') {
    const sadPatterns = ['miss', 'lost', 'alone', 'lonely', 'grief', 'sorrow'];
    for (const p of sadPatterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) {
        return message.slice(idx).trim().slice(0, 80);
      }
    }
  }

  if (theme === 'hope') {
    const hopePatterns = ['hope to', 'dream of', 'wish to', 'goal is', 'want to be', 'aspire to'];
    for (const p of hopePatterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) {
        return message.slice(idx).trim().slice(0, 80);
      }
    }
  }

  if (theme === 'relationship') {
    const relPatterns = ['my friend', 'my mother', 'my father', 'my brother', 'my sister', 'my partner', 'my colleague'];
    for (const p of relPatterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) {
        return message.slice(idx).trim().slice(0, 80);
      }
    }
  }

  return message.slice(0, 80);
}

export function detectThemes(message) {
  const lower = message.toLowerCase();
  const themes = [];
  const extracted = {};

  for (const [theme, config] of Object.entries(THEME_PATTERNS)) {
    const matched = config.keywords.some(kw => lower.includes(kw));
    if (matched) {
      themes.push(theme);

      if (config.category && config.key) {
        let value;

        if (theme === 'name_intro') {
          value = extractNameFromMessage(message);
          if (value) {
            extracted.name = {
              category: config.category,
              key: config.key,
              value: value,
              importance: config.importance
            };
          }
        } else {
          value = extractContext(message, theme);
          if (value && value.length > 3) {
            const memoryKey = `${config.key}`;
            extracted[theme] = {
              category: config.category,
              key: memoryKey,
              value: value,
              importance: config.importance
            };
          }
        }
      }
    }
  }

  if (themes.length === 0) {
    themes.push('generic');
  }

  return { themes, extracted };
}
