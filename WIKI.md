# Inkbound — Complete Codebase Wiki

A beginner-friendly guide to understanding how **Inkbound**, an AI-powered "living diary" web app, is built, why it's built that way, and how every piece fits together.

> Read this alongside `README.md` (setup guide) and `DOCUMENTATION.md` (the original technical doc). This wiki goes deeper on *why* decisions were made and walks the code file-by-file.

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [Tech Stack & Why It Was Chosen](#2-tech-stack--why-it-was-chosen)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Directory Structure](#4-directory-structure)
5. [The Full App Flow (Step by Step)](#5-the-full-app-flow-step-by-step)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Backend Deep Dive](#7-backend-deep-dive)
8. [Database Schema](#8-database-schema)
9. [Architectural Decisions Explained](#9-architectural-decisions-explained)
10. [Environment Variables & Tooling](#10-environment-variables--tooling)
11. [Ideas for Extending This Project](#11-ideas-for-extending-this-project)

---

## 1. What Is This Project?

Inkbound is an immersive, dark-fantasy interactive diary (inspired by Tom Riddle's diary from Harry Potter). The experience:

1. You **type your name** to unlock your personal diary (no password — the name *is* your identity).
2. You **write a thought** on a parchment page in "ink".
3. Your words **dissolve into the paper** with an animation and sound.
4. A **living memory inside the diary reads your entry** and writes back — its answer resurfaces character-by-character in glowing ink.
5. The diary **extracts facts about you** (name, fears, secrets, desires) and remembers them across sessions, personalizing everything it writes.

There are two "brains" behind the diary:

- **Primary (online)**: an LLM (Llama 3.1 8B Instruct, via NVIDIA's free NIM API) generates real, contextual, in-character replies.
- **Fallback (offline)**: a hand-written engine of ~250 curated responses organized into themed "conversation trees" — so the app *never* breaks, even with zero API keys.

Everything the user writes, and everything the diary learns, is stored in a hosted SQLite database (Turso) so it persists between visits.

---

## 2. Tech Stack & Why It Was Chosen

| Layer | Technology | Why |
|---|---|---|
| UI | **React 19** | Component model fits the app's clear screen states (login → cover → spread); hooks make the animation/state choreography readable. |
| Build tool | **Vite 8** | Near-instant dev server + HMR; minimal config; the de-facto standard for new React apps. |
| Icons | **lucide-react** | Tree-shakeable SVG icons; only ships the icons you import. |
| Audio | **Web Audio API** (no library) | Sounds are *synthesized procedurally* (noise buffers + oscillators + filters) — zero audio files to download, fully custom. |
| Styling | **Vanilla CSS** (`src/index.css`, ~1000 lines) | Full control over the intricate "leather + parchment + ink" visual effects (gradients, keyframes, `@font-face`) without fighting a framework. |
| Backend (prod) | **Vercel Serverless Functions** (`api/*.js`) | Deploys with the frontend for free; each endpoint is an isolated, autoscaling function. |
| Backend (dev) | **Plain Node `http` server** (`server-dev.js`) | Mimics the serverless routes locally without any framework; shares the *exact same* business-logic modules. |
| Database | **Turso** (hosted SQLite over HTTP) via `@tursodatabase/serverless` | Free tier, serverless-friendly (HTTP, no TCP connections to leak), SQL-simple for a small schema. |
| AI | **Llama 3.1 8B Instruct** via **NVIDIA NIM API** | Free API key, OpenAI-compatible chat-completions endpoint. |
| Linting | **oxlint** | Extremely fast Rust-based linter, configured for React rules-of-hooks. |
| Dev orchestration | **concurrently** | One `npm run dev` boots the local API server *and* Vite together. |

Notable *absences* (deliberate choices):

- **No router** (react-router) — the app has exactly 3 views controlled by state, not URLs.
- **No state library** (Redux/Zustand) — `useState` + prop passing is enough at this size.
- **No CSS framework** — the aesthetic is too bespoke for utility classes.
- **No test framework** — a good "exercise for the reader" (see §11).

---

## 3. High-Level Architecture

```
┌────────────────────────── BROWSER ──────────────────────────┐
│  React App (Vite, port 5173)                                │
│  ├── LoginPage ──► name stored in localStorage              │
│  ├── BookCover ──► "click to open"                          │
│  └── ParchmentSpread                                        │
│       ├── left page: entries ledger (paginated)             │
│       ├── right page: write / sink ink / read reply         │
│       └── diaryAudio (Web Audio synthesizer, utils/audio.js)│
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch('/api/...')  — relative path
              ┌────────────▼────────────┐
              │  Dev: Vite proxy ───────┼──► server-dev.js (port 3001)
              │  Prod: Vercel routes ───┼──► api/*.js serverless functions
              └────────────┬────────────┘
                           │ import { ... } from './_lib/*'   ◄── SHARED LOGIC
          ┌────────────────▼─────────────────────┐
          │ api/_lib/                            │
          │  diary.js ──── the orchestrator      │
          │     ├─ nemotron.js ──► NVIDIA NIM API│ (primary)
          │     └─ themes/brancher/picker ───────┤ (fallback)
          │  db.js ──────────────► Turso (SQLite)│
          └──────────────────────────────────────┘
```

Key idea: **one shared `_lib` directory powers both backends.** The Vercel functions (`api/interact.js`) and the local dev server (`server-dev.js`) are thin HTTP wrappers; all real logic lives in `api/_lib/`. This means local development exercises exactly the same code that runs in production.

---

## 4. Directory Structure

```
inkbound/
├── index.html                 # Single HTML page; React mounts into #root
├── vite.config.js             # Vite + React plugin + /api proxy → :3001
├── vercel.json                # Prod: build dist/, treat api/*.js as functions (30s max)
├── package.json               # Scripts: dev (concurrently), build, lint
├── .env                       # Secrets (gitignored) — see §10
├── schema.sql                 # DDL for the 3 database tables
├── scripts/setup-db.js        # Applies schema.sql to Turso
├── server-dev.js              # Local Node API server (port 3001), mirrors api/ routes
├── api/                       # === PRODUCTION BACKEND (Vercel functions) ===
│   ├── interact.js            # POST /api/interact — the diary conversation endpoint
│   ├── entries.js             # GET  /api/entries   — fetch a user's entries
│   ├── memories.js            # GET  /api/memories  — fetch a user's memory bank
│   ├── reset.js               # POST /api/reset     — clear a user's data
│   └── _lib/                  # Shared business logic (used by BOTH backends)
│       ├── diary.js           # Orchestrator: try AI, else fallback; persists results
│       ├── nemotron.js        # LLM client (prompt building + robust JSON parsing)
│       ├── themes.js          # Keyword/regex engine: theme detection + extraction
│       ├── responses.js       # ~250 curated responses + silent responses
│       ├── brancher.js        # Picks response "tier" based on conversation history
│       ├── picker.js          # Picks a response from a pool, personalizes {name}
│       └── db.js              # Turso client: lazy connect, retry, all SQL queries
├── src/                       # === FRONTEND ===
│   ├── main.jsx               # React 19 bootstrap (StrictMode)
│   ├── App.jsx                # Root state: user, entries, memories, settings
│   ├── index.css              # Entire design system (~1036 lines)
│   ├── components/
│   │   ├── LoginPage.jsx      # Name entry / returning-user screen
│   │   ├── BookCover.jsx      # Closed leather book (click to open)
│   │   ├── ParchmentSpread.jsx# Main 2-page spread: ledger + writer (~311 lines)
│   │   ├── TomRiddleWriter.jsx# Character-by-character ink reveal component
│   │   └── MemoryModal.jsx    # Overlay listing extracted memories
│   └── utils/audio.js         # DiaryAudioEngine class (procedural sound)
├── public/fonts/              # Self-hosted fonts (Cinzel, IM Fell, Marck, Playfair)
└── data/inkbound.db           # Local SQLite file (dev artifact)
```

---

## 5. The Full App Flow (Step by Step)

### A. First visit

1. `src/main.jsx` renders `<App />` into `#root`.
2. `App` runs a `useEffect` that checks `localStorage['inkbound_user']`. Nothing there → renders `<LoginPage />`.
3. User types a name → `LoginPage` saves `{ username, createdAt }` to localStorage and calls `onLogin(user)`.
4. `App.handleLogin`: sets `user`, opens the book, plays a **page-flip sound**, starts the **ambient drone**.
5. Two `useEffect`s fire: one loads the user's persona name (`inkbound_persona_<username>`), one fetches entries + memories from the API.
6. `<BookCover />` shows; clicking it opens `<ParchmentSpread />`.

### B. Writing an entry (the core loop)

1. User types into the parchment textarea (`ParchmentSpread`). Every keystroke plays a **pen scratch** sound.
2. Submit (Enter, or **double-click** the page — "double tap to let paper absorb your words").
3. `handleSinkIntoPaper` runs:
   - Sets `isSinking=true` → the `.ink-sinking` CSS class blurs/fades/shrinks the text over **1.8 s**.
   - Plays the **ink sink** sound (a sine sweep dropping 320 Hz → 80 Hz).
   - After the 1.8 s timeout: clears input, switches to the response view, shows **skeleton loaders**.
4. Calls `onInteract(currentMessage)` → `App.handleInteract` → `POST /api/interact` with `{ content, personaName, username }`.
5. **On the server** (see §7 for detail): the orchestrator tries the LLM; if unavailable, uses the fallback engine. Either way it saves the entry, conversation turn, and any extracted memories to Turso, then returns `{ should_reply, response_text, extracted_memories }`.
6. Back in the browser: a **minimum 800 ms** "thinking" floor is enforced so skeletons don't flash, then the reply is handed to `<TomRiddleWriter />`.
7. `TomRiddleWriter` reveals the reply **one character every 45 ms**, wrapping each char in a `<span class="ink-bleed-char">` with staggered animation delays, playing a subtle scratch every 3rd character. An **ink resurface** sound (110→260 Hz triangle sweep) plays at the start.
8. `App` re-fetches entries and memories so the left-page ledger updates.
9. Double-clicking the page again returns to the writing view.

### C. Memory & settings

- The left page shows a paginated **entry ledger** (3 per page, auto-jumps to the last page when new entries arrive).
- `MemoryModal` can display the extracted **memory bank** (`[Category] Key: value` badges).
- Settings panel (rendered in `App.jsx`): change the **persona name** (renames the diary character, persisted per-user in localStorage), **clear memory** (`POST /api/reset` — deletes entries/conversation, preserves Persona/Origin memories), or **log out**.
- Graceful degradation everywhere: if the backend is unreachable, fetches fail silently (`console.warn`) and the diary still works with a local fallback reply.

---

## 6. Frontend Deep Dive

### 6.1 Entry point & root component

**`src/main.jsx`** — 9 lines. Standard React 19 bootstrap with `StrictMode` (which double-invokes effects in dev — something to know when debugging sound/duplicate effects).

**`src/App.jsx`** — the "state owner". All top-level state lives here:

| State | Purpose |
|---|---|
| `user` | `{ username, createdAt }` from localStorage, or `null` (= show login) |
| `isOpen` | Book cover (false) vs. spread (true) |
| `entries` | Array of `{ id, content, response, created_at }` from `/api/entries` |
| `memories` | Extracted memory bank from `/api/memories` |
| `isLoading` | True while `/api/interact` is in flight |
| `personaName` | The diary character's name (default `'Tom'`) |
| `showSettings` | Settings modal visibility |

Key functions:

- `fetchEntries()` / `fetchMemories()` — GET requests, wrapped in try/catch so an offline backend never crashes the UI.
- `handleInteract(content)` — POSTs to `/api/interact`; on success refreshes entries + memories and returns the API payload to `ParchmentSpread`; on failure builds a **local fallback reply** and appends a synthetic entry so the UI keeps working.
- `handleSavePersona`, `handleClearMemory`, `handleLogout` — settings actions.

> 💡 Learning point: notice `App` does **no rendering** of the book internals — it composes child components and passes callbacks down. This one-way data flow (state up top, events bubble up via callbacks) is the canonical React pattern for small apps.

### 6.2 Components

**`LoginPage.jsx`** — Two modes, chosen by whether localStorage already has a user:

- *New*: a form that saves `{username, createdAt}` and calls `onLogin`.
- *Returning*: "Welcome back, {name}" with a Continue button (and a log-out that clears storage + reloads).

**`BookCover.jsx`** — Pure presentational. A clickable leather cover: `corner-plate` divs, embossed `<h1>INKBOUND</h1>`, a glowing gold crest (lucide `Sparkles`), and "Click cover to open". All the visual magic lives in CSS classes; the component just composes them.

**`ParchmentSpread.jsx`** (~311 lines) — the workhorse. Its own local state:

| State | Purpose |
|---|---|
| `inputText` | What the user is typing |
| `isSinking` / `viewState` | Drives the ink-dissolve animation and write↔response view |
| `activeReply` / `silentMessage` | The reply to render (or a "diary stayed silent" note) |
| `showEntries` / `currentPage` | Ledger visibility + pagination (3 entries/page, auto-advances to newest) |
| `responseViewIndex` | ≥0 means "browsing an old entry's reply" instead of the live reply |
| `showSkeleton` | Skeleton loaders while waiting for the API (with a 800 ms minimum) |
| `mobileTab` | `memory` / `write` — mobile-only tab switcher (CSS hides one page at a time ≤768 px) |

Flow of `handleSinkIntoPaper` (the heart of the UX):

```
guard (empty / already sinking / already loading)
→ isSinking=true, play ink-sink sound
→ setTimeout 1800ms:            [CSS animation plays during this]
    clear input, viewState='response', showSkeleton=true
    t0 = now → await onInteract(msg)
    wait max(0, 800ms − elapsed) ← "thinking floor" so skeletons feel intentional
    showSkeleton=false → render reply via TomRiddleWriter
```

**`TomRiddleWriter.jsx`** (48 lines) — the typewriter. Receives `text`; an interval increments `displayedChars` every 45 ms, slicing the string. Each revealed character is a `<span>` with `animation-delay: (index % 10) * 0.02s` so the "ink bleed" ripples in waves. Pen-scratch audio every 3rd character. Cleans up its interval on unmount/`text` change (important React hygiene!).

**`MemoryModal.jsx`** — Overlay listing memories as `[CATEGORY]` + key + value badges, with an "Obliviate (Clear Memory)" button. Styling is inline here (a contrast to the CSS-file convention elsewhere — worth noting when adding new components).

### 6.3 The Web Audio Engine

**`src/utils/audio.js`** — a single exported singleton, `diaryAudio = new DiaryAudioEngine()`. No audio files exist in the project; every sound is *synthesized*:

| Method | Technique | Sound |
|---|---|---|
| `playPenScratch()` | 80 ms **white-noise buffer** → bandpass filter (~1800–2600 Hz, Q=3) + fast decay | fountain pen on paper |
| `playPageFlip()` | 250 ms noise → lowpass sweeping 1200→400 Hz | paper rustle |
| `playInkSink()` | sine oscillator **sweeping 320→80 Hz** over 1.2 s | "magic" absorption |
| `playInkResurface()` | triangle oscillator rising 110→260 Hz with slow swell | ink appearing |
| `startAmbient()` / `stopAmbient()` | continuous 55 Hz sine drone with a 0.2 Hz **LFO** wobbling pitch ±3 Hz, gain ramping in over 3 s | dark room ambience |

> 💡 Learning points:
>
> - `init()` creates/resumes the `AudioContext` lazily — browsers require a user gesture before audio can start, and the first gesture here is a click (login / open book).
> - Everything is guarded by `this.enabled` so the volume toggle works, and every method is wrapped in try/catch so audio failures never break the app.

### 6.4 CSS Design System

All in **`src/index.css`** (~1036 lines). Structure worth studying:

- **`@font-face` × 7** — self-hosted fonts from `/public/fonts` with `font-display: swap` (text renders immediately in a fallback font, then swaps — avoids invisible text).
- **`:root` custom properties** — the whole palette + font stacks in one place:
  ```css
  --leather-base: #1a120b;   --gold-glow: #d4af37;
  --parchment-base: #f4ebd9; --ink-riddle: #19142e;
  --font-title / --font-body / --font-ink / --font-serif
  ```
- **Key animation classes**:
  - `.ink-sinking` — blur + scale + opacity fade (the 1.8 s dissolve).
  - `.ink-bleed-char` — per-character reveal with a dark-violet ink glow.
  - `.skeleton-line` — pulsing placeholder bars (`skeletonPulse` keyframes).
- **Accessibility**: a large `@media (prefers-reduced-motion: reduce)` block disables/disarms animations, plus `prefers-reduced-transparency` support. `dvh` units are used instead of `vh` for mobile-Safari-safe full-height layouts.
- **Responsive strategy**: desktop = two-page spread with a `.spine-fold` down the middle; `@media (max-width: 768px)` collapses to a single page toggled by the `.mobile-tabs` bar; `@media (max-width: 480px)` shrinks type and touch targets further.

---

## 7. Backend Deep Dive

### 7.1 Two backends, one shared library

The same four endpoints exist twice, on purpose:

| Environment | Implementation | Notes |
|---|---|---|
| **Production (Vercel)** | `api/interact.js`, `entries.js`, `memories.js`, `reset.js` | Each exports `async function handler(req, res)` — Vercel's serverless convention. |
| **Local dev** | `server-dev.js` | Plain `node:http` server on port **3001**; hand-parses JSON bodies, sets CORS headers, routes by pathname, and dynamically `import`s the same `_lib` modules. |

`vite.config.js` bridges them in dev: any request to `/api` is **proxied** to `http://localhost:3001`, so the frontend always calls the relative path `/api/...` and never needs to know which backend is serving it. `npm run dev` starts both with `concurrently`.

The handlers themselves are deliberately dumb: validate input → call one `_lib` function → wrap in try/catch → JSON response.

### 7.2 The API endpoints

| Endpoint | Method | Body / Query | Returns |
|---|---|---|---|
| `/api/interact` | POST | `{ content, personaName?, username? }` | `{ should_reply, response_text, extracted_memories[] }` |
| `/api/entries` | GET | `?username=` | `[{ id, username, content, response, mood, created_at }]` (oldest first) |
| `/api/memories` | GET | `?username=` | `[{ id, category, key, value, importance, last_seen }]` (importance desc) |
| `/api/reset` | POST | `{ username }` (optional) | `{ success: true, message }` — with a username, clears that user's entries/conversation and all non-Persona/Origin memories; without, wipes everything |

### 7.3 The AI brain: `nemotron.js`

> The file is named after an earlier model choice; it currently calls **`meta/llama-3.1-8b-instruct`** at `https://integrate.api.nvidia.com/v1/chat/completions` (an OpenAI-compatible endpoint).

`interactWithNemotron(userMessage, personaName, username)`:

1. **No API key? Return `null` immediately** — that's the signal for `diary.js` to use the fallback engine.
2. Fetch the user's **memories** and last **8 conversation messages** from the DB (in parallel).
3. Auto-store the username as an `Identity / User Name` memory (importance 5) if not present.
4. Build the message array for the LLM:
   ```
   [system]  SYSTEM_PROMPT (persona injected: "You are {personaName}, a mysterious living memory…")
   [system]  "CURRENT KNOWN MEMORIES ABOUT THE USER:\n• [Category] Key: value …"
   [...assistant/user history…]
   [user]    the new entry
   ```
   The system prompt is the personality: 1940s British English, no AI disclaimers, 1–3 sentences, **and a strict output contract**: respond as JSON `{ should_reply, response_text, extracted_memories[] }` where each memory has `category / key / value / importance`.
5. `fetch` with `temperature: 0.9, max_tokens: 512, top_p: 0.95`. Non-OK response → `null` (fallback kicks in).
6. **Defensive JSON parsing** (the most instructive part of the file — LLMs are unreliable!):
   - Try `JSON.parse(rawText)` directly.
   - Else scan for embedded `{…}` blobs and parse each until one has `response_text`.
   - Else regex out just the `"response_text"` value.
   - Else treat the raw text as the reply, but flag it as "junk" (too short / punctuation-only / containing JSON keys) → `should_reply: false`.
7. **Sanitize** `response_text`: strip any leaked JSON fragments or code fences and collapse excess newlines.
8. **Persist**: upsert each extracted memory, save both conversation turns, insert the entry (all in parallel); on DB failure just log — the user still gets their reply.

### 7.4 The offline fallback

A four-module mini-engine that emulates a character with *no AI at all*:

**`themes.js`** — detection + extraction:

- `THEME_PATTERNS`: 10 themes (`identity_question`, `fear`, `love`, `secret`, `anger`, `sadness`, `hope`, `magic`, `daily_life`, `relationship`), each with keywords and the memory it should produce (category, key, importance).
- Name extraction: regexes like `/my name is\s+([a-zA-Z]+)/i`, filtered through a large `NAME_EXCLUSIONS` stop-set so *"I am tired"* doesn't become a name.
- `matchesKeyword`: multi-word keywords use substring match; single words use **word-boundary regex** so `fear` doesn't match `fearless`.
- `detectThemes(message)` → `{ themes[], extracted{} }`.

**`brancher.js`** — conversation "depth": counts how often the current theme appeared in the user's history to pick a **tier**:

- Tier 1 = first time on this topic (fresh, introductory responses)
- Tier 2 = mentioned 1–2 times ("again…")
- Tier 3 = 3+ times ("we know each other well by now")
- Long-conversation bump: after 10 user messages, tier 1 is promoted to 2.

**`picker.js`** — picks a random response from `RESPONSES[theme][tier]`, then `personalize()` substitutes `{name}` (from the stored `User Name` memory) and `{personaName}`.

**`responses.js`** — the content: every theme × every tier has 5–8 hand-written 1940s-voice responses (~250 total), plus `SILENT_RESPONSES` for very short/empty-feeling messages.

**Orchestration in `diary.js`**:

```js
export async function interactWithDiary(userMessage, personaName, username) {
  const ai = await interactWithNemotron(...);   // primary
  if (ai) return ai;
  return fallbackResponse(...);                 // graceful degradation
}
```

`fallbackResponse` mirrors the AI path: save User Name, run `detectThemes`, upsert extracted memories, pick a "silent" response for very short generic messages, else pick from the themed pool — and persist everything exactly like the AI path does.

### 7.5 The database layer: `db.js`

A small hand-rolled service object. Patterns worth copying:

- **Lazy singleton connection** — the connection is created on first use, not at module load (serverless functions may never touch the DB).
- **Retry-on-stale-connection** — `execute()` catches any error, resets the cached connection, and retries once. This works around Turso's HTTP connections going stale on warm serverless instances.
- **Array→object rows** — Turso returns `[value, value]` rows plus a `columns` array; `toObjects()` zips them into named objects.

Methods: `addEntry`, `getEntries`, `upsertMemory` (manual check-then-update/insert keyed on `username + key`), `getMemories`, `addMessage`, `getRecentHistory` (latest N, re-reversed to chronological order), `clearUserData` (keeps `Persona`/`Origin` memories), `clearAllData` (and re-seeds the Owner memory).

---

## 8. Database Schema

(`schema.sql`, applied by `scripts/setup-db.js`, which splits the file on `;` and executes each statement against Turso.)

```sql
entries       -- one row per diary exchange
  id, username, content (user's words), response (diary's reply, nullable),
  mood (default 'neutral'), created_at

memories      -- the diary's "knowledge" about each user
  id, username, category, key, value, importance (1–5), last_seen
  -- upserted by key; importance orders retrieval & prompt inclusion

conversation  -- raw chat log for LLM context (and fallback tier counting)
  id, username, role ('user'|'assistant'), content, created_at
```

Memory categories and their meaning:

| Category | Stores |
|---|---|
| `Identity` | user's name, self-identification |
| `Secret` | confessions, anger sources |
| `Fear` | fears, sadness |
| `Desire` | loves, dreams, ambitions |
| `Relationship` | people in the user's life |
| `Fact` | daily-life details |
| `Persona` | system-owned metadata — **protected from reset** |

---

## 9. Architectural Decisions Explained

1. **Name-as-identity, no auth.** Lowering friction to "type a name" fits the fiction. The trade-off (anyone can enter any name) is acceptable for a toy/personal project; the username is a partition key in every query, not a security boundary. A beginner exercise would be adding a shared secret per name.

2. **AI primary + scripted fallback.** Guarantees the app *always* demos well: free-tier API keys expire/rate-limit, network calls fail — the branching-tree engine covers it. This dual-path pattern (try the smart thing, degrade to the deterministic thing) is broadly useful.

3. **Serverless + HTTP database.** Vercel functions are stateless and short-lived, so a traditional connection-pooled DB (Postgres) would be awkward. Turso speaks HTTP, pairs with a lazy client, and SQLite's single-file mental model keeps the schema trivial. The stale-connection retry in `db.js` is the price of this choice — worth reading.

4. **Shared `_lib` between two HTTP layers.** Instead of duplicating logic, both `server-dev.js` and the Vercel functions import the same modules. Cheap parity between dev and prod; a framework (e.g. Express, or Vercel's own dev runtime) would remove even the thin wrapper duplication.

5. **The LLM is asked to return JSON — and is not trusted.** `nemotron.js` has a four-stage parse-and-repair pipeline. Any beginner working with LLMs should internalize this: **the model's output is untrusted input**; validate, sanitize, and always have a non-AI path.

6. **All UX timing is choreographed.** 1.8 s ink dissolve → API call → minimum 800 ms skeleton floor → 45 ms/char reveal. The minimum-duration pattern (`Math.max(0, 800 − elapsed)`) prevents a fast API from making the loading state flicker, a nice real-world UX trick.

7. **Procedural audio, no assets.** Synthesizing noise + oscillator sweeps means zero bytes of audio downloaded, infinite variation (random filter frequencies per play), and a great excuse to learn the Web Audio API graph (source → filter → gain → destination).

8. **Vanilla CSS over a framework.** The bespoke aesthetic (leather grain gradients, embossed text, parchment stains, ink-glow keyframes) would fight utility-class frameworks. One well-organized CSS file with custom properties is perfectly maintainable at this scale.

---

## 10. Environment Variables & Tooling

`.env` (see `.env.example`; both `.env` and `.env.local` are gitignored):

| Variable | Used by | Required? |
|---|---|---|
| `TURSO_DATABASE_URL` | `api/_lib/db.js`, `server-dev.js`, `scripts/setup-db.js` | Yes (dev server exits without it) |
| `TURSO_AUTH_TOKEN` | same | Yes |
| `NVIDIA_API_KEY` | `api/_lib/nemotron.js` | No — omit to run purely on the fallback engine |

Note: `server-dev.js` hand-loads `.env` (no `dotenv` dependency). Vercel env vars are set separately via `vercel env add`.

Tooling:

- `vite.config.js` — React plugin + `/api → :3001` dev proxy.
- `vercel.json` — build `dist/`, register `api/**/*.js` as functions with `maxDuration: 30` (LLM calls can be slow).
- `.oxlintrc.json` — React + oxc plugins; `rules-of-hooks` is an error (catches hook misuse at lint time).
- Fonts are self-hosted in `public/fonts/`, so there are no Google Fonts requests (privacy + offline dev).
- `npm run lint` runs oxlint; `npm run build` produces the production bundle in `dist/`.

---

## 11. Ideas for Extending This Project

Great next steps if you're learning by doing:

1. **Real auth** — a passphrase per username, or OAuth. Then `username` stops being spoofable.
2. **Tests** — `themes.js`, `brancher.js`, and `picker.js` are pure functions; they're ideal Vitest candidates (Vitest integrates natively with Vite).
3. **Streaming replies** — use the LLM's streaming mode and reveal characters as tokens arrive instead of after the full response.
4. **Sentiment → mood** — the `entries.mood` column exists but is always `'neutral'`. Have the LLM (or the themes engine) fill it and tint the ledger.
5. **Fix known rough edges** — `App.jsx` references `currentUsername` before its declaration in some code paths (works at call time, but fragile); `MemoryModal` uses inline styles while everything else uses `index.css`.
6. **Server-side pagination/search** — SQL `LIMIT/OFFSET` instead of slicing all entries in the browser.
7. **TypeScript** — the API payloads (`should_reply`, `response_text`, `extracted_memories`) are a perfect case for shared types between frontend and backend.

---

*Generated as a learning companion for the Inkbound codebase. Start at §5, trace one request end-to-end, and the rest will click into place.*







