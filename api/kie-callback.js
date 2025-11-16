// api/kie-callback.js
export default async function handler(req, res) {
  // Allow CORS so you can test quickly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    // Kie docs show payload.data.resultJson contains stringified JSON with resultUrls
    const taskId = payload?.data?.taskId || payload?.taskId || payload?.data?.task_id;
    const rawResultJson = payload?.data?.resultJson || payload?.data?.result_json || payload?.data?.result || null;
    let resultObj = null;
    try { resultObj = typeof rawResultJson === 'string' ? JSON.parse(rawResultJson) : rawResultJson; } catch (e) { resultObj = rawResultJson; }

    const resultUrls = resultObj?.resultUrls || resultObj?.result_urls || [];

    // In-memory store (demo only; not persistent)
    global.__KIE_RESULTS__ = global.__KIE_RESULTS__ || {};
    global.__KIE_RESULTS__[taskId] = {
      ok: true,
      receivedAt: Date.now(),
      payload,
      resultUrls
    };

    // Respond 200 to acknowledge callback
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('kie-callback error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
