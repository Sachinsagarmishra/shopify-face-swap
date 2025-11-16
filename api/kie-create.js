// api/kie-create.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { image, productImageUrl, productId } = body;
    if (!image || !productImageUrl) return res.status(400).json({ error: 'Missing image or productImageUrl' });

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY not set in env' });

    const callbackUrl = 'https://shopify-face-swap.vercel.app/api/kie-callback';
    const createBody = {
      model: 'google/nano-banana',
      callBackUrl: callbackUrl,
      input: {
        output_format: 'png',
        image_base64: image,
        product_image_url: productImageUrl,
        meta: { productId }
      }
    };

    const resp = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(createBody)
    });

    const data = await resp.json().catch(()=>({ error: 'Invalid JSON from Kie' }));
    if (!resp.ok) {
      console.error('KIE createTask error', resp.status, data);
      return res.status(502).json({ error: 'Kie createTask error', status: resp.status, details: data });
    }

    const taskId = data?.data?.taskId || data?.task_id || null;
    return res.status(200).json({ taskId, raw: data });
  } catch (err) {
    console.error('kie-create error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
