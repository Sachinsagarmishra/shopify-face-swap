// api/face-swap.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const raw = req.body ?? '{}';
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { image, productImage, productImageUrl } = payload;

    if (!image && !productImageUrl) {
      return res.status(400).json({ error: 'Provide "image" (user base64) or "productImageUrl" (shop image URL).' });
    }

    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) return res.status(500).json({ error: 'HF_API_KEY not set in environment variables' });

    // Normalize product image: prefer productImage (base64), otherwise fetch productImageUrl
    let productBase64 = productImage;

    if (!productBase64 && productImageUrl) {
      // If URL is protocol-relative (starts with //) prepend https:
      let fetchUrl = productImageUrl;
      if (typeof fetchUrl === 'string' && fetchUrl.startsWith('//')) {
        fetchUrl = 'https:' + fetchUrl;
      }
      // If URL missing protocol but starts with single / (relative), attempt to prepend https:// + host (not ideal) — we will fail safely
      if (typeof fetchUrl === 'string' && fetchUrl.startsWith('/')) {
        // best-effort: assume shop domain included in incoming URL? otherwise return helpful error
        return res.status(400).json({ error: 'productImageUrl looks relative (starts with "/"). Provide a full https:// URL or use Liquid to output full URL.' });
      }

      // fetch product image binary from the shop CDN
      const pResp = await fetch(fetchUrl);
      if (!pResp.ok) {
        const txt = await pResp.text().catch(()=>null);
        console.error('Failed to fetch product image', fetchUrl, pResp.status, txt);
        return res.status(502).json({ error: 'Failed to fetch product image URL', status: pResp.status, details: txt });
      }
      const ab = await pResp.arrayBuffer();
      productBase64 = Buffer.from(ab).toString('base64');
    }

    // Call HuggingFace model
    const HF_URL = 'https://api-inference.huggingface.co/models/face-swapper/FaceSwap';
    const hfResp = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { source_img: image, target_img: productBase64 }
      })
    });

    if (!hfResp.ok) {
      const details = await hfResp.text().catch(() => '[no body]');
      console.error('HuggingFace error', hfResp.status, details);
      return res.status(502).json({ error: 'Upstream error from HuggingFace', status: hfResp.status, details });
    }

    const arrayBuffer = await hfResp.arrayBuffer();
    const base64Output = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({ swapped: base64Output });
  } catch (err) {
    console.error('face-swap handler unexpected error:', err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
}
