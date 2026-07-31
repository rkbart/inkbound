import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const JSON_DB_PATH = path.join(DATA_DIR, 'db.json');

let db = null;
let useJsonFallback = false;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const initialData = {
  entries: [],
  memories: [
    { id: 1, category: 'Persona', key: 'Owner', value: 'Enchanted Diary Memory', importance: 5, last_seen: new Date().toISOString() }
  ],
  conversation: []
};

try {
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.join(DATA_DIR, 'inkbound.db');
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL DEFAULT 'anonymous',
      content TEXT NOT NULL,
      response TEXT,
      mood TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL DEFAULT 'anonymous',
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      importance INTEGER DEFAULT 3,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL DEFAULT 'anonymous',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = db.prepare("PRAGMA table_info(entries)").all();
  const hasUsername = columns.some(c => c.name === 'username');
  if (!hasUsername) {
    db.exec('ALTER TABLE entries ADD COLUMN username TEXT NOT NULL DEFAULT "anonymous"');
    db.exec('ALTER TABLE memories ADD COLUMN username TEXT NOT NULL DEFAULT "anonymous"');
    db.exec('ALTER TABLE conversation ADD COLUMN username TEXT NOT NULL DEFAULT "anonymous"');
    const anyOldEntries = db.prepare("SELECT COUNT(*) as cnt FROM entries").get().cnt;
    if (anyOldEntries > 0) {
      console.log('⚠️ Existing data found - user-scoped schemas added. Old entries marked anonymous.');
    }
  }

  const memCount = db.prepare("SELECT COUNT(*) as cnt FROM memories").get().cnt;
  if (memCount === 0) {
    const insertMem = db.prepare('INSERT INTO memories (username, category, key, value, importance) VALUES (?, ?, ?, ?, ?)');
    insertMem.run('anonymous', 'Persona', 'Owner', 'Enchanted Diary Memory', 5);
  }

  console.log('✅ SQLite database initialized successfully');
} catch (err) {
  console.warn('⚠️ SQLite load fallback to JSON DB due to:', err.message);
  useJsonFallback = true;

  if (!fs.existsSync(JSON_DB_PATH)) {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readJsonDB() {
  try {
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return initialData;
  }
}

function writeJsonDB(data) {
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
}

export const dbService = {
  addEntry(content, response, username, mood = 'neutral') {
    if (!useJsonFallback && db) {
      const stmt = db.prepare('INSERT INTO entries (username, content, response, mood) VALUES (?, ?, ?, ?)');
      const info = stmt.run(username, content, response, mood);
      return info.lastInsertRowid;
    } else {
      const json = readJsonDB();
      const newEntry = {
        id: Date.now(),
        username,
        content,
        response,
        mood,
        created_at: new Date().toISOString()
      };
      json.entries.push(newEntry);
      writeJsonDB(json);
      return newEntry.id;
    }
  },

  getEntries(username) {
    if (!useJsonFallback && db) {
      return db.prepare('SELECT * FROM entries WHERE username = ? ORDER BY created_at ASC').all(username);
    } else {
      const json = readJsonDB();
      return json.entries.filter(e => e.username === username);
    }
  },

  upsertMemory(category, key, value, username, importance = 3) {
    if (!useJsonFallback && db) {
      const existing = db.prepare('SELECT id FROM memories WHERE username = ? AND key = ?').get(username, key);
      if (existing) {
        db.prepare('UPDATE memories SET value = ?, category = ?, importance = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
          .run(value, category, importance, existing.id);
      } else {
        db.prepare('INSERT INTO memories (username, category, key, value, importance) VALUES (?, ?, ?, ?, ?)')
          .run(username, category, key, value, importance);
      }
    } else {
      const json = readJsonDB();
      const existingIdx = json.memories.findIndex(m => m.username === username && m.key.toLowerCase() === key.toLowerCase());
      if (existingIdx >= 0) {
        json.memories[existingIdx].value = value;
        json.memories[existingIdx].category = category;
        json.memories[existingIdx].importance = importance;
        json.memories[existingIdx].last_seen = new Date().toISOString();
      } else {
        json.memories.push({
          id: Date.now(),
          username,
          category,
          key,
          value,
          importance,
          last_seen: new Date().toISOString()
        });
      }
      writeJsonDB(json);
    }
  },

  getMemories(username) {
    if (!useJsonFallback && db) {
      return db.prepare('SELECT * FROM memories WHERE username = ? ORDER BY importance DESC, last_seen DESC').all(username);
    } else {
      const json = readJsonDB();
      return json.memories.filter(m => m.username === username);
    }
  },

  addMessage(role, content, username) {
    if (!useJsonFallback && db) {
      db.prepare('INSERT INTO conversation (username, role, content) VALUES (?, ?, ?)').run(username, role, content);
    } else {
      const json = readJsonDB();
      json.conversation.push({ id: Date.now(), username, role, content, created_at: new Date().toISOString() });
      writeJsonDB(json);
    }
  },

  getRecentHistory(username, limit = 10) {
    if (!useJsonFallback && db) {
      return db.prepare('SELECT role, content FROM conversation WHERE username = ? ORDER BY id DESC LIMIT ?').all(username, limit).reverse();
    } else {
      const json = readJsonDB();
      return json.conversation.filter(m => m.username === username).slice(-limit);
    }
  },

  clearUserData(username) {
    if (!useJsonFallback && db) {
      db.prepare('DELETE FROM entries WHERE username = ?').run(username);
      db.prepare("DELETE FROM memories WHERE username = ? AND category NOT IN ('Persona', 'Origin')").run(username);
      db.prepare('DELETE FROM conversation WHERE username = ?').run(username);
    } else {
      const json = readJsonDB();
      json.entries = json.entries.filter(e => e.username !== username);
      json.memories = json.memories.filter(m => m.username !== username && m.category === 'Persona');
      json.conversation = json.conversation.filter(c => c.username !== username);
      writeJsonDB(json);
    }
  },

  clearAllData() {
    if (!useJsonFallback && db) {
      db.exec('DELETE FROM entries; DELETE FROM memories; DELETE FROM conversation;');
    } else {
      writeJsonDB(initialData);
    }
  }
};