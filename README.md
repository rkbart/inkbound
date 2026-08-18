# Inkbound: Living Enchanted Diary

> *"Secrets are safe within these pages..."*

**Inkbound** is an immersive, dark fantasy interactive web application. Users write thoughts onto aged parchment pages with ink. The words physically dissolve into the paper fibers, after which the living memory within the diary reads your entry, extracts personal memories and secrets, and writes back on the page in resurfacing ink.

---

## Features

- **Interactive Antique Journal**: Realistically styled leather-bound diary with gold-embossed lettering, brass corner plates, spine shadows, and a ribbon bookmark.
- **Toggle Memory Visibility**: Eye icon button to hide or show the parchment memory ledger. Entries auto-scroll to the bottom when new ones appear.
- **Magic Ink Dissolve & Bleed Animation**: User input smoothly fades into parchment fibers before the diary's handwriting resurfaces character-by-character.
- **Branching Conversation Trees**: The diary detects themes (fear, love, secrets, anger, hope, etc.) and responds with curated responses that evolve over time. Responses reference previously extracted memories and create a sense of continuity.
- **Memory Extraction & Personalization**: Automatically detects the user's name, secrets, fears, desires, and relationships. Weaves them into future responses for a personalized experience.
- **Procedural Web Audio Synthesizer**: Zero-asset audio engine using the Web Audio API to generate realistic pen scratches, paper flip rustles, magic ink dissolve shimmers, and deep ambient atmospheric drones.
- **Horcrux Cursed Mode & Ribbon Drawer**: Toggle dark cursed visual effects, inspect absorbed memories in the Ribbon Drawer, or perform the "Obliviate" memory wipe.
- **Zero External Dependencies**: No API keys required. The diary works fully offline with pre-written response trees.

---

## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, Web Audio API, Vanilla CSS (Custom Design System with self-hosted fonts: `Cinzel Decorative`, `IM Fell English`, `Marck Script`, `Playfair Display`)
- **Backend**: Vercel Serverless Functions (Node.js) + local dev server (`server-dev.js`)
- **Database**: Turso (hosted SQLite via HTTP) with `@tursodatabase/serverless`
- **Response System**: Branching conversation trees with ~250 curated responses in 1940s British style

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Turso account**: Free tier at https://turso.tech

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/inkbound.git
cd inkbound
npm install
```

### 3. Turso Database Setup
Create a Turso database and get your credentials:
```bash
# Install Turso CLI (optional)
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create inkbound

# Get credentials
turso db show inkbound --http-url    # TURSO_DATABASE_URL
turso db tokens create inkbound     # TURSO_AUTH_TOKEN

# Initialize schema
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."
node scripts/setup-db.js
```

### 4. Local Development
Create a `.env` file in the project root with your Turso credentials:
```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

Then start the dev server (runs both API server and Vite):
```bash
npm run dev
```
Open your browser to `http://localhost:5173`. The local API server runs on port 3001 and Vite proxies `/api/*` requests to it.

### 5. Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN

# Deploy
vercel --prod
```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local API server (port 3001) and Vite dev server (port 5173) concurrently. |
| `npm run build` | Bundles the React frontend for production distribution into `/dist`. |
| `npm run lint` | Runs `oxlint` to perform code linting and syntax checks. |
| `npm run preview` | Previews the production build locally. |
| `node scripts/setup-db.js` | Initializes the Turso database schema. |

---

## Response System

The diary uses a branching conversation tree system with 12 detected themes:

| Theme | Detection | Memory Extracted |
|---|---|---|
| `name_intro` | Regex: "my name is X", "I am X", "call me X", "I'm X" | User's name (capitalized) |
| `identity_question` | "who are you", "what is your name", "do you have a name", "tell me about yourself" | None |
| `fear` | "afraid", "scared", "terrified", "dread", "nightmare" | Fear description |
| `love` | "love", "adore", "passion", "beloved" | Love interest |
| `secret` | "secret", "confession", "don't tell", "hidden" | Secret text |
| `anger` | "angry", "furious", "hate", "rage", "bitter" | Anger source |
| `sadness` | "sad", "lonely", "grief", "sorrow", "weep" | Sadness cause |
| `hope` | "hope", "dream", "wish", "aspire", "someday" | Dream/goal |
| `magic` | "magic", "enchanted", "supernatural", "spell", "curse" | Magic interest |
| `daily_life` | "today", "work", "morning", "routine", "commute" | Daily context |
| `relationship` | "friend", "family", "mother", "colleague" | Person mentioned |
| `generic` | anything else | None |

Each theme has 3 tiers of responses that deepen as the conversation progresses. Tier 1 is for first encounters, tier 2 after a few messages, tier 3 for deep familiarity.

---

## Technical Documentation

For an in-depth explanation of system architecture, data schemas, Web Audio API sound synthesis, and implementation details, please read [DOCUMENTATION.md](DOCUMENTATION.md).

---

## AI Skills & Development Guidelines

This project has been configured with AI agent skills to enhance code quality and development practices:

### Karpathy Guidelines
Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej Karpathy's observations on LLM coding pitfalls.

### Design Taste Skills
Anti-slop frontend design skills for landing pages, portfolios, and redesigns. 13 skills installed covering design patterns, anti-slop techniques, and performance guardrails.

---

## License

This project is open-source under the MIT License.
