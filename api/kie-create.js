// api/kie-create.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Allow CORS from your shop
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { image /* user face base64 */, productImageUrl, productId } = body;

    if (!image || !productImageUrl) {
      return res.status(400).json({ error: 'Missing image or productImageUrl' });
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'KIE_API_KEY not set in env' });

    // Build Kie createTask body
    // model: use google/nano-banana for Nano Banana
    const createBody = {
      model: 'google/nano-banana',
      callBackUrl: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-vercel-app.vercel.app'}/api/kie-callback`,
      input: {
        // We'll send user face as base64 and a pointer to product image url (server will fetch product image)
        mode: 'image-edit',              // (example param — Kie expects inputs per model config)
        image_base64: image,             // your face (base64)
        product_image_url: productImageUrl,
        output_format: 'png',
        // optional: pass productId so callback knows which product
        meta: { productId }
      }
    };

    // Call Kie createTask
    const resp = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(createBody)
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('KIE createTask error', resp.status, data);
      return res.status(502).json({ error: 'Kie createTask error', status: resp.status, details: data });
    }

    // return taskId to frontend so it can poll status
    return res.status(200).json({ taskId: data.data?.taskId || data.data?.task_id || data?.taskId || data });
  } catch (err) {
    console.error('kie-create error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
