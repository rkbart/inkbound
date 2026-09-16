// Loads .env for the integration tests, mirroring what server-dev.js does for
// the dev server (the project has no dotenv dependency on purpose).
//
// Import this BEFORE reading TURSO_* from process.env: api/_lib/db.js reads the
// credentials lazily when it first connects, so as long as this runs at import
// time the credentials are in place before any query.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '..', '.env');

try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    // Real environment variables win, so CI can override the file.
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env file — the integration tests skip themselves.
}

// The integration tests import the DB layer, which would otherwise be a real
// network client. Setting this keeps the unit tests hermetic: nothing here
// reaches out unless credentials actually exist.
export const envLoaded = Boolean(process.env.TURSO_DATABASE_URL);
