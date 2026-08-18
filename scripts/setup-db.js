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
  console.error('Run: export TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..."');
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
    conn.exec(stmt);
    console.log('  OK:', stmt.slice(0, 60) + (stmt.length > 60 ? '...' : ''));
  } catch (err) {
    console.error('  Failed:', stmt.slice(0, 60) + '...');
    console.error('  Error:', err.message);
  }
}

console.log('Schema setup complete.');
process.exit(0);
