import { dbService } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, 'http://localhost');
  const username = url.searchParams.get('username') || 'anonymous';

  try {
    const entries = await dbService.getEntries(username);
    return res.status(200).json(entries);
  } catch (err) {
    console.error('Fetch entries error:', err);
    return res.status(500).json({ error: 'Failed to fetch entries' });
  }
}
