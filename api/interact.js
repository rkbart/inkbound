import { streamDiaryInteraction, MAX_CONTENT_LENGTH } from './_lib/diary.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, personaName, username } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: `Content exceeds ${MAX_CONTENT_LENGTH} characters` });
  }

  try {
    console.log('Interact start:', { content: content.slice(0, 50), personaName, username });
    // Streams the reply as newline-delimited JSON: "chunk" events while the
    // model writes, then a final "done" event with the extracted memories.
    // If the platform buffers instead of streaming, the client still parses
    // the full body and renders as before (graceful degradation).
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();
    await streamDiaryInteraction(res, content.trim(), personaName || 'Tom Riddle', username || 'anonymous');
  } catch (err) {
    console.error('Interact error:', err.message, err.stack);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to process diary entry' });
    }
    try { res.end(); } catch { /* already closed */ }
  }
}
