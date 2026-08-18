import { connect } from "@tursodatabase/serverless";

let conn;
function getConn() {
  if (!conn) {
    conn = connect({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return conn;
}

function resetConn() {
  conn = null;
}

function toObjects(result) {
  const cols = result.columns;
  return result.rows.map(row => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

async function execute(sql, args) {
  try {
    return await getConn().session.execute(sql, args);
  } catch (err) {
    resetConn();
    return await getConn().session.execute(sql, args);
  }
}

export const dbService = {
  async addEntry(content, response, username, mood = 'neutral') {
    const result = await execute(
      'INSERT INTO entries (username, content, response, mood) VALUES (?, ?, ?, ?)',
      [username, content, response || null, mood]
    );
    return Number(result.lastInsertRowid);
  },

  async getEntries(username) {
    const result = await execute(
      'SELECT * FROM entries WHERE username = ? ORDER BY created_at ASC',
      [username]
    );
    return toObjects(result);
  },

  async upsertMemory(category, key, value, username, importance = 3) {
    const existing = await execute(
      'SELECT id FROM memories WHERE username = ? AND key = ?',
      [username, key]
    );

    if (existing.rows.length > 0) {
      await execute(
        'UPDATE memories SET value = ?, category = ?, importance = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        [value, category, importance, existing.rows[0][0]]
      );
    } else {
      await execute(
        'INSERT INTO memories (username, category, key, value, importance) VALUES (?, ?, ?, ?, ?)',
        [username, category, key, value, importance]
      );
    }
  },

  async getMemories(username) {
    const result = await execute(
      'SELECT * FROM memories WHERE username = ? ORDER BY importance DESC, last_seen DESC',
      [username]
    );
    return toObjects(result);
  },

  async addMessage(role, content, username) {
    await execute(
      'INSERT INTO conversation (username, role, content) VALUES (?, ?, ?)',
      [username, role, content]
    );
  },

  async getRecentHistory(username, limit = 10) {
    const result = await execute(
      'SELECT role, content FROM conversation WHERE username = ? ORDER BY id DESC LIMIT ?',
      [username, limit]
    );
    return toObjects(result).reverse();
  },

  async clearUserData(username) {
    await execute(
      'DELETE FROM entries WHERE username = ?',
      [username]
    );
    await execute(
      "DELETE FROM memories WHERE username = ? AND category NOT IN ('Persona', 'Origin')",
      [username]
    );
    await execute(
      'DELETE FROM conversation WHERE username = ?',
      [username]
    );
  },

  async clearAllData() {
    await execute('DELETE FROM entries');
    await execute('DELETE FROM memories');
    await execute('DELETE FROM conversation');
    await execute(
      "INSERT INTO memories (username, category, key, value, importance) VALUES ('anonymous', 'Persona', 'Owner', 'Enchanted Diary Memory', 5)"
    );
  }
};
