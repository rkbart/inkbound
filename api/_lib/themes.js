const THEME_PATTERNS = {
  identity_question: {
    keywords: ['who are you', 'what is this', 'what are you', 'tell me about yourself', 'what is your name', "what's your name", 'do you have a name', 'tell me your name', 'introduce yourself'],
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
    /my name is\s+([a-zA-Z]+)/i,
    /\bi am\s+([a-zA-Z]+)/i,
    /\bcall me\s+([a-zA-Z]+)/i,
    /\bi'm\s+([a-zA-Z]+)/i,
    /\bi am called\s+([a-zA-Z]+)/i,
    /\bthey call me\s+([a-zA-Z]+)/i
  ];

  const commonWords = ['afraid', 'scared', 'worried', 'tired', 'happy', 'sad', 'angry', 'sure', 'fine', 'okay', 'lost', 'alone', 'here', 'there', 'now', 'then', 'not', 'never', 'always', 'very', 'really', 'just', 'also', 'still', 'already', 'even', 'quite', 'about', 'going', 'coming', 'feeling', 'thinking', 'trying', 'hoping', 'wondering', 'so', 'a', 'an', 'the', 'good', 'bad', 'new', 'old', 'big', 'small', 'one', 'two', 'three'];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const raw = match[1];
      if (commonWords.includes(raw.toLowerCase())) continue;
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
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

  const namePatterns = [
    /my name is\s+[a-z]/i,
    /\bi am\s+[a-z]/i,
    /\bcall me\s+[a-z]/i,
    /\bi'm\s+[a-z]/i,
    /\bi am called\s+[a-z]/i,
    /\bthey call me\s+[a-z]/i
  ];
  const isNameIntro = namePatterns.some(p => p.test(message));
  if (isNameIntro) {
    const name = extractNameFromMessage(message);
    if (name) {
      themes.push('name_intro');
      extracted.name = {
        category: 'Identity',
        key: 'User Name',
        value: name,
        importance: 5
      };
    }
  }

  for (const [theme, config] of Object.entries(THEME_PATTERNS)) {
    if (theme === 'name_intro') continue;
    const matched = config.keywords.some(kw => lower.includes(kw));
    if (matched) {
      themes.push(theme);

      if (config.category && config.key) {
        let value;
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

  if (themes.length === 0) {
    themes.push('generic');
  }

  return { themes, extracted };
}
