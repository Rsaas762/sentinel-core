// server/index.js — Sentinel Core Backend
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { routeBrain, BRAINS } = require('./brain-router');
const { SENTINEL_SYSTEM } = require('./sentinel-prompt');

const app = express();
const PORT = process.env.PORT || 3000;

// ── SECURITY MIDDLEWARE ──
app.use(helmet({
  contentSecurityPolicy: false
}));
      

app.use(cors({ origin: false })); // No CORS — same origin only
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ── RATE LIMITING ──
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: { error: 'Too many requests — slow down.' }
});
app.use('/api/', limiter);

// ── AUTH MIDDLEWARE ──
function requireAuth(req, res, next) {
  const token = req.headers['x-sentinel-token'];
  const expected = process.env.ACCESS_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

// ── HEALTH CHECK ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    agent: 'Sentinel',
    version: '1.0.0',
    brains: Object.keys(BRAINS),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY
  });
});

// ── BRAINS LIST ──
app.get('/api/brains', requireAuth, (req, res) => {
  const list = Object.values(BRAINS).map(b => ({
    id: b.id,
    label: b.label,
    provider: b.provider,
    icon: b.icon,
    color: b.color
  }));
  res.json({ brains: list });
});

// ── ROUTE PREVIEW (which brain would handle this?) ──
app.post('/api/route', requireAuth, (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  const result = routeBrain(message, history || []);
  res.json({
    brain: { id: result.brain.id, label: result.brain.label, color: result.brain.color },
    reasoning: result.reasoning
  });
});

// ── MAIN CHAT ENDPOINT ──
app.post('/api/chat', requireAuth, async (req, res) => {
  const { message, history, forceBrain } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  if (message.length > 8000) {
    return res.status(400).json({ error: 'Message too long (max 8000 chars)' });
  }

  // Route to best brain
  let selectedBrain;
  if (forceBrain && BRAINS[forceBrain]) {
    selectedBrain = BRAINS[forceBrain];
    var reasoning = 'Manual override';
  } else {
    const route = routeBrain(message, history || []);
    selectedBrain = route.brain;
    var reasoning = route.reasoning;
  }

  // Build conversation history
  const safeHistory = (history || [])
    .slice(-20) // Keep last 20 messages max
    .filter(m => m.role && m.content && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const messages = [...safeHistory, { role: 'user', content: message }];

  try {
    let reply;

    if (selectedBrain.provider === 'anthropic') {
      reply = await callAnthropic(selectedBrain.model, messages);
    } else if (selectedBrain.provider === 'openai') {
      reply = await callOpenAI(selectedBrain.model, messages);
    } else {
      throw new Error('Unknown provider');
    }

    res.json({
      reply,
      brain: { id: selectedBrain.id, label: selectedBrain.label, color: selectedBrain.color, icon: selectedBrain.icon },
      reasoning
    });

  } catch (err) {
    console.error('[Sentinel] Chat error:', err.message);

    // Fallback: try Claude Sonnet if another brain failed
    if (selectedBrain.id !== 'claude_sonnet') {
      try {
        const fallback = BRAINS['claude_sonnet'];
        const reply = await callAnthropic(fallback.model, messages);
        res.json({
          reply,
          brain: { id: fallback.id, label: fallback.label + ' (fallback)', color: fallback.color, icon: fallback.icon },
          reasoning: 'Fallback — primary brain failed'
        });
        return;
      } catch (fallbackErr) {
        console.error('[Sentinel] Fallback also failed:', fallbackErr.message);
      }
    }

    res.status(500).json({ error: err.message || 'Agent error — try again.' });
  }
});

// ── ANTHROPIC CALL ──
async function callAnthropic(model, messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not configured.');

  const { default: fetch } = await import('node-fetch');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SENTINEL_SYSTEM,
      messages
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Anthropic error');
  return data.content.map(b => b.text || '').join('');
}

// ── OPENAI CALL ──
async function callOpenAI(model, messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured.');

  const { default: fetch } = await import('node-fetch');

  // GPT-5.x models use the Responses API; older models use Chat Completions
  const isGPT5 = model.startsWith('gpt-5');

  if (isGPT5) {
    // OpenAI Responses API (GPT-5.x family)
    const openaiMessages = [
      { role: 'system', content: SENTINEL_SYSTEM },
      ...messages
    ];
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 2048,
        input: openaiMessages
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'OpenAI error');
    // Responses API returns output array of content blocks
    const textBlocks = (data.output || [])
      .flatMap(o => o.content || [])
      .filter(c => c.type === 'output_text')
      .map(c => c.text)
      .join('');
    return textBlocks || data.output_text || '';
  } else {
    // Chat Completions API (GPT-4.x and older)
    const openaiMessages = [
      { role: 'system', content: SENTINEL_SYSTEM },
      ...messages
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, max_tokens: 2048, messages: openaiMessages })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'OpenAI error');
    return data.choices?.[0]?.message?.content || '';
  }
}

// ── SPA FALLBACK ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── START ──
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║   SENTINEL CORE — ONLINE     ║`);
  console.log(`║   Port: ${PORT}                  ║`);
  console.log(`║   Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓' : '✗ MISSING'}             ║`);
  console.log(`║   OpenAI:    ${process.env.OPENAI_API_KEY ? '✓' : '✗ MISSING'}             ║`);
  console.log(`╚══════════════════════════════╝\n`);
});
