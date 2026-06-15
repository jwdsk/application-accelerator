# MetaPause — Accelerator Agent

AI-powered tool that drafts accelerator and incubator applications from MetaPause's knowledge base, learns from human corrections over time.

---

## How it works

1. **Intake** — paste an application URL or upload a PDF. The agent extracts all questions.
2. **Draft** — Claude reads the MetaPause knowledge base and drafts answers for every question.
3. **Review** — team reviews, edits inline, approves or flags each answer. Export as text.
4. **Learn** — upload the human-corrected final version. The system extracts Q&A pairs and adds them to the KB. Future drafts improve automatically.

---

## First-time setup (30 minutes)

### 1. Clone the repo
```bash
git clone https://github.com/metapause/accelerator-agent
cd accelerator-agent
npm install
```

### 2. Create accounts (all free tier)

**Anthropic API**
- Go to console.anthropic.com
- Create account under MetaPause email
- Go to API Keys → Create key
- Copy the key (starts with `sk-ant-`)

**Vercel**
- Go to vercel.com
- Sign up with MetaPause GitHub account
- Import this repo → Deploy

**Vercel KV (Redis)**
- In Vercel dashboard → Storage → Create Database → KV
- Name it `metapause-kb`
- Go to `.env.local` tab → copy all four KV_ variables

**Vercel Blob**
- In Vercel dashboard → Storage → Create Database → Blob
- Name it `metapause-files`
- Copy the BLOB_READ_WRITE_TOKEN

### 3. Set environment variables

In Vercel dashboard → Project Settings → Environment Variables, add:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `KV_URL` | Vercel KV dashboard → .env.local tab |
| `KV_REST_API_URL` | same |
| `KV_REST_API_TOKEN` | same |
| `KV_REST_API_READ_ONLY_TOKEN` | same |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob dashboard |

For local development, copy `.env.example` to `.env.local` and fill in the same values.

### 4. Deploy
```bash
git push origin main
# Vercel auto-deploys on every push
```

---

## Updating the knowledge base

The knowledge base has three tiers:

**Tier 1 — Past corrected applications** (auto-populated via Learn tab)
Every time the team uploads a corrected application, Q&A pairs are automatically added here. This is the most valuable tier — it grows over time.

**Tier 2 — Canned Q&A + company profile** (edit via API or directly in KV)
To update the company profile or canned answers, either:
- Use the Vercel KV dashboard → browse keys → edit `kb:profile` or `kb:canned`
- Or call `POST /api/kb?type=profile` with updated JSON

**Tier 3 — Documents** (coming soon — pitch deck, one-pagers)
Currently not implemented. Add later if needed.

---

## Local development

```bash
npm run dev
# Opens at http://localhost:3000
```

---

## Costs

- **Vercel**: Free (Hobby plan covers this easily)
- **Vercel KV**: Free up to 30K requests/day
- **Vercel Blob**: Free up to 1GB storage
- **Anthropic API**: ~$0.08–0.34 per application processed

Check monthly API spend at console.anthropic.com → Billing.
