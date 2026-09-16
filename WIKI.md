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

- **Primary (online)**: a chain of LLMs (via NVIDIA's free NIM API) generates real, contextual, in-character replies, **streamed** onto the page as they are written.
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
| AI | **LLM chain** via **NVIDIA NIM API**, streamed | Free API key, OpenAI-compatible chat-completions endpoint. A chain of models (not one pinned ID) absorbs NVIDIA's frequent free-tier retirements. |
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
          │  diary.js ── streamDiaryInteraction ─┐
          │     ├─ nemotron.js ──► NVIDIA NIM API│ (model chain, streamed)
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
├── package.json               # Scripts: dev (concurrently), build, lint, test
├── .env                       # Secrets (gitignored) — see §10
├── schema.sql                 # DDL for the 3 tables + unique/lookup indexes
├── scripts/setup-db.js        # Applies schema.sql to Turso (idempotent)
├── scripts/list-models.mjs    # Lists the models the NVIDIA account can see
├── tests/                     # node:test suite — `npm test` (zero dependencies)
│   ├── unit/                  # themes, picker, brancher, chunkText, ratelimit,
│   │                          # stream display, Markdown builder
│   ├── integration/           # calls the REAL Vercel handlers; skips without TURSO_*
│   └── helpers/               # mock req/res factory + .env loader for the DB tests
├── server-dev.js              # Local Node API server (port 3001), mirrors api/ routes
├── api/                       # === PRODUCTION BACKEND (Vercel functions) ===
│   ├── interact.js            # POST   /api/interact — conversation endpoint (NDJSON stream)
│   ├── entries.js             # GET    /api/entries   — fetch a user's entries
│   │                          # DELETE /api/entries   — tear out one page
│   ├── memories.js            # GET    /api/memories  — fetch a user's memory bank
│   │                          # PATCH  /api/memories  — rewrite one memory
│   │                          # DELETE /api/memories  — obliviate one memory
│   ├── reset.js               # POST   /api/reset     — clear a user's data
│   └── _lib/                  # Shared business logic (used by BOTH backends)
│       ├── diary.js           # Orchestrator: try AI, else fallback; persists results
│       ├── nemotron.js        # LLM client: model chain, streaming, marker parsing
│       ├── themes.js          # Keyword/regex engine: theme detection + extraction
│       ├── responses.js       # ~250 curated responses + silent responses
│       ├── brancher.js        # Picks response "tier" based on conversation history
│       ├── picker.js          # Picks a response from a pool, personalizes {name}
│       ├── ratelimit.js       # Sliding-window limiter for /api/interact (429 + Retry-After)
│       └── db.js              # Turso client: lazy connect, retry, all SQL queries
├── src/                       # === FRONTEND ===
│   ├── main.jsx               # React 19 bootstrap (StrictMode)
│   ├── App.jsx                # Root state: user, entries, memories, settings
│   ├── index.css              # Entire design system (~1036 lines)
│   ├── components/
│   │   ├── LoginPage.jsx      # Name entry / returning-user screen
│   │   ├── BookCover.jsx      # Closed leather book (click to open; greets returning writers)
│   │   ├── ParchmentSpread.jsx# Main 2-page spread: ledger + writer
│   │   ├── TomRiddleWriter.jsx# Ink reveal that chases a growing (streamed) reply
│   │   └── MemoryModal.jsx    # "What the Diary Knows" — view/edit/obliviate memories
│   └── utils/
│       ├── audio.js           # DiaryAudioEngine class (procedural sound)
│       ├── stream.js          # displayFromStream(): hides the memories marker safely
│       └── export.js          # exportDiaryMarkdown(): client-side .md download
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
4. Calls `onInteract(currentMessage, onChunk)` → `App.handleInteract` → `POST /api/interact` with `{ content, personaName, username }`.
5. **On the server** (see §7 for detail): the orchestrator streams the reply from the LLM (walking a chain of models), or uses the fallback engine if no model answers. Either way it saves the entry, conversation turn, and any extracted memories to Turso, then emits a final `done` event.
6. Back in the browser, `readInteractionStream` parses the response as **NDJSON**, a line-delimited stream of small JSON events:
   - `{"t":"chunk","v":"..."}` — a few words of the reply, forwarded to `onChunk` the instant they arrive;
   - `{"t":"done", ...}` — the final `{ should_reply, response_text, extracted_memories[] }`.
   A **minimum 800 ms** "thinking" floor holds the skeleton until the first chunk lands, so a fast reply never flashes the loader. If the server cannot stream (or the reply arrives as one piece), the same parsing path still yields the full text.
7. The chunks accumulate in `activeReply`, and `displayFromStream()` strips anything from `---MEMORIES---` onward — including a *partial* marker split across two chunks — so machine-readable text never reaches the page.
8. `<TomRiddleWriter />` reveals the growing reply **one character every 45 ms** (3 chars per tick when a large chunk is queued), wrapping each char in a `<span class="ink-bleed-char">` with staggered animation delays and playing a subtle scratch every 3rd character. An **ink resurface** sound (110→260 Hz triangle sweep) plays at the start. The reveal *chases* the stream without ever restarting.
9. If the reply taught the diary something new, a **memory toast** slides in — *"The diary learned 2 new things about you..."* — and fades after 6 s. `App` also re-fetches entries and memories so the left-page ledger updates.
10. Double-clicking the page again returns to the writing view.
11. On a plain-JSON or offline backend, `handleInteract` returns a local fallback reply so the diary always answers (see §6.1).

### C. Memory, ledger & settings

- The left page shows a paginated **entry ledger** (3 per page, auto-jumps to the last page when new entries arrive). Each entry has a **tear-out** button (hover) — deleting asks for confirmation and is scoped to the username server-side.
- The **brain button** opens `MemoryModal` — *"What the Diary Knows"*. This is where the personalization becomes legible: each row shows `[Category] Key: value`, and can be **rewritten** (fix a misheard name → Enter/blur saves, Escape cancels) or **obliterated** individually. Both operations are optimistic: the UI updates first, then re-fetches so it settles to the server's truth.
- The **download button** exports the whole diary as Markdown (client-side blob, no server round-trip).
- Settings panel (rendered in `App.jsx`): change the **persona name** (renames the diary character, persisted per-user in localStorage), **clear memory** (`POST /api/reset` — deletes entries/conversation and all non-`Persona` memories for that user; a username is required, so no blanket wipe is possible), or **log out**.
- Graceful degradation everywhere: if the backend is unreachable, fetches fail silently (`console.warn`) and the diary still works with a local fallback reply. Every fetch also carries an abort timeout (25 s; 40 s for `/api/interact`, which streams) so a hung request can never leave the UI spinning forever.

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
| `memories` | Extracted memory bank from `/api/memories` — feeds `MemoryModal` |
| `isLoading` | True while `/api/interact` is in flight |
| `personaName` | The diary character's name (default `'Tom'`) |
| `showSettings` | Settings modal visibility |

Key functions:

- `fetchWithTimeout(url, opts, ms)` — `fetch` wrapped in `AbortSignal.timeout`, so a stalled request rejects into the existing try/catch instead of hanging the UI.
- `fetchEntries()` / `fetchMemories()` — GET requests, wrapped in try/catch so an offline backend never crashes the UI.
- `handleInteract(content, onChunk)` — POSTs to `/api/interact`, hands the response to `readInteractionStream`, refreshes entries + memories after the `done` event, and returns the payload to `ParchmentSpread`. On failure it builds a **local fallback reply** and appends a synthetic entry so the UI keeps working.
- `readInteractionStream(res, onChunk)` — the NDJSON reader: falls back to `res.json()` when the server didn't stream, otherwise reads `res.body.getReader()`, decodes chunks with a `TextDecoder`, buffers, and splits on newlines (a chunk can straddle two reads — this buffering is the part beginners most often get wrong).
- `handleDeleteMemory(id)` / `handleUpdateMemory(id, value)` / `handleDeleteEntry(id)` — optimistic mutations: update state, fire the request, then re-fetch.
- `handleSavePersona`, `handleClearMemory`, `handleLogout` — settings actions.

> 💡 Learning point: notice `App` does **no rendering** of the book internals — it composes child components and passes callbacks down. This one-way data flow (state up top, events bubble up via callbacks) is the canonical React pattern for small apps.

### 6.2 Components

**`LoginPage.jsx`** — Two modes, chosen by whether localStorage already has a user:

- *New*: a form that saves `{username, createdAt}` and calls `onLogin`.
- *Returning*: "Welcome back, {name}" with a Continue button (and a log-out that clears storage + reloads).

**`BookCover.jsx`** — Nearly pure presentational. A clickable leather cover: `corner-plate` divs, embossed `<h1>INKBOUND</h1>`, a glowing gold crest (lucide `Sparkles`), and "Click cover to open". The one conditional: when `username` is passed it greets the returning writer ("Welcome back, Corvus") instead of the click hint. All the visual magic lives in CSS classes; the component just composes them.

**`ParchmentSpread.jsx`** — the workhorse (the largest component). Its own local state:

| State | Purpose |
|---|---|
| `inputText` | What the user is typing |
| `isSinking` / `viewState` | Drives the ink-dissolve animation and write↔response view |
| `activeReply` / `silentMessage` | The reply to render — grown chunk by chunk while streaming (or a "diary stayed silent" note) |
| `responseKey` | Bumped to restart `TomRiddleWriter`'s reveal for a new reply |
| `memoryToast` | The "The diary learned N new things about you..." notice (auto-clears after 6 s) |
| `showEntries` / `currentPage` | Ledger visibility + pagination (3 entries/page, auto-advances to newest) |
| `showMemories` | `MemoryModal` ("What the Diary Knows") visibility |
| `responseViewIndex` | ≥0 means "browsing an old entry's reply" instead of the live reply |
| `showSkeleton` | Skeleton loaders while waiting for the API (with a 800 ms minimum) |
| `mobileTab` | `memory` / `write` — mobile-only tab switcher (CSS hides one page at a time ≤768 px) |

Flow of `handleSinkIntoPaper` (the heart of the UX):

```
guard (empty / already sinking / already loading)
→ isSinking=true, play ink-sink sound
→ setTimeout 1800ms:            [CSS animation plays during this]
    clear input, viewState='response', showSkeleton=true
    t0 = now
    onChunk(piece) → grow activeReply (displayFromStream strips the memories marker)
                     first chunk: start the 800ms "thinking floor" timer
    await onInteract(msg, onChunk)
    if no chunk ever arrived (offline / non-streaming):
        wait max(0, 800ms − elapsed), then reveal result.response_text in one go
    showSkeleton=false → TomRiddleWriter animates the reply in
    result.extracted_memories.length > 0 → show the memory toast
```

> 💡 Learning point: the "thinking floor" is computed as `Math.max(0, 800 − elapsed)` — the same trick as a minimum loading duration. A fast answer still shows the loader briefly, so the UI feels deliberate rather than flickery, and a slow one is unaffected.

**`TomRiddleWriter.jsx`** — the typewriter that *chases a growing target*. It keeps `text` in a ref (`textRef`) precisely so the 45 ms interval does **not** restart when new chunks arrive; each tick slices `textRef.current` up to `displayedChars`, stepping 3 characters when more than 150 are queued (so a large buffered chunk doesn't crawl). Each revealed character is a `<span>` with `animation-delay: (index % 10) * 0.02s` so the "ink bleed" ripples in waves; pen-scratch audio every 3rd character. A new `resetKey` (not new text!) starts a fresh reveal, and the interval is cleaned up on unmount.

**`MemoryModal.jsx`** — "What the Diary Knows". Lists the memory bank as `[Category]` + key + value rows, each with a **rewrite** action (inline input; Enter/blur saves, Escape cancels, `onMouseDown` preventDefault so blur doesn't fire first) and an **obliviate** action. It's a *controlled* component: it owns only `editingId`/`editValue` and delegates the mutations upward via `onUpdate`/`onDelete`, so `App` remains the single writer of `memories`.

**`src/utils/stream.js`** — `displayFromStream(raw)`. The subtle bug it solves: the `---MEMORIES---` marker can arrive split across two chunks (`"---MEMO"` + `"RIES---"`), so a naive `indexOf` cut would flash partial marker characters on the page. It derives the display text from the *whole* raw stream and drops any trailing fragment that is a proper prefix of the marker — safe because the hidden characters stay in the raw text and reappear if they turn out to be genuine prose.

**`src/utils/export.js`** — `exportDiaryMarkdown(entries, username)`: builds a Markdown transcript in memory, then downloads it with a `Blob` + a temporary `<a download>` (revoking the object URL afterwards). No server involvement.

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

All in **`src/index.css`** (1269 lines). Structure worth studying:

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
  - `.memory-toast` — the "the diary learned something" notice (fades in/out).
  - `.memory-modal*` / `.memory-row*` — the memory-bank overlay, rows, category/key/value, inline edit input, and per-row actions.
  - `.entry-delete` — the tear-out button that appears on ledger-row hover.
- **Accessibility**: a large `@media (prefers-reduced-motion: reduce)` block disables/disarms animations, plus `prefers-reduced-transparency` support. `dvh` units are used instead of `vh` for mobile-Safari-safe full-height layouts.
- **Touch & selection hardening**: `touch-action: manipulation` on the textarea and spread stops iOS double-tap-to-zoom from fighting the double-tap-to-submit gesture, and `user-select: text` is re-enabled on the reading surfaces (ledger rows, textarea) while the response page stays non-selectable so double-click-to-continue never highlights text.
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

The handlers themselves are deliberately dumb: validate input → enforce the rate limit (on `/api/interact` only) → call one `_lib` function → wrap in try/catch → JSON response.

### 7.2 The API endpoints

| Endpoint | Method | Body / Query | Returns |
|---|---|---|---|
| `/api/interact` | POST | `{ content, personaName?, username? }` — content capped at 4000 chars (over → 400) | **NDJSON stream**: `{"t":"chunk","v":"…"}` events, then `{"t":"done", should_reply, response_text, extracted_memories[]}` — or **429 + `Retry-After`** when a writer outpaces `RATE_LIMIT_PER_MINUTE` |
| `/api/entries` | GET | `?username=` | `[{ id, username, content, response, mood, created_at }]` (oldest first) |
| `/api/entries` | DELETE | `{ id, username }` (both required → else 400) | `{ success: true, deleted }` — scoped to the username |
| `/api/memories` | GET | `?username=` | `[{ id, category, key, value, importance, last_seen }]` (importance desc) |
| `/api/memories` | PATCH | `{ id, username, value?, category?, importance? }` | `{ success: true, updated }` — `value` 1–500 chars, `category` must be in the allow-list, `importance` 1–5 |
| `/api/memories` | DELETE | `{ id, username }` | `{ success: true, deleted }` — scoped to the username |
| `/api/reset` | POST | `{ username }` (**required** — no username → 400) | `{ success: true, message }` — clears that user's entries/conversation and all non-`Persona` memories. A blanket wipe is impossible. |

> 💡 Learning point: mutations read the **username from the JSON body**, reads take it from the **query string**. `api/memories.js` resolves both in one place. Getting this wrong is silently destructive — if the handler fell back to `'anonymous'`, an edit would "succeed" (200) while changing nothing the user can see, and a deleted memory would reappear on the next fetch. The dev-server suite missed this because `server-dev.js` has its own routes; only calling the Vercel handlers directly exposed it.

### 7.3 The AI brain: `nemotron.js`

> The filename is historical. It currently calls **`google/gemma-4-31b-it`** through `https://integrate.api.nvidia.com/v1/chat/completions` (an OpenAI-compatible endpoint) — and falls back to **`mistralai/mistral-nemotron`**, then **`meta/llama-3.2-11b-vision-instruct`**. See *Model selection* below: two earlier choices were retired out from under this app.

`interactWithNemotronStream(userMessage, personaName, username, onDelta)`:

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
   The system prompt is the personality (1940s British English, no AI disclaimers, 1–3 sentences, boundaries against encouraging harm) **plus an output contract**:
   ```
   ---REPLY---
   Your in-character reply here (1-3 sentences of plain prose).
   ---MEMORIES---
   [{"category": "Identity|Secret|Fear|Desire|Relationship|Fact", "key": "…", "value": "…", "importance": 1-5}]
   ```
   Plain prose between markers replaced an earlier "reply as JSON" contract — JSON formatting tends to drag models out of character, and prose streams character-by-character far more naturally.
5. **Streaming**: `fetch` with `stream: true`, `temperature: 0.9, max_tokens: 512, top_p: 0.95`, reading the SSE body manually (`data:` lines → `choices[0].delta.content`).
6. **Forward only the reply section.** `flushDisplay()` tracks `emittedUpTo` and, once `---REPLY---` has appeared, calls `onDelta` with the text up to `---MEMORIES---` (or the current end). Because it uses an absolute offset into `raw`, a chunk that *extends* the reply emits only the new part — no duplication, and the memories JSON is never shown.
7. **Defensive parsing** (the most instructive part of the file — LLMs are unreliable!):
   - `parseModelOutput(raw)` slices the reply between the markers; if the markers are missing entirely it falls back to `parseLegacyReply()`, which hunts for raw JSON (`{…}` blobs with a `response_text` key, then a bare `"response_text"` regex).
   - `stripFences()` removes markdown code fences; whitespace is collapsed to at most a blank-line break.
   - Junk detection: a reply under 2 characters, punctuation-only, or containing JSON keys → `should_reply: false, response_text: null` (the diary stays silent rather than printing garbage).
   - Memories: take the substring from the marker, find the outermost `[...]`, `JSON.parse`, then keep only entries with `key` + `value`, defaulting the category to `Fact` and clamping importance to 1–5.
8. **Persist**: upsert each extracted memory, save both conversation turns, insert the entry (all in parallel); on DB failure just log — the user still gets their reply.

#### Model selection (why there is a chain)

Free-tier model IDs on NIM **retire without warning**, and a retired model is not always removed from `GET /v1/models` — so a catalog listing is not proof of service. This project has already outlived two retirements, and `nvidia/llama3-chatqa-1.5-70b` answers a real request with 404 despite being listed. So:

- `MODEL_CHAIN` is tried in order; the first model that produces anything wins.
- All attempts share a **20 s wall-clock budget** (`MODEL_CHAIN_BUDGET_MS`) to leave the remaining ~10 s of the function's 30 s `maxDuration` for the fallback engine + DB writes. The primary gets ~60% of the remaining budget, each later model an equal share of what's left, and the loop stops when under 3 s remains — a stalled primary can't starve its own fallbacks.
- A retry happens **only when an attempt produced nothing**. A mid-stream failure returns whatever already arrived, so the writer never sees two replies spliced together.
- `scripts/list-models.mjs` lists what the account can see. When picking a model, four properties matter (all verified live before switching):
  1. it answers an actual completion with 200;
  2. it streams **many small chunks** — some models buffer the entire answer and emit one chunk, which defeats the progressive reveal;
  3. it writes **no reasoning preamble** ("Here's a thinking process: …") into the content — several newer nemotron models do, ruining the voice;
  4. it honours the `---REPLY---` / `---MEMORIES---` contract.
- Empirical note from measuring candidates: `mistralai/mistral-nemotron` and `google/gemma-4-31b-it` were fully compliant (3/3 marker checks, 0.2–2.2 s to first token, 20–108 chunks), while `nvidia/llama-3.1-nemotron-70b-instruct` and `nvidia/llama3-chatqa-1.5-70b` are dead. Free-tier latency is also variable — the same prompt measured 3.5 s once and 15.6 s another time, which is exactly why the delivery guarantee in §7.4 matters.

> 💡 Learning point: **never depend on a single third-party model ID.** Pin your *contract* (markers, persona, budget), not the vendor's catalogue, and make "no answer" a normal, tested code path.

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

**Orchestration in `diary.js`** — `streamDiaryInteraction()` writes NDJSON to `res` and guarantees a reply reaches the client:

```js
let result = await interactWithNemotronStream(...);   // primary (streams via onDelta)
if (!result) {
  result = await fallbackResponse(...);               // graceful degradation
  if (result.response_text) chunked(result.response_text);
} else if (!streamed && result.response_text) {
  chunked(result.response_text);                      // model skipped the markers
}
writeNdjson(res, { t: 'done', should_reply, response_text, extracted_memories });
```

The `else if` is subtle but important: if a model returns prose **without** the `---REPLY---` marker, nothing could be forwarded live, so the reply is delivered in chunks instead of being dropped (the writer would otherwise see the "ink sinks quietly" placeholder for a reply that really exists).

Both non-streaming paths pass the reply through **`chunkText()`** before emitting: a pure, sentence-aware splitter (≈40-char target, hard cap 120, never splits a word) so the offline engine and marker-less models produce the *same* multi-chunk stream shape as the AI path — the frontend needs no special case for either. The one invariant that matters is tested: `chunks.join('') === text`.

`fallbackResponse` mirrors the AI path: save User Name, run `detectThemes`, upsert extracted memories, pick a "silent" response for very short generic messages, else pick from the themed pool — and persist everything exactly like the AI path does.

### 7.5 The database layer: `db.js`

A small hand-rolled service object. Patterns worth copying:

- **Lazy singleton connection** — the connection is created on first use, not at module load (serverless functions may never touch the DB).
- **Retry-on-stale-connection** — `execute()` catches any error, resets the cached connection, and retries once. This works around Turso's HTTP connections going stale on warm serverless instances.
- **Array→object rows** — Turso returns `[value, value]` rows plus a `columns` array; `toObjects()` zips them into named objects.

Methods: `addEntry`, `getEntries`, `upsertMemory` (a single atomic `INSERT ... ON CONFLICT` keyed on the unique `(username, key)` index — replaces the old race-prone check-then-insert), `getMemories`, `addMessage`, `getRecentHistory` (latest N, re-reversed to chronological order), and `clearUserData` (keeps `Persona` memories). There is deliberately no "wipe everything" method — the reset endpoint requires a username.

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

Indexes (applied by `scripts/setup-db.js`, idempotent): a **unique** index on `memories(username, key)` — it enables the atomic upsert in `db.js` and makes duplicate memories impossible even under concurrent requests — plus lookup indexes on `entries(username, created_at)` and `conversation(username, id)` for fast per-user queries. The setup script first deduplicates any pre-existing duplicate memory rows (keeping the lowest `id`).

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

5. **The model's output is untrusted input.** Even after switching from "reply as JSON" to plain prose between markers, `nemotron.js` keeps a multi-stage parse-and-repair pipeline (marker slice → legacy JSON hunt → junk detection → sanitization). Any beginner working with LLMs should internalize this: validate, sanitize, and always have a non-AI path.

6. **Stream what you can, but guarantee delivery.** The reply is forwarded to the browser chunk by chunk — yet the `done` event also carries the full `response_text`. That redundancy is deliberate: models sometimes ignore the marker contract, and a stalled stream must never cost the writer their reply. The client treats "no chunks arrived" as a normal case (it reveals the final text in one go), which also covers non-streaming backends.

7. **Choreographed, not instant.** 1.8 s ink dissolve → API call → minimum 800 ms skeleton floor → 45 ms/char reveal. The minimum-duration pattern (`Math.max(0, 800 − elapsed)`) prevents a fast API from making the loading state flicker. The character reveal *chasing* a growing string (a ref + one interval, rather than restarting per chunk) is the pattern that makes streaming feel like handwriting instead of typing.

8. **Personalization is made visible.** Extracting memories is invisible by default, so the app surfaces it three ways: a "the diary learned N new things about you" toast after an interaction, a browsable memory bank (the Brain button), and a greeting on the cover. Users can edit or delete any memory — transparency plus user control is what makes an ambient-memory feature feel like a feature rather than a black box.

9. **Procedural audio, no assets.** Synthesizing noise + oscillator sweeps means zero bytes of audio downloaded, infinite variation (random filter frequencies per play), and a great excuse to learn the Web Audio API graph (source → filter → gain → destination).

10. **Vanilla CSS over a framework.** The bespoke aesthetic (leather grain gradients, embossed text, parchment stains, ink-glow keyframes) would fight utility-class frameworks. One well-organized CSS file with custom properties is perfectly maintainable at this scale.

---

## 10. Environment Variables & Tooling

`.env` (see `.env.example`; both `.env` and `.env.local` are gitignored):

| Variable | Used by | Required? |
|---|---|---|
| `TURSO_DATABASE_URL` | `api/_lib/db.js`, `server-dev.js`, `scripts/setup-db.js` | Yes (dev server exits without it) |
| `TURSO_AUTH_TOKEN` | same | Yes |
| `NVIDIA_API_KEY` | `api/_lib/nemotron.js` | No — omit to run purely on the fallback engine |
| `RATE_LIMIT_PER_MINUTE` | `api/_lib/ratelimit.js` | No — default **12** requests/min per `IP\|username` on `/api/interact` |
| `RATE_LIMIT_IP_PER_MINUTE` | same | No — default **30** requests/min per IP regardless of name |

Note: `server-dev.js` hand-loads `.env` (no `dotenv` dependency). Vercel env vars are set separately via `vercel env add`.

Tooling:

- `vite.config.js` — React plugin + `/api → :3001` dev proxy.
- `vercel.json` — build `dist/`, register `api/**/*.js` as functions with `maxDuration: 30` (LLM calls can be slow).
- `.oxlintrc.json` — React + oxc plugins; `rules-of-hooks` is an error (catches hook misuse at lint time).
- `npm test` — **zero-dependency suite on Node's built-in `node:test`** (Node ≥18): unit tests for every pure module plus integration tests that invoke the real Vercel handlers with a mock `req`/`res`. The DB-backed tests **self-skip** when `TURSO_DATABASE_URL` isn't configured, so `npm test` is meaningful right after cloning.
- Fonts are self-hosted in `public/fonts/`, so there are no Google Fonts requests (privacy + offline dev).
- `npm run lint` runs oxlint; `npm run build` produces the production bundle in `dist/`.

---

## 11. Ideas for Extending This Project

Great next steps if you're learning by doing:

1. **Real auth** — a passphrase per username, or OAuth. Then `username` stops being spoofable.
2. **More tests** — the suite (`tests/`, `npm test`) already covers the pure modules and the real handlers; natural extensions are the NDJSON stream contract (run `server-dev.js` on an ephemeral port and assert on the wire format) and a fixture-based test of `nemotron.js`'s marker parser against recorded model outputs (including marker-less ones).

3. **Durable rate limiting** — `api/_lib/ratelimit.js` is honest about its limit: serverless instances are ephemeral, so its counters are per-instance. Moving the counters to Turso (or Upstash) would make the limit global; this is a nice, small exercise in shared-state design.

4. **Sentiment → mood** — the `entries.mood` column exists but is always `'neutral'`. Have the LLM (or the themes engine) fill it and tint the ledger.

5. **Remaining rough edges** — `MemoryModal` mixes inline styles with `index.css` classes; `entries.js`/`memories.js` still load every row and paginate in the browser (SQL `LIMIT/OFFSET` would scale further).
7. **TypeScript** — the API payloads (`should_reply`, `response_text`, `extracted_memories`) are a perfect case for shared types between frontend and backend.

---

*Generated as a learning companion for the Inkbound codebase. Start at §5, trace one request end-to-end, and the rest will click into place.*







