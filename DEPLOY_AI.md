# Panduan Deploy smartOPR + Butang AI (tanpa Cloudflare / DeepSeek)

Seni bina baharu:

```
Browser (index.html)  ──POST /api/jana──►  Vercel Serverless Function (api/jana.js)  ──►  Google Gemini API (free tier)
```

- **Host**: Vercel (Hobby / percuma) — ganti Cloudflare Pages + Worker
- **Model AI**: Google Gemini `gemini-2.5-flash` — free tier, tiada kad kredit diperlukan
- Seluruh repo (laman statik + fungsi API) di-host di **satu tempat** = tiada isu CORS

---

## Langkah 1 — Dapatkan Gemini API key (percuma)

1. Buka <https://aistudio.google.com/app/apikey>
2. Log masuk akaun Google
3. Klik **Create API key** → **Create API key in new project**
4. Salin kunci (format `AIza...`). **Jangan** letak dalam kod / jangan commit.

Free tier `gemini-2.5-flash` (setakat 2026): ~15 permintaan/minit, kuota harian percuma yang besar. Cukup untuk kegunaan sekolah.

---

## Langkah 2 — Push kod ke GitHub

Fail baharu dalam repo ini:

| Fail | Fungsi |
|------|--------|
| `api/jana.js` | Proxy serverless — terima `{messages:[...]}`, panggil Gemini, pulang `{choices:[{message:{content}}]}` |
| `index.html` | `WORKER_URL` ditukar kepada `/api/jana`; teks popup dikemas kini |
| `.gitignore` | Abai `node_modules`, `.env`, `.vercel` |

```bash
cd D:\smartOPR
git add api/jana.js index.html .gitignore DEPLOY_AI.md RUJUKAN_OPR_KPM.md
git commit -m "Ganti AI DeepSeek/Cloudflare dengan proxy Gemini di Vercel"
git push origin main
```

---

## Langkah 3 — Deploy di Vercel

1. Buka <https://vercel.com/signup> → **Continue with GitHub** (guna akaun GitHub yang sama)
2. **Add New… → Project**
3. Pilih repo **`g-95272556-collab/smartOPR`** → **Import**
4. Bahagian **Framework Preset**: biar **Other** (laman statik) — jangan set build command
5. Buka **Environment Variables**, tambah:

   | Name | Value |
   |------|-------|
   | `GEMINI_API_KEY` | *(tampal kunci dari Langkah 1)* |
   | `GEMINI_MODEL` | `gemini-2.5-flash` *(pilihan)* |

6. Klik **Deploy**. Tunggu ~1 minit.
7. Anda dapat URL cth `https://smartopr.vercel.app` — ini laman baharu (ganti pautan Cloudflare lama).

> Setiap `git push` ke `main` selepas ini akan auto-deploy semula.

---

## Langkah 4 — Uji

Buka laman Vercel, isi **Nama Program**, tekan **✨ Jana AI** pada mana-mana medan.

Atau uji endpoint terus:

```bash
curl -sS -X POST "https://<nama-anda>.vercel.app/api/jana" ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Balas satu perkataan: OK\"}]}"
```

Jangkaan: `{"choices":[{"message":{"role":"assistant","content":"OK"}}]}`

---

## Menyahaktif Cloudflare lama (pilihan, selepas Vercel berjaya)

- Cloudflare Worker `smartopr-ai-v2` — boleh padam di dash.cloudflare.com → Workers & Pages
- Cloudflare Pages projek lama — boleh padam atau biarkan
- Tiada lagi kebergantungan pada DeepSeek

---

## Penyelesaian masalah

| Gejala | Punca | Tindakan |
|--------|-------|----------|
| `{"error":"Server belum dikonfigurasi: GEMINI_API_KEY tiada."}` | Env var tak di-set | Vercel → Settings → Environment Variables → tambah → **Redeploy** |
| `{"error":"API key tidak sah atau tiada akses."}` | Kunci salah / projek Google tak enable API | Jana kunci baharu di AI Studio |
| Popup "Had Penggunaan AI Dicapai" | Kuota/rate limit Gemini | Tunggu seminit / esok; atau naik taraf projek Google |
| Butang AI tak buat apa-apa, console `404 /api/jana` | Fail `api/jana.js` tak ter-push atau folder salah | Pastikan path betul: `api/jana.js` di root repo |
| CORS error (bila buka `index.html` sebagai fail tempatan) | Origin `file://` | Buka melalui URL Vercel, bukan double-click fail |
