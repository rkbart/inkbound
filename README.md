# Inkbound: Living Enchanted Diary

> *"Secrets are safe within these pages..."*

**Inkbound** is an immersive, dark fantasy interactive web application. Users write thoughts onto aged parchment pages with ink. The words physically dissolve into the paper fibers, after which a living memory within the diary reads your entry, extracts personal memories and secrets, and writes back on the page in resurfacing ink.

---

## Features

- **AI-Powered Diary Character**: Powered by a chain of LLMs on the NVIDIA NIM API (with automatic fallback if a model is unavailable), the diary understands context, remembers your secrets, and responds in a formal 1940s British voice — **streamed** onto the page as it writes. Falls back to 250+ pre-written responses when no model answers.
- **Interactive Antique Journal**: Realistically styled leather-bound diary with gold-embossed lettering, brass corner plates, and spine shadows.
- **Mobile Responsive**: Tabbed single-page view on mobile devices with responsive font scaling and touch-friendly controls.
- **Live Ink Streaming**: The diary's reply is forwarded chunk-by-chunk as the model thinks, and revealed character-by-character at handwriting speed.
- **Memory Bank You Control**: Browse everything the diary has learned ("What the Diary Knows"), rewrite a misheard detail, or erase a single memory — you are never locked out of your own data.
- **Diary Export & Tear-Out**: Export the whole diary as Markdown, or tear out individual pages from the ledger.
- **Toggle Memory Visibility**: Eye icon button to hide or show the parchment memory ledger. Entries auto-scroll to the bottom when new ones appear.
- **Magic Ink Dissolve & Bleed Animation**: User input smoothly fades into parchment fibers before the diary's handwriting resurfaces character-by-character.
- **Memory Extraction & Personalization**: Automatically detects the user's name, secrets, fears, desires, and relationships, then surfaces what it learned with a toast so personalization is never invisible.
- **Procedural Web Audio Synthesizer**: Zero-asset audio engine using the Web Audio API to generate realistic pen scratches, paper flip rustles, magic ink dissolve shimmers, and deep ambient atmospheric drones.
- **Name-Based Identity**: Simply type your name to access your diary. Each user gets their own persistent entries and persona, stored via localStorage.
- **Offline Fallback**: Works without an API key using a built-in branching conversation tree system with ~250 curated responses.

---

## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, Web Audio API, Vanilla CSS (Custom Design System with self-hosted fonts: `Cinzel Decorative`, `IM Fell English`, `Marck Script`, `Playfair Display`)
- **Backend**: Vercel Serverless Functions (Node.js) + local dev server
- **AI**: LLM chain via NVIDIA NIM API (OpenAI-compatible, streamed)
- **Database**: Turso (hosted SQLite via HTTP) with `@tursodatabase/serverless`
- **Fallback**: Pre-written branching conversation trees with 250+ curated responses

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Turso account**: Free tier at https://turso.tech
- **NVIDIA API key**: Free at https://build.nvidia.com (no credit card required)

### 2. Installation
```bash
git clone https://github.com/your-username/inkbound.git
cd inkbound
npm install
```

### 3. Get Your API Keys

**NVIDIA API key** (for AI responses):
1. Sign up at https://build.nvidia.com (free, no credit card)
2. Click "Get API Key" on any model card
3. Copy your key (starts with `nvapi-`)

**Turso database** (for persistent storage):
```bash
# Install Turso CLI (optional)
curl -sSfL https://get.tur.so/install.sh | bash

# Create database and get credentials
turso db create inkbound
turso db show inkbound --http-url    # TURSO_DATABASE_URL
turso db tokens create inkbound     # TURSO_AUTH_TOKEN

# Initialize schema
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."
node scripts/setup-db.js
```

### 4. Local Development
Create a `.env` file in the project root:
```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token
NVIDIA_API_KEY=nvapi-your-nvidia-key
```

Start the dev server:
```bash
npm run dev
```
Open `http://localhost:5173`. The local API server runs on port 3001.

### 5. Vercel Deployment
```bash
npm i -g vercel
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel env add NVIDIA_API_KEY
vercel --prod
```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local API server (port 3001) and Vite (port 5173) concurrently |
| `npm run build` | Bundles the React frontend for production |
| `npm run lint` | Runs `oxlint` for code quality |
| `npm test` | Runs the test suite (`node --test`): unit tests always; DB-backed integration tests when Turso credentials exist |
| `node scripts/setup-db.js` | Initializes the Turso database schema (idempotent; also creates indexes) |
| `node scripts/list-models.mjs` | Lists the NVIDIA models your API key can see (for choosing a model) |

---

## How It Works

1. Enter your name to access your personal diary
2. On desktop, the two-page parchment spread shows memory ledger (left) and writing (right)
3. On mobile, use the Memory/Write tab bar to switch between views
4. Write on the parchment and double-tap to submit
5. The ink dissolves into the paper with a visual animation
6. Skeleton loaders appear while the AI processes
7. The entry is sent to the backend along with conversation history and extracted memories
8. **With API key**: the model chain understands the context and streams an intelligent, personalized response in the diary's 1940s British voice — the ink appears as the model writes
9. **Without API key** (or if every model fails): The pre-written branching conversation tree system selects a themed response
10. The response is revealed character-by-character with ink bleed animations
11. Memories are extracted and persisted for future personalization, and a toast surfaces what the diary just learned

---

## Testing

The suite uses Node's built-in test runner — no test framework dependency:

```
tests/
├── unit/          # Pure functions, always runnable: NDJSON stream parsing,
│                  # chunkText invariant, the rate limiter (injectable clock),
│                  # theme detection, response picking, Markdown export
├── integration/   # The Vercel handlers (api/*.js) against real Turso, under
│                  # throwaway usernames; self-skips without TURSO_* creds
└── helpers/       # .env loader + mock req/res for the serverless handlers
```

The integration tests exercise `api/memories.js`, `api/entries.js` and `api/reset.js` directly — the files that actually run in production, which the dev server bypasses — and clean up every row they create.

### Rate limiting

`POST /api/interact` is the one endpoint that spends money (LLM calls), so it is guarded by a sliding-window limiter with two buckets: `IP + username` (fairness between writers sharing an address) and `IP alone` (the real abuse ceiling, since a client can invent new usernames freely). Exceeding either returns `429` with a `Retry-After` header, which the client relays in character. Defaults: 20/minute per name, 60/minute per IP, configurable via `RATE_LIMIT_PER_MINUTE` and `RATE_LIMIT_IP_PER_MINUTE`. Note the limiter is in-memory and per-instance — on Vercel the effective ceiling is roughly the limit times the number of warm instances; a durable limiter would need shared state (Turso or Redis).

---

### The diary replies but nothing appears to be written (or it answers too slowly)

The AI lives on NVIDIA's **free** NIM tier, which retires model IDs without warning. A retired model is not always removed from the catalogue, so `GET /v1/models` can list a model that answers a real request with `404`.

```bash
node scripts/list-models.mjs          # what this account can see
```

When choosing a replacement for `MODEL_CHAIN` in `api/_lib/nemotron.js`, verify **all four** properties with a real request:

1. it returns HTTP 200;
2. it **streams many small chunks** — some models buffer the entire answer into a single chunk, which removes the live ink effect;
3. it writes **no reasoning preamble** (`"Here's a thinking process: …"`) into the message content — this ruins the in-character voice;
4. it honours the `---REPLY---` / `---MEMORIES---` output contract.

The app is resilient to any single model failure: it walks the whole chain, and if every model fails it falls back to the curated response engine. If you see the *"ink sinks quietly into the parchment"* message for an entry that clearly deserved a reply, check the server log for `llm:` lines — they report which model answered (`model`), whether the markers were present (`markers: false` means the model ignored the contract), and the reply length.

### Running without an API key

Omit `NVIDIA_API_KEY` entirely and the app runs purely on the offline fallback engine — all features (memory extraction, persistence, personalization) still work.

---

## Technical Documentation

For an in-depth explanation of system architecture, data schemas, and implementation details, please read [DOCUMENTATION.md](DOCUMENTATION.md).

---

## License

This project is open-source under the MIT License.
