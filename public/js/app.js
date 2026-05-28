// Sentinel Core — app.js

// ── CONFIG ──
const CFG = {
  token: localStorage.getItem('sentinel_token') || '',
  forceBrain: null
};

// ── STATE ──
let messages = [];
let isLoading = false;

// ── ELEMENTS ──
const chatEl      = () => document.getElementById('chat');
const inputEl     = document.getElementById('input');
const sendBtnEl   = document.getElementById('send-btn');
const toastEl     = document.getElementById('toast');
const thinkingEl  = document.getElementById('thinking-wrap');

// ══════════════════════════════════════
// NEBULA CANVAS
// ══════════════════════════════════════
function initNebula() {
  const canvas = document.getElementById('nebula-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, stars = [], time = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    stars = [];
    const count = Math.floor((W * H) / 5000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.2,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.6 + 0.1,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.02 + 0.005
      });
    }
  }

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    time += 0.008;

    // Nebula clouds
    const clouds = [
      { x: W*0.18, y: H*0.22, rx: W*0.45, ry: H*0.4, c1:'rgba(124,58,237,0.07)', c2:'transparent' },
      { x: W*0.8,  y: H*0.75, rx: W*0.4,  ry: H*0.45, c1:'rgba(59,130,246,0.06)', c2:'transparent' },
      { x: W*0.5,  y: H*0.5,  rx: W*0.35, ry: H*0.3,  c1:'rgba(79,70,229,0.04)', c2:'transparent' },
    ];
    clouds.forEach(c => {
      const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(c.rx, c.ry));
      grd.addColorStop(0, c.c1);
      grd.addColorStop(1, c.c2);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI*2);
      ctx.fillStyle = grd;
      ctx.fill();
    });

    // Stars
    stars.forEach(s => {
      s.twinkle += s.twinkleSpeed;
      const twinkOpacity = s.opacity * (0.6 + 0.4 * Math.sin(s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      // Alternate purple/blue/white for nebula feel
      const hue = (s.x / W * 60 + 220);
      ctx.fillStyle = `hsla(${hue},70%,85%,${twinkOpacity})`;
      ctx.fill();
    });

    requestAnimationFrame(drawFrame);
  }

  window.addEventListener('resize', resize);
  resize();
  drawFrame();
}

// ══════════════════════════════════════
// SPARKS
// ══════════════════════════════════════
function initSparks() {
  const container = document.getElementById('sparks');
  if (!container) return;
  const colors = ['#a78bfa','#818cf8','#38bdf8','#c4b5fd','#7c3aed'];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('div');
    el.className = 'spark';
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const dist = 55 + Math.random() * 45;
    el.style.cssText = `
      left:${50 + Math.cos(angle)*40}%;
      top:${50 + Math.sin(angle)*40}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      --tx:${Math.cos(angle)*dist}px;
      --ty:${Math.sin(angle)*dist}px;
      --dur:${2 + Math.random()*3}s;
      --delay:-${Math.random()*4}s;
      width:${1+Math.random()*2}px;
      height:${1+Math.random()*2}px;
    `;
    container.appendChild(el);
  }
}

// ══════════════════════════════════════
// SPLASH → CHAT TRANSITION
// ══════════════════════════════════════
function enterChat() {
  const splash = document.getElementById('splash');
  const chatUI = document.getElementById('chat-ui');

  splash.classList.add('hiding');
  setTimeout(() => {
    splash.style.display = 'none';
    chatUI.classList.add('visible');
    renderChatContent();
    if (!isMobile()) inputEl.focus();
    // Haptic on iPhone
    if (navigator.vibrate) navigator.vibrate(10);
  }, 550);
}

// ══════════════════════════════════════
// HEALTH CHECK ON SPLASH
// ══════════════════════════════════════
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    document.getElementById('splash-status').textContent = data.status === 'online' ? 'Online ✓' : 'Error';
    document.getElementById('splash-anth').textContent = data.anthropic ? 'Ready ✓' : 'No key';
    document.getElementById('splash-oai').textContent  = data.openai    ? 'Ready ✓' : 'No key';
  } catch(e) {
    document.getElementById('splash-status').textContent = 'Offline';
    document.getElementById('splash-anth').textContent = '—';
    document.getElementById('splash-oai').textContent  = '—';
  }
}

// ══════════════════════════════════════
// BRAIN SELECTION
// ══════════════════════════════════════
function selectBrain(id, el) {
  CFG.forceBrain = id === 'auto' ? null : id;
  document.querySelectorAll('.brain-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  const labels = {
    auto:'Auto-routing active', claude_sonnet:'GPT-5.5 Deep locked',
    claude_opus:'GPT-5.5 Max locked', gpt55:'GPT-5.5 locked',
    gpt54:'GPT-5.4 locked', gpt54_mini:'GPT-5.4 Mini locked'
  };
  document.getElementById('hdr-sub').textContent = labels[id] || id;
  showToast('› ' + (labels[id] || id));
}

// ══════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════
function openSettings()  { document.getElementById('overlay').classList.add('show'); }
function closeSettings() { document.getElementById('overlay').classList.remove('show'); }
function handleOverlayTap(e) { if (e.target === document.getElementById('overlay')) closeSettings(); }

function promptToken() {
  closeSettings();
  setTimeout(() => {
    const t = prompt('Enter your Sentinel access token:');
    if (t && t.trim()) {
      localStorage.setItem('sentinel_token', t.trim());
      CFG.token = t.trim();
      showToast('› Token saved');
    }
  }, 320);
}

function clearHistory() {
  closeSettings();
  setTimeout(() => {
    if (confirm('Clear all conversation history?')) {
      messages = [];
      localStorage.removeItem('sentinel_msgs');
      renderChatContent();
      showToast('› History cleared');
    }
  }, 320);
}

// ══════════════════════════════════════
// STORAGE
// ══════════════════════════════════════
function saveMessages() {
  try { localStorage.setItem('sentinel_msgs', JSON.stringify(messages.slice(-60))); } catch(e){}
}
function loadMessages() {
  try {
    const s = localStorage.getItem('sentinel_msgs');
    if (s) messages = JSON.parse(s);
  } catch(e) { messages = []; }
}

// ══════════════════════════════════════
// RENDER
// ══════════════════════════════════════
function renderChatContent() {
  const el = chatEl();
  el.innerHTML = '';
  if (messages.length === 0) { renderEmpty(); return; }
  messages.forEach(m => appendMsg(m, false));
  scrollBottom();
}

function renderEmpty() {
  const el = chatEl();
  const div = document.createElement('div');
  div.className = 'chat-empty';
  div.innerHTML = `
    <div class="chat-empty-label">Quick start</div>
    <div class="quick-grid">
      <div class="quick-card" onclick="useQuick('Explain VLANs with Cisco IOS lab commands')">
        <div class="qc-icon">🔀</div><div class="qc-label">VLANs + Cisco lab</div>
      </div>
      <div class="quick-card" onclick="useQuick('Create Anki flashcards for TCP/IP fundamentals')">
        <div class="qc-icon">🃏</div><div class="qc-label">TCP/IP flashcards</div>
      </div>
      <div class="quick-card" onclick="useQuick('Linux server hardening checklist')">
        <div class="qc-icon">🛡</div><div class="qc-label">Linux hardening</div>
      </div>
      <div class="quick-card" onclick="useQuick('Help me structure a GDPR DPIA report')">
        <div class="qc-icon">📋</div><div class="qc-label">GDPR DPIA report</div>
      </div>
      <div class="quick-card" onclick="useQuick('Explain the TLS handshake step by step with analogies')">
        <div class="qc-icon">🔐</div><div class="qc-label">TLS handshake</div>
      </div>
      <div class="quick-card" onclick="useQuick('Give me a Cisco IOS essential commands cheat sheet')">
        <div class="qc-icon">💻</div><div class="qc-label">Cisco IOS cheatsheet</div>
      </div>
    </div>
  `;
  el.appendChild(div);
}

function useQuick(text) {
  inputEl.value = text;
  autoResize();
  sendMessage();
}

// ══════════════════════════════════════
// SEND
// ══════════════════════════════════════
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isLoading) return;

  if (!CFG.token) {
    showToast('⚠ Set access token in settings first');
    openSettings();
    return;
  }

  // Remove empty state
  chatEl().querySelector('.chat-empty')?.remove();

  const userMsg = { role:'user', content:text, time:Date.now() };
  messages.push(userMsg);
  appendMsg(userMsg);
  saveMessages();

  inputEl.value = '';
  inputEl.style.height = 'auto';
  setLoading(true);
  showThinking();

  try {
    const res = await fetch('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-sentinel-token':CFG.token},
      body:JSON.stringify({
        message:text,
        history:messages.slice(-20).map(m=>({role:m.role,content:m.content})),
        forceBrain:CFG.forceBrain
      })
    });
    const data = await res.json();
    hideThinking();

    if (!res.ok || data.error) throw new Error(data.error || 'Server error '+res.status);

    const agentMsg = { role:'assistant', content:data.reply, brain:data.brain, time:Date.now() };
    messages.push(agentMsg);
    appendMsg(agentMsg);
    saveMessages();

    // Update header sub with which brain was used
    if (data.brain && !CFG.forceBrain) {
      document.getElementById('hdr-sub').textContent = `Auto → ${data.brain.label}`;
    }

  } catch(err) {
    hideThinking();
    const errMsg = { role:'assistant', content:`**Error:** ${err.message || 'Could not reach Sentinel.'}`, brain:null, time:Date.now() };
    messages.push(errMsg);
    appendMsg(errMsg);
    showToast('⚠ ' + (err.message || 'Error'));
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════
// MESSAGE RENDERING
// ══════════════════════════════════════
function appendMsg(msg, animate=true) {
  const isAgent = msg.role === 'assistant';
  const div = document.createElement('div');
  div.className = 'msg ' + (isAgent ? 'agent' : 'user');
  if (!animate) div.style.animation = 'none';

  const time = msg.time
    ? new Date(msg.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
    : '';

  const brainHtml = isAgent && msg.brain
    ? `<span class="brain-tag" style="color:${msg.brain.color};border-color:${msg.brain.color}40;background:${msg.brain.color}14">${msg.brain.icon||'◆'} ${msg.brain.label}</span>`
    : '';

  const meta = isAgent
    ? `<div class="msg-meta"><span class="msg-sender">SN · ${time}</span>${brainHtml}</div>`
    : `<div class="msg-meta" style="justify-content:flex-end"><span class="msg-sender">MH · ${time}</span></div>`;

  div.innerHTML = `
    <div class="msg-av">${isAgent?'SN':'MH'}</div>
    <div class="msg-body">
      ${meta}
      <div class="msg-bubble">${isAgent ? md(msg.content) : esc(msg.content)}</div>
    </div>`;

  chatEl().appendChild(div);
  if (animate) scrollBottom();
}

// ══════════════════════════════════════
// THINKING
// ══════════════════════════════════════
function showThinking() {
  thinkingEl.style.display = 'block';
  thinkingEl.innerHTML = `
    <div class="thinking-row">
      <div class="thinking-av">SN</div>
      <div class="thinking-bubble">
        <span class="thinking-label">routing</span>
        <span class="tdot"></span>
        <span class="tdot"></span>
        <span class="tdot"></span>
      </div>
    </div>`;
  scrollBottom();
}
function hideThinking() {
  thinkingEl.style.display = 'none';
  thinkingEl.innerHTML = '';
}

// ══════════════════════════════════════
// UTILS
// ══════════════════════════════════════
function setLoading(v) { isLoading=v; sendBtnEl.disabled=v; }
function scrollBottom() { requestAnimationFrame(() => { const el=chatEl(); el.scrollTop=el.scrollHeight; }); }
function isMobile() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); }

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140)+'px';
}
inputEl.addEventListener('input', autoResize);

function handleKey(e) {
  if (e.key==='Enter' && !e.shiftKey && !isMobile()) { e.preventDefault(); sendMessage(); }
}

function showToast(msg, ms=2400) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// iOS viewport fix for keyboard
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const appEl = document.getElementById('chat-ui');
    if (appEl && appEl.classList.contains('visible')) {
      appEl.style.height = window.visualViewport.height + 'px';
      scrollBottom();
    }
  });
}

// ══════════════════════════════════════
// MARKDOWN PARSER
// ══════════════════════════════════════
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function md(text) {
  let h = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, (_,l,c) =>
    `<pre><code>${c.trim()}</code></pre>`);
  h = h.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  h = h.replace(/^#### (.+)$/gm,'<h3>$1</h3>');
  h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h = h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  h = h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  h = h.replace(/^---+$/gm,'<hr>');

  // Tables
  h = h.replace(/(\|.+\|\n?)+/g, match => {
    const rows = match.trim().split('\n').filter(r=>r.includes('|'));
    if (rows.length < 2) return match;
    const isDiv = r => /^\|[\s\-:]+\|/.test(r);
    const head = rows[0]; const rest = rows.slice(isDiv(rows[1]) ? 2 : 1);
    const th = head.split('|').filter(c=>c.trim()).map(c=>`<th>${c.trim()}</th>`).join('');
    const td = rest.map(r=>'<tr>'+r.split('|').filter(c=>c.trim()).map(c=>`<td>${c.trim()}</td>`).join('')+'</tr>').join('');
    return `<table><thead><tr>${th}</tr></thead><tbody>${td}</tbody></table>`;
  });

  // Lists
  h = h.replace(/(^[\-\*\+] .+(\n[\-\*\+] .+)*)/gm, m => {
    const items = m.split('\n').filter(l=>/^[\-\*\+] /.test(l)).map(l=>`<li>${l.replace(/^[\-\*\+] /,'')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  h = h.replace(/(^\d+\. .+(\n\d+\. .+)*)/gm, m => {
    const items = m.split('\n').filter(l=>/^\d+\./.test(l)).map(l=>`<li>${l.replace(/^\d+\. /,'')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  h = h.replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs
  const lines = h.split('\n'); const out = []; let para = '';
  const isBlock = t => /^<(h[1-6]|ul|ol|pre|hr|blockquote|table)/.test(t);
  for (const line of lines) {
    const t = line.trim();
    if (!t) { if(para){out.push(`<p>${para}</p>`);para='';} }
    else if (isBlock(t)) { if(para){out.push(`<p>${para}</p>`);para='';} out.push(t); }
    else { para += (para?' ':'')+t; }
  }
  if (para) out.push(`<p>${para}</p>`);
  return out.join('\n');
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
function init() {
  initNebula();
  initSparks();
  loadMessages();
  checkHealth();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
}

init();
