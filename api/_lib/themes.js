const THEME_PATTERNS = {
  identity_question: {
    keywords: ['who are you', 'what is this', 'what are you', 'tell me about yourself', 'what is your name', "what's your name", 'do you have a name', 'tell me your name', 'introduce yourself'],
    category: null,
    key: null,
    importance: 0
  },
  fear: {
    keywords: ['afraid', 'scared', 'fear', 'terrified', 'anxious', 'worried', 'dread', 'panic', 'frightened', 'nightmare'],
    category: 'Fear',
    key: 'Fear',
    importance: 4
  },
  love: {
    keywords: ['love', 'adore', 'cherish', 'passion', 'heart', 'fond', 'romance', 'beloved', 'infatuation'],
    category: 'Desire',
    key: 'Love Interest',
    importance: 4
  },
  secret: {
    keywords: ['secret', 'confession', 'never told', "don't tell", 'hidden', 'concealed', 'private', 'between us'],
    category: 'Secret',
    key: 'Confession',
    importance: 4
  },
  anger: {
    keywords: ['angry', 'furious', 'hate', 'rage', 'frustrated', 'bitter', 'resent', 'outraged', 'livid'],
    category: 'Secret',
    key: 'Anger Source',
    importance: 4
  },
  sadness: {
    keywords: ['sad', 'lonely', 'miss', 'grief', 'lost', 'alone', 'sorrow', 'mourn', 'weep', 'tears', 'hopeless', 'depressed', 'empty', 'hurting'],
    category: 'Fear',
    key: 'Sadness',
    importance: 3
  },
  hope: {
    keywords: ['hope', 'dream', 'wish', 'goal', 'aspire', 'future', 'want to be', 'ambition', 'someday'],
    category: 'Desire',
    key: 'Dream',
    importance: 3
  },
  magic: {
    keywords: ['magic', 'mystical', 'enchanted', 'supernatural', 'occult', 'ritual', 'spell', 'curse', 'divination'],
    category: 'Relationship',
    key: 'Magic Interest',
    importance: 3
  },
  daily_life: {
    keywords: ['today', 'morning', 'work', 'school', 'tired', 'busy', 'routine', 'lunch', 'evening', 'commute'],
    category: 'Fact',
    key: 'Daily Detail',
    importance: 2
  },
  relationship: {
    keywords: ['friend', 'family', 'mother', 'father', 'brother', 'sister', 'they said', 'my partner', 'colleague'],
    category: 'Relationship',
    key: 'Person Mentioned',
    importance: 3
  }
};

// Words that look like names after "I am" / "my name is" but aren't
const NAME_EXCLUSIONS = new Set([
  'afraid', 'scared', 'worried', 'tired', 'happy', 'sad', 'angry', 'sure', 'fine',
  'okay', 'lost', 'alone', 'here', 'there', 'now', 'then', 'not', 'never', 'always',
  'very', 'really', 'just', 'also', 'still', 'already', 'even', 'quite', 'about',
  'going', 'coming', 'feeling', 'thinking', 'trying', 'hoping', 'wondering', 'so',
  'a', 'an', 'the', 'good', 'bad', 'new', 'old', 'big', 'small', 'one', 'two',
  'three', 'running', 'eating', 'playing', 'working', 'leaving', 'coming', 'going',
  'looking', 'waiting', 'sitting', 'standing', 'writing', 'reading', 'talking',
  'listening', 'watching', 'starting', 'stopping', 'falling', 'rising', 'keeping',
  'making', 'taking', 'getting', 'having', 'being', 'doing', 'saying', 'telling',
  'asking', 'finding', 'giving', 'seeing', 'knowing', 'believing', 'remembering',
  'forgetting', 'hoping', 'fearing', 'loving', 'hating', 'needing', 'wanting',
  'liking', 'enjoying', 'suffering', 'struggling', 'managing', 'dealing',
  'better', 'worse', 'ready', 'able', 'unable', 'willing', 'done', 'finished',
  'late', 'early', 'wrong', 'right', 'enough', 'something', 'nothing', 'everything',
  'fearless', 'hopeless', 'homeless', 'selfish', 'selfless', 'careless', 'helpless',
  'useless', 'worthless', 'restless', 'speechless', 'breathless', 'endless', 'limitless',
  'furious', 'envious', 'jealous', 'curious', 'generous', 'nervous', 'conscious',
  'serious', 'obvious', 'famous', 'dangerous', 'mysterious', 'fabulous', 'marvelous',
  'terrible', 'horrible', 'wonderful', 'beautiful', 'graceful', 'painful', 'thankful',
  'suspicious', 'ambitious', 'reluctant', 'persistent', 'resistant', 'insistent',
  'determined', 'confused', 'amused', 'excited', 'surprised', 'disappointed',
  'committed', 'expected', 'suggested', 'required', 'preferred', 'proposed'
]);

const NAME_INTRO_PATTERNS = [
  /my name is\s+[a-z]/i,
  /\bi am\s+[a-z]/i,
  /\bcall me\s+[a-z]/i,
  /\bi'm\s+[a-z]/i,
  /\bi am called\s+[a-z]/i,
  /\bthey call me\s+[a-z]/i
];

// Build keyword lookup for tier counting in brancher.js
export const THEME_KEYWORDS = {};
for (const [theme, config] of Object.entries(THEME_PATTERNS)) {
  THEME_KEYWORDS[theme] = config.keywords;
}
// name_intro uses regex, but give brancher synthetic keywords for tier counting
THEME_KEYWORDS.name_intro = ['my name is', 'call me', "i'm", 'i am called', 'they call me'];

function matchesKeyword(message, keyword) {
  const lower = message.toLowerCase();
  // Multi-word keywords: substring match (e.g., "afraid of", "my name is")
  if (keyword.includes(' ')) {
    return lower.includes(keyword);
  }
  // Single-word keywords: exact word boundary match
  // "fear" should NOT match "fearless", "lovely" should NOT match "love"
  const regex = new RegExp(`\\b${keyword}\\b`, 'i');
  return regex.test(message);
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

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const raw = match[1];
      if (NAME_EXCLUSIONS.has(raw.toLowerCase())) continue;
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
        if (after.length > 0) return after.slice(0, 80);
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
  const themes = [];
  const extracted = {};

  const isNameIntro = NAME_INTRO_PATTERNS.some(p => p.test(message));
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
    const matched = config.keywords.some(kw => matchesKeyword(message, kw));
    if (matched) {
      themes.push(theme);

      if (config.category && config.key) {
        const value = extractContext(message, theme);
        if (value && value.length > 3) {
          extracted[theme] = {
            category: config.category,
            key: config.key,
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
