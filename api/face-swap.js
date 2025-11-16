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

    if (!image && !productImageUrl && !productImage) {
      return res.status(400).json({ error: 'Provide "image" (user base64) and either "productImage" (base64) or "productImageUrl" (full https URL).' });
    }

    const hfKey = process.env.HF_API_KEY;
    const hfModel = process.env.HF_MODEL || 'face-swapper/FaceSwap'; // <-- set this in Vercel
    if (!hfKey) return res.status(500).json({ error: 'HF_API_KEY not set in environment variables' });

    // fetch product image if URL provided (normalize // -> https:)
    let productBase64 = productImage;
    if (!productBase64 && productImageUrl) {
      let fetchUrl = productImageUrl.trim();
      if (fetchUrl.startsWith('//')) fetchUrl = 'https:' + fetchUrl;
      if (fetchUrl.startsWith('/')) {
        return res.status(400).json({ error: 'productImageUrl is relative (starts with /). Provide a full https:// URL.' });
      }
      const pResp = await fetch(fetchUrl);
      if (!pResp.ok) {
        const txt = await pResp.text().catch(()=>null);
        console.error('Failed to fetch product image', fetchUrl, pResp.status, txt);
        return res.status(502).json({ error: 'Failed to fetch product image URL', status: pResp.status, details: txt });
      }
      const ab = await pResp.arrayBuffer();
      productBase64 = Buffer.from(ab).toString('base64');
    }

    // Use HuggingFace router endpoint (router.huggingface.co/hf-inference)
    const routerUrl = 'https://router.huggingface.co/hf-inference';
    const routerBody = {
      model: hfModel,
      inputs: {
        source_img: image,
        target_img: productBase64
      }
    };

    const hfResp = await fetch(routerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(routerBody)
    });

    // If non-ok, return details (helps debug: will show if model not found)
    if (!hfResp.ok) {
      const details = await hfResp.text().catch(() => '[no body]');
      console.error('HuggingFace (router) error', hfResp.status, details);
      return res.status(502).json({
        error: 'Upstream error from HuggingFace router',
        status: hfResp.status,
        details
      });
    }

    // success -> binary image -> base64
    const arrayBuffer = await hfResp.arrayBuffer();
    const base64Output = Buffer.from(arrayBuffer).toString('base64');
    return res.status(200).json({ swapped: base64Output });

  } catch (err) {
    console.error('face-swap handler unexpected error:', err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
}
