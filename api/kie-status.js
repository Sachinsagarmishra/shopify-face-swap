// api/kie-status.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const taskId = req.query.taskId || (typeof req.body === 'string' ? (JSON.parse(req.body).taskId) : req.body?.taskId);
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

    const store = global.__KIE_RESULTS__ || {};
    const info = store[taskId];

    if (!info) {
      return res.status(200).json({ status: 'pending' });
    }

    return res.status(200).json({ status: 'done', info });
  } catch (err) {
    console.error('kie-status error', err);
    res.status(500).json({ error: err.message || String(err) });
  }
}
