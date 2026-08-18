import { dbService } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.body;

  try {
    if (username) {
      await dbService.clearUserData(username);
    } else {
      await dbService.clearAllData();
    }
    return res.status(200).json({ success: true, message: 'Diary memory cleared' });
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ error: 'Failed to reset diary' });
  }
}
