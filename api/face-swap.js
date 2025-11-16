// api/face-swap.js
export default async function handler(req, res) {
  // CORS (allow Shopify). For production restrict to your shop domain.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // parse body safely
    const raw = req.body ?? '{}';
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { image, productImage, productImageUrl } = payload;

    if (!image && !productImageUrl) {
      return res.status(400).json({ error: 'Provide "image" (user base64) or "productImageUrl" (shop image URL).' });
    }

    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) return res.status(500).json({ error: 'HF_API_KEY not set in environment variables' });

    // If client provided productImageUrl, fetch the product image server-side (avoids browser CORS & big payloads).
    let productBase64 = productImage;
    if (!productBase64 && productImageUrl) {
      // fetch product image as binary and convert to base64
      const pResp = await fetch(productImageUrl);
      if (!pResp.ok) {
        const txt = await pResp.text().catch(()=>null);
        console.error('Failed to fetch product image', productImageUrl, pResp.status, txt);
        return res.status(502).json({ error: 'Failed to fetch product image URL', status: pResp.status, details: txt });
      }
      const ab = await pResp.arrayBuffer();
      productBase64 = Buffer.from(ab).toString('base64');
    }

    // Prepare HF request
    const HF_URL = 'https://api-inference.huggingface.co/models/face-swapper/FaceSwap';

    const hfResp = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          source_img: image,         // user's face base64 (optional if HF model supports URL)
          target_img: productBase64  // product image base64
        }
      })
    });

    // if HF returns non-ok, capture details and forward helpful error
    if (!hfResp.ok) {
      const details = await hfResp.text().catch(() => '[no body]');
      console.error('HuggingFace error', hfResp.status, details);
      return res.status(502).json({ error: 'Upstream error from HuggingFace', status: hfResp.status, details });
    }

    // HF returns binary image -> convert to base64 string
    const arrayBuffer = await hfResp.arrayBuffer();
    const base64Output = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({ swapped: base64Output });

  } catch (err) {
    console.error('face-swap handler unexpected error:', err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
}
