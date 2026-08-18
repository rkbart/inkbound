import { interactWithDiary } from './_lib/diary.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, personaName, username } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    console.log('Interact start:', { content: content.slice(0, 50), personaName, username });
    const result = await interactWithDiary(
      content.trim(),
      personaName || 'Tom Riddle',
      username || 'anonymous'
    );
    console.log('Interact result:', { hasResponse: !!result?.response_text, shouldReply: result?.should_reply });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Interact error:', err.message, err.stack);
    return res.status(500).json({ error: 'Failed to process diary entry' });
  }
}
