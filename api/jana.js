// Proxy AI untuk smartOPR — Vercel Serverless Function
// Endpoint: POST /api/jana
// Menggantikan Cloudflare Worker + DeepSeek. Guna Google Gemini (free tier).
//
// Env var yang diperlukan (set di Vercel > Project > Settings > Environment Variables):
//   GEMINI_API_KEY  = kunci dari https://aistudio.google.com/app/apikey  (WAJIB)
//   GEMINI_MODEL    = model pilihan (pilihan; default: gemini-2.5-flash)
//
// Kontrak permintaan (kekal sama seperti app sedia ada):
//   body: { "messages": [ { "role": "user", "content": "..." } ] }
// Kontrak respons:
//   { "choices": [ { "message": { "role": "assistant", "content": "..." } } ] }
//   atau { "error": "..." }  /  { "error": "kredit_habis" }

const DEFAULT_MODEL = 'gemini-2.5-flash';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Kaedah tidak dibenarkan. Guna POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: GEMINI_API_KEY tiada.' });
  }

  // Baca body (Vercel biasanya sudah parse JSON; tangani kes string juga)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    return res.status(400).json({ error: 'Tiada mesej dihantar.' });
  }

  // Petakan mesej gaya OpenAI -> format Gemini
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
    .trim();

  const contents = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content ?? '') }],
    }));

  if (!contents.length) {
    return res.status(400).json({ error: 'Tiada kandungan pengguna yang sah.' });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
      // gemini-2.5-* mengaktifkan "thinking" secara lalai dan ia memakan
      // bajet token output -> teks jawapan terpotong. Matikan.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (systemText) {
    payload.systemInstruction = { parts: [{ text: systemText }] };
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const status = upstream.status;
      const reason = data?.error?.status || '';
      const msg = data?.error?.message || `Ralat upstream HTTP ${status}`;

      // Kuota / had kadar habis -> guna popup sedia ada dalam app
      if (status === 429 || reason === 'RESOURCE_EXHAUSTED') {
        return res.status(200).json({ error: 'kredit_habis' });
      }
      // Kunci tidak sah
      if (status === 400 || status === 403 || reason === 'PERMISSION_DENIED') {
        return res.status(200).json({ error: 'API key tidak sah atau tiada akses. Semak GEMINI_API_KEY.' });
      }
      return res.status(200).json({ error: msg });
    }

    // Ekstrak teks
    const cand = data?.candidates?.[0];
    let text = (cand?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();

    // Bersihkan penanda markdown yang tidak sesuai untuk kotak teks biasa
    text = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // **tebal**
      .replace(/(^|\s)\*(?!\s)([^*\n]+?)\*(?=\s|$)/g, '$1$2') // *italik*
      .replace(/^#{1,6}\s+/gm, '') // tajuk #
      .replace(/^\s*(berikut(?:\s+\w+){0,5}[:：])\s*$/im, '') // buang baris pembukaan "Berikut ...:"
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text) {
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        return res.status(200).json({ error: `Kandungan disekat oleh penapis keselamatan (${blockReason}). Cuba ubah input.` });
      }
      return res.status(200).json({ error: 'Tiada kandungan dijana. Cuba semula.' });
    }

    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: text } }],
    });
  } catch (err) {
    return res.status(200).json({ error: 'Ralat sambungan ke pelayan AI: ' + (err?.message || String(err)) });
  }
};
