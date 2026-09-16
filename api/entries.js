import { dbService } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const username = url.searchParams.get('username') || 'anonymous';
      const entries = await dbService.getEntries(username);
      return res.status(200).json(entries);
    }

    if (req.method === 'DELETE') {
      const { id, username } = req.body || {};
      const entryId = Number(id);
      if (!Number.isInteger(entryId) || entryId <= 0 || !username || typeof username !== 'string') {
        return res.status(400).json({ error: 'A valid id and username are required' });
      }
      // Scoped to the username so one user can never delete another's entries.
      const deleted = await dbService.deleteEntry(username, entryId);
      return res.status(200).json({ success: true, deleted });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Entries error:', err);
    return res.status(500).json({ error: 'Entry operation failed' });
  }
}
