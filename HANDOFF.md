# MetaPause Accelerator Agent — Handoff Guide

This document is written for whoever takes over this tool. You do not need to be technical to keep it running.

---

## Accounts you need access to

Ask the previous maintainer to transfer access to:

| Account | URL | What it holds |
|---|---|---|
| GitHub | github.com/metapause | All the code |
| Vercel | vercel.com | Where the app is hosted |
| Anthropic | console.anthropic.com | AI API — this is the bill |

All should be under a MetaPause email, not a personal one.

---

## Day-to-day: how to use the tool

1. Go to the app URL (find it in Vercel dashboard → your project → Visit)
2. Paste the accelerator application URL or upload the PDF
3. Give it a name (e.g. "YC W25")
4. Hit "Extract + draft" — wait ~30 seconds
5. Review each answer — edit inline, approve or flag
6. Download or copy the draft
7. Team edits the draft externally
8. Upload corrected version via the "Learn" tab
9. Done — the KB gets smarter

---

## Keeping the knowledge base current

The most important maintenance task. When MetaPause's situation changes — new metrics, new team member, funding round, pivot — update the KB.

**To update the company profile:**
1. Go to Vercel dashboard → your project → Storage → KV
2. Find the key `kb:profile`
3. Edit the JSON values
4. Save

**To add canned Q&A:**
Same steps, key is `kb:canned`. It's a JSON array — add a new `{ "question": "...", "answer": "..." }` object.

The corrected application pairs (Tier 1) update automatically every time someone uploads a corrected doc via the Learn tab. No action needed.

---

## If something breaks

**App not loading:**
- Go to vercel.com → your project → Deployments
- Check if latest deployment has errors
- Click the failed deployment → View logs

**Drafting fails:**
- Check console.anthropic.com → API Keys — make sure the key is active
- Check Vercel → Project Settings → Environment Variables — make sure `ANTHROPIC_API_KEY` is set

**"KV not found" errors:**
- Vercel KV may have been disconnected
- Go to Vercel → Storage → make sure `metapause-kb` is connected to your project

**To rotate the API key** (if compromised):
1. console.anthropic.com → API Keys → Create new key
2. Vercel → Project Settings → Environment Variables → update `ANTHROPIC_API_KEY`
3. Delete the old key in Anthropic console

---

## Monthly cost check

Go to console.anthropic.com → Billing → Usage.
Should be under $5/month for normal usage. If it spikes unexpectedly, check the usage logs for unusual activity.

---

## Who built this

Built by Jawad Sadat Khan (Product Manager, MetaPause) in June 2026.
For questions about the architecture, contact him or refer to README.md.
