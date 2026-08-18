import { dbService } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, 'http://localhost');
  const username = url.searchParams.get('username') || 'anonymous';

  try {
    const memories = await dbService.getMemories(username);
    return res.status(200).json(memories);
  } catch (err) {
    console.error('Fetch memories error:', err);
    return res.status(500).json({ error: 'Failed to fetch memories' });
  }
}
