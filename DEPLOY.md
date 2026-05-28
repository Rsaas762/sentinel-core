# Sentinel Core — Deployment Guide

## Overview
Node.js app (Express backend + PWA frontend).
Railway is the recommended host — one-click deploy, always-on free tier.

---

## 1 — Set up keys

Copy and fill in:
```
cp .env.example .env
```

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
ACCESS_TOKEN=generate-with: openssl rand -hex 32
PORT=3000
NODE_ENV=production
```

---

## 2 — Deploy to Railway (recommended)

### Option A: GitHub (easiest)
1. Push this folder to a GitHub repo (can be private)
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo
4. Railway auto-detects Node.js and runs `npm start`
5. Go to Variables tab → add your 4 env vars
6. Go to Settings → Networking → Generate Domain
7. Your app is live at `https://your-app.up.railway.app`

### Option B: Railway CLI
```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set OPENAI_API_KEY=sk-...
railway variables set ACCESS_TOKEN=your-secret
railway variables set NODE_ENV=production
railway domain
```

Railway free tier: 500 hours/month + $5 credit — more than enough for personal use.
Upgrade to Hobby ($5/mo) for always-on with no sleep.

---

## 3 — Install on iPhone (PWA)

**The app runs as a native-feeling iPhone app with no App Store needed.**

1. Open **Safari** on your iPhone (must be Safari, not Chrome)
2. Go to your Railway URL — must be HTTPS (Railway provides this automatically)
3. Tap the **Share** button (square with arrow pointing up)
4. Tap **"Add to Home Screen"**
5. Name it `Sentinel` → tap **Add**
6. The app now opens full-screen from your home screen with no browser UI

The knight helmet splash screen shows on every launch.

---

## 4 — First use

1. Open Sentinel from your iPhone home screen
2. You'll see the splash screen with the helmet logo and status indicators
3. Tap **ENTER COMMAND CENTER**
4. Tap ⚙ Settings → Access Token → enter your `ACCESS_TOKEN` value
5. Done. Start talking to Sentinel.

The token saves to localStorage — you only enter it once per device.

---

## 5 — How multi-brain routing works

Every message is automatically analyzed and sent to the best brain:

| Brain | Model | Best for |
|-------|-------|----------|
| Claude Sonnet | claude-sonnet-4 | Security, Linux, GDPR, notes, code, Cisco |
| Claude Opus | claude-opus-4 | Deep research, complex analysis, long docs |
| GPT-5.5 | gpt-5.5 | Flagship reasoning, creative, hard problems |
| GPT-5.4 | gpt-5.4 | Professional writing, translation, summaries |
| GPT-5.4 Mini | gpt-5.4-mini | Fast lookups, short answers |

Tap a brain chip in the bar to lock a specific model for that session.
Tap **Auto** to go back to automatic routing.

---

## 6 — Local development

```bash
npm install
cp .env.example .env   # fill in your keys
npm run dev            # starts with nodemon on port 3000
# open http://localhost:3000
```

---

## File structure

```
sentinel-core/
├── server/
│   ├── index.js            Express server, API routes, auth
│   ├── brain-router.js     Auto-routing logic
│   └── sentinel-prompt.js  Full Sentinel system prompt
├── public/
│   ├── index.html          iPhone PWA — splash + chat UI
│   ├── manifest.json       PWA manifest (home screen config)
│   ├── sw.js               Service worker (offline shell)
│   ├── css/app.css         (merged into index.html)
│   ├── js/app.js           Frontend: nebula canvas, chat, routing
│   └── icons/              App icons (192px, 512px)
├── railway.toml            Railway deploy config
├── Procfile                Fallback process file
├── .env.example            Template for environment variables
└── DEPLOY.md               This file
```
