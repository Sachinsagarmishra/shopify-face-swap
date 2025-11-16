export default async function handler(req, res) {
  try {
    const { image, productImage } = JSON.parse(req.body);
    const hfKey = process.env.HF_API_KEY;

    const HF_URL = "https://api-inference.huggingface.co/models/face-swapper/FaceSwap";

    const response = await fetch(HF_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: {
          source_img: image,
          target_img: productImage
        }
      })
    });

    const arrayBuffer = await response.arrayBuffer();
    const base64Output = Buffer.from(arrayBuffer).toString("base64");

    res.status(200).json({ swapped: base64Output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}