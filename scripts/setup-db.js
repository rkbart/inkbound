import { connect } from "@tursodatabase/serverless";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are required.');
  process.exit(1);
}

const conn = connect({ url: TURSO_URL, authToken: TURSO_TOKEN });

const schema = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf-8');

const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log('Setting up Turso database schema...');

for (const stmt of statements) {
  try {
    const result = await conn.session.execute(stmt);
    console.log('  OK:', stmt.slice(0, 60) + (stmt.length > 60 ? '...' : ''));
  } catch (err) {
    console.error('  Failed:', stmt.slice(0, 60) + '...');
    console.error('  Error:', err.message);
  }
}

// Verify tables
try {
  const r = await conn.session.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  console.log('\nTables created:', r.rows.map(row => row[0]).join(', '));
} catch (err) {
  console.error('Verification failed:', err.message);
}

console.log('\nSchema setup complete.');
process.exit(0);
