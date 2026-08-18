import { connect } from "@tursodatabase/serverless";

const conn = connect({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const dbService = {
  async addEntry(content, response, username, mood = 'neutral') {
    const stmt = conn.prepare('INSERT INTO entries (username, content, response, mood) VALUES (?, ?, ?, ?)');
    const result = stmt.run(username, content, response || null, mood);
    return Number(result.lastInsertRowid);
  },

  async getEntries(username) {
    const stmt = conn.prepare('SELECT * FROM entries WHERE username = ? ORDER BY created_at ASC');
    return stmt.all(username).rows;
  },

  async upsertMemory(category, key, value, username, importance = 3) {
    const existing = conn.prepare('SELECT id FROM memories WHERE username = ? AND key = ?').get(username, key);

    if (existing) {
      conn.prepare('UPDATE memories SET value = ?, category = ?, importance = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
        .run(value, category, importance, existing.id);
    } else {
      conn.prepare('INSERT INTO memories (username, category, key, value, importance) VALUES (?, ?, ?, ?, ?)')
        .run(username, category, key, value, importance);
    }
  },

  async getMemories(username) {
    const stmt = conn.prepare('SELECT * FROM memories WHERE username = ? ORDER BY importance DESC, last_seen DESC');
    return stmt.all(username).rows;
  },

  async addMessage(role, content, username) {
    conn.prepare('INSERT INTO conversation (username, role, content) VALUES (?, ?, ?)')
      .run(username, role, content);
  },

  async getRecentHistory(username, limit = 10) {
    const stmt = conn.prepare('SELECT role, content FROM conversation WHERE username = ? ORDER BY id DESC LIMIT ?');
    return stmt.all(username, limit).rows.reverse();
  },

  async clearUserData(username) {
    conn.prepare('DELETE FROM entries WHERE username = ?').run(username);
    conn.prepare("DELETE FROM memories WHERE username = ? AND category NOT IN ('Persona', 'Origin')").run(username);
    conn.prepare('DELETE FROM conversation WHERE username = ?').run(username);
  },

  async clearAllData() {
    conn.exec('DELETE FROM entries');
    conn.exec('DELETE FROM memories');
    conn.exec('DELETE FROM conversation');
    conn.prepare("INSERT INTO memories (username, category, key, value, importance) VALUES ('anonymous', 'Persona', 'Owner', 'Enchanted Diary Memory', 5)").run();
  }
};
