// api/face-swap.js
export default async function handler(req, res) {
  // 1) CORS — allow Shopify browser to call this
  res.setHeader('Access-Control-Allow-Origin', '*'); // for production restrict to your shop domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // quick answer for preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 2) Parse body safely — Vercel serverless sometimes provides raw string
    const raw = req.body ?? '{}';
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { image, productImage } = payload;

    if (!image || !productImage) {
      return res.status(400).json({ error: 'Missing "image" or "productImage" in request body' });
    }

    // 3) Check env var
    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) {
      return res.status(500).json({ error: 'HF_API_KEY is not set in environment variables' });
    }

    // 4) Call HuggingFace model
    const HF_URL = 'https://api-inference.huggingface.co/models/face-swapper/FaceSwap';

    const hfResp = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          source_img: image,
          target_img: productImage
        }
      }),
      // no timeout here; Vercel has its own function timeout limits
    });

    // 5) Handle upstream errors clearly
    if (!hfResp.ok) {
      const details = await hfResp.text();
      console.error('HuggingFace returned error', hfResp.status, details);
      return res.status(502).json({
        error: 'Upstream error from HuggingFace',
        status: hfResp.status,
        details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : undefined
      });
    }

    // 6) Convert binary response to base64 and return
    const arrayBuffer = await hfResp.arrayBuffer();
    const base64Output = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({ swapped: base64Output });
  } catch (err) {
    console.error('face-swap handler error:', err);
    // always return JSON (and CORS headers already set)
    return res.status(500).json({ error: (err && err.message) ? err.message : String(err) });
  }
}
