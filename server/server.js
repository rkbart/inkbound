import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dbService } from './db.js';
import { interactWithDiary } from './gemini.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/interact', async (req, res) => {
  try {
    const { content, personaName, username } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await interactWithDiary(content.trim(), personaName, username || 'anonymous');
    return res.json(result);
  } catch (err) {
    console.error('API /api/interact Error:', err);
    return res.status(500).json({ error: 'Failed to process diary entry', details: err.message });
  }
});

app.get('/api/entries', (req, res) => {
  try {
    const { username } = req.query;
    const entries = dbService.getEntries(username || 'anonymous');
    res.json(entries);
  } catch (err) {
    console.error('Failed to fetch entries:', err);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

app.get('/api/memories', (req, res) => {
  try {
    const { username } = req.query;
    const memories = dbService.getMemories(username || 'anonymous');
    res.json(memories);
  } catch (err) {
    console.error('Failed to fetch memories:', err);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

app.post('/api/reset', (req, res) => {
  try {
    const { username } = req.body;
    if (username) {
      dbService.clearUserData(username);
    } else {
      dbService.clearAllData();
    }
    res.json({ success: true, message: 'Diary memory cleared' });
  } catch (err) {
    console.error('Failed to reset diary:', err);
    res.status(500).json({ error: 'Failed to reset diary' });
  }
});

app.listen(PORT, () => {
  console.log(`✨ Inkbound API server running on http://localhost:${PORT}`);
});