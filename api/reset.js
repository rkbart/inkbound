import { dbService } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.body;

  // Safety: a blanket wipe is never allowed. A username is required so a
  // single unauthenticated request can only ever clear that user's data.
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    await dbService.clearUserData(username.trim());
    return res.status(200).json({ success: true, message: 'Diary memory cleared' });
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ error: 'Failed to reset diary' });
  }
}
