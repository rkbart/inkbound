import { dbService } from './_lib/db.js';

const ALLOWED_CATEGORIES = new Set(['Identity', 'Secret', 'Fear', 'Desire', 'Relationship', 'Fact', 'Persona']);

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const body = req.body || {};
  // GET carries the username in the query string; DELETE/PATCH send it in the
  // JSON body (Vercel parses that into req.body). Reading only the query
  // string here silently scoped every edit to 'anonymous'.
  const username = url.searchParams.get('username')
    || (typeof body.username === 'string' && body.username.trim() ? body.username.trim() : 'anonymous');

  try {
    if (req.method === 'GET') {
      const memories = await dbService.getMemories(username);
      return res.status(200).json(memories);
    }

    if (req.method === 'DELETE') {
      const { id } = body;
      const memId = Number(id);
      if (!Number.isInteger(memId) || memId <= 0) {
        return res.status(400).json({ error: 'A valid memory id is required' });
      }
      // Scoped to the username so one user can never delete another's memories.
      const deleted = await dbService.deleteMemory(username, memId);
      return res.status(200).json({ success: true, deleted });
    }

    if (req.method === 'PATCH') {
      const { id, value, category, importance } = body;
      const memId = Number(id);
      if (!Number.isInteger(memId) || memId <= 0) {
        return res.status(400).json({ error: 'A valid memory id is required' });
      }

      const fields = {};
      if (value !== undefined) {
        if (typeof value !== 'string' || !value.trim() || value.length > 500) {
          return res.status(400).json({ error: 'value must be 1-500 characters' });
        }
        fields.value = value.trim();
      }
      if (category !== undefined) {
        if (!ALLOWED_CATEGORIES.has(category)) {
          return res.status(400).json({ error: 'Unknown category' });
        }
        fields.category = category;
      }
      if (importance !== undefined) {
        const imp = Number(importance);
        if (!Number.isInteger(imp) || imp < 1 || imp > 5) {
          return res.status(400).json({ error: 'importance must be an integer from 1 to 5' });
        }
        fields.importance = imp;
      }
      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      const updated = await dbService.updateMemory(username, memId, fields);
      return res.status(200).json({ success: true, updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Memories error:', err);
    return res.status(500).json({ error: 'Memory operation failed' });
  }
}
