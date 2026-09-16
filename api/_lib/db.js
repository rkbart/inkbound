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
    // Atomic upsert — requires the unique index on memories(username, key)
    // (see schema.sql: idx_memories_username_key). Replaces the old
    // check-then-insert pattern, which could race into duplicate rows.
    await execute(
      `INSERT INTO memories (username, category, key, value, importance)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(username, key) DO UPDATE SET
         value = excluded.value,
         category = excluded.category,
         importance = excluded.importance,
         last_seen = CURRENT_TIMESTAMP`,
      [username, category, key, value, importance]
    );
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

  // Deletes are always scoped by username so one user can never touch
  // another user's rows. Returns the number of rows removed.
  async deleteEntry(username, id) {
    const result = await execute(
      'DELETE FROM entries WHERE username = ? AND id = ?',
      [username, Number(id)]
    );
    return result.rowsAffected ?? 0;
  },

  async deleteMemory(username, id) {
    const result = await execute(
      'DELETE FROM memories WHERE username = ? AND id = ?',
      [username, Number(id)]
    );
    return result.rowsAffected ?? 0;
  },

  async updateMemory(username, id, fields) {
    const sets = [];
    const args = [];
    if (fields.value !== undefined) { sets.push('value = ?'); args.push(fields.value); }
    if (fields.category !== undefined) { sets.push('category = ?'); args.push(fields.category); }
    if (fields.importance !== undefined) { sets.push('importance = ?'); args.push(fields.importance); }
    if (sets.length === 0) return 0;
    sets.push('last_seen = CURRENT_TIMESTAMP');
    args.push(username, Number(id));
    const result = await execute(
      `UPDATE memories SET ${sets.join(', ')} WHERE username = ? AND id = ?`,
      args
    );
    return result.rowsAffected ?? 0;
  },

  async clearUserData(username) {
    await execute(
      'DELETE FROM entries WHERE username = ?',
      [username]
    );
    // 'Persona' rows are system-owned metadata and survive a reset.
    await execute(
      "DELETE FROM memories WHERE username = ? AND category != 'Persona'",
      [username]
    );
    await execute(
      'DELETE FROM conversation WHERE username = ?',
      [username]
    );
  }
};
