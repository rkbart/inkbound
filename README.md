# Inkbound: Living Enchanted Diary

> *"Secrets are safe within these pages..."*

**Inkbound** is an immersive, dark fantasy interactive web application. Users write thoughts onto aged parchment pages with ink. The words physically dissolve into the paper fibers, after which a living memory within the diary reads your entry, extracts personal memories and secrets, and writes back on the page in resurfacing ink.

---

## Features

- **AI-Powered Diary Character**: Powered by NVIDIA Nemotron 3.5 Lightning, the diary understands context, remembers your secrets, and responds in a formal 1940s British voice. Falls back to 250+ pre-written responses when no API key is set.
- **Interactive Antique Journal**: Realistically styled leather-bound diary with gold-embossed lettering, brass corner plates, and spine shadows.
- **Toggle Memory Visibility**: Eye icon button to hide or show the parchment memory ledger. Entries auto-scroll to the bottom when new ones appear.
- **Magic Ink Dissolve & Bleed Animation**: User input smoothly fades into parchment fibers before the diary's handwriting resurfaces character-by-character.
- **Memory Extraction & Personalization**: Automatically detects the user's name, secrets, fears, desires, and relationships. Weaves them into future responses for a personalized experience.
- **Procedural Web Audio Synthesizer**: Zero-asset audio engine using the Web Audio API to generate realistic pen scratches, paper flip rustles, magic ink dissolve shimmers, and deep ambient atmospheric drones.
- **User Authentication**: Username/password sign-in with persistent sessions via localStorage.
- **Offline Fallback**: Works without an API key using a built-in branching conversation tree system with ~250 curated responses.

---

## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, Web Audio API, Vanilla CSS (Custom Design System with self-hosted fonts: `Cinzel Decorative`, `IM Fell English`, `Marck Script`, `Playfair Display`)
- **Backend**: Vercel Serverless Functions (Node.js) + local dev server
- **AI**: NVIDIA Nemotron 3.5 Lightning via NIM API (OpenAI-compatible)
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
| `node scripts/setup-db.js` | Initializes the Turso database schema |

---

## How It Works

1. User writes on the parchment and presses Enter
2. The ink dissolves into the paper with a visual animation
3. The entry is sent to the backend along with conversation history and extracted memories
4. **With API key**: NVIDIA Nemotron understands the context and generates an intelligent, personalized response in the diary's 1940s British voice
5. **Without API key**: The pre-written branching conversation tree system selects a themed response
6. The response resurfaces character-by-character with ink bleed animations
7. Memories are extracted and persisted for future personalization

---

## Technical Documentation

For an in-depth explanation of system architecture, data schemas, and implementation details, please read [DOCUMENTATION.md](DOCUMENTATION.md).

---

## License

This project is open-source under the MIT License.
