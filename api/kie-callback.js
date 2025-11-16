// api/kie-callback.js
// This is the public callback URL you gave to Kie. Kie will POST job results here.
export default async function handler(req, res) {
  // Kie will POST JSON; allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    // Example payload (from docs): payload.data.resultJson -> stringified JSON containing resultUrls
    // We'll extract taskId and result URLs.
    const taskId = payload?.data?.taskId || payload?.taskId || payload?.data?.task_id;
    const resultJson = payload?.data?.resultJson || payload?.data?.result_json || payload?.data?.result || null;
    let result;
    try { result = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson; } catch(e) { result = resultJson; }

    // result may contain resultUrls array
    const resultUrls = result?.resultUrls || result?.result_urls || [];

    // Save to simple in-memory store (for demo)
    // Note: serverless functions are ephemeral; this is only for short tests.
    global.__KIE_RESULTS__ = global.__KIE_RESULTS__ || {};
    global.__KIE_RESULTS__[taskId] = {
      ok: true,
      details: payload.data || payload,
      resultUrls,
      receivedAt: Date.now()
    };

    // Respond 200 so Kie knows we received callback
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('callback error', err);
    res.status(500).json({ error: err.message || String(err) });
  }
}
