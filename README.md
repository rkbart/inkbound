# ✒️ Inkbound: Living Enchanted Diary

> *"Secrets are safe within these pages..."*

**Inkbound** is an immersive, dark fantasy interactive web application inspired by Tom's diary from the famous book. Built with React 19, Vite, Express, and Google Gemini AI, users can write thoughts onto aged parchment pages with ink. The words physically dissolve into the paper fibers, after which the living memory within the diary reads your entry, extracts personal memories and secrets, and writes back on the page in resurfacing ink.

---

## ✨ Features

- **📖 Interactive Antique Journal**: Realistically styled leather-bound diary with gold-embossed lettering, brass corner plates, spine shadows, and a ribbon bookmark.
- **👁️ Toggle Memory Visibility**: Eye icon button to hide or show the parchment memory ledger. Entries auto-scroll to the bottom when new ones appear.
- **✒️ Magic Ink Dissolve & Bleed Animation**: User input smoothly fades into parchment fibers before the diary's handwriting resurfaces character-by-character.
- **🧠 LLM Persona & Memory Bank**: Powered by Google's `gemini-2.5-flash` model (`@google/genai`), tuned to an articulate, curious, and eerie 1940s living memory persona. Automatically knows the user's name and extracts personal traits, secrets, names, and fears into a per-user persistent memory bank.
- **⚡ Dual Storage Engine (SQLite + JSON Fallback)**: Uses `better-sqlite3` for fast local database persistence with user-scoped data isolation. Automatic zero-config fallback to a JSON database file (`data/db.json`) if SQLite native binaries are unavailable.
- **🔊 Procedural Web Audio Synthesizer**: Zero-asset audio engine using the Web Audio API to generate realistic pen scratches, paper flip rustles, magic ink dissolve shimmers, and deep ambient atmospheric drones.
- **💀 Horcrux Cursed Mode & Ribbon Drawer**: Toggle dark cursed visual effects, inspect absorbed memories in the Ribbon Drawer, or perform the "Obliviate" memory wipe.
- **🛡️ Offline Fallback Simulation**: Includes an offline pattern-matching engine that provides interactive responses even without an active internet connection or API key.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, Web Audio API, Vanilla CSS (Custom Design System with Google Fonts `Cinzel Decorative` & `IM Fell English`)
- **Backend**: Node.js, Express 5, CORS, Dotenv
- **AI Integration**: `@google/genai` (Google Gemini AI SDK - `gemini-2.5-flash`)
- **Database**: `better-sqlite3` with user-scoped data isolation and automated fallback to JSON file storage

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/inkbound.git
cd inkbound
npm install
```

### 3. Environment Setup
Copy `.env.example` to create your `.env` file:
```bash
cp .env.example .env
```
Add your Google Gemini API Key in `.env`:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If no API key is provided, Inkbound automatically operates using its built-in local offline simulation engine).*

### 4. Running the Application
Start both the backend server and frontend development server concurrently:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs Express backend API (`:3001`) and Vite frontend (`:5173`) concurrently. |
| `npm run server` | Starts only the Node.js Express backend server. |
| `npm run client` | Starts only the Vite frontend dev server. |
| `npm run build` | Bundles the React frontend for production distribution into `/dist`. |
| `npm run lint` | Runs `oxlint` to perform code linting and syntax checks. |
| `npm run preview` | Previews the production build locally. |

---

## 📚 Technical Documentation

For an in-depth explanation of system architecture, data schemas, Web Audio API sound synthesis, Gemini prompt design, and implementation details, please read [DOCUMENTATION.md](file:///home/rkbart/Projects/inkbound/DOCUMENTATION.md).

---

## 📄 License

This project is open-source under the MIT License.
