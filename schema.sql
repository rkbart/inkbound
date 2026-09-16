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

INSERT INTO memories (username, category, key, value, importance)
SELECT 'anonymous', 'Persona', 'Owner', 'Enchanted Diary Memory', 5
WHERE NOT EXISTS (SELECT 1 FROM memories WHERE key = 'Owner' AND category = 'Persona');

-- ---------------------------------------------------------------
-- Deduplicate memories (keep lowest id per username+key) before
-- applying the unique index below. Idempotent: only removes rows
-- that would violate the index.
-- ---------------------------------------------------------------
DELETE FROM memories WHERE id NOT IN
  (SELECT MIN(id) FROM memories GROUP BY username, key);

-- Integrity + performance indexes. The unique index lets
-- db.upsertMemory() use a single atomic INSERT ... ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_username_key ON memories(username, key);
CREATE INDEX IF NOT EXISTS idx_entries_username_created ON entries(username, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_username_id ON conversation(username, id);
