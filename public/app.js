const socket = io();

let currentView = 'dashboard';
let botsData = [];
let logBuf = [];
let chatBuf = [];
const MAX_LOG = 200;

const ANIM_DEFS = {
  orbit:    [{id:'cx',l:'X'},{id:'cz',l:'Z'},{id:'r',l:'R',d:'5'},{id:'s',l:'Spd',d:'0.05'},{id:'f',l:'Face',d:'tangent'}],
  forbit:   [{id:'user',l:'User'},{id:'r',l:'R',d:'5'},{id:'s',l:'Spd',d:'0.005'}],
  donut:    [{id:'cx',l:'X'},{id:'cz',l:'Z'},{id:'r',l:'R',d:'8'},{id:'amp',l:'Amp',d:'3'},{id:'s',l:'Spd',d:'0.05'}],
  airjump:  [{id:'cx',l:'X'},{id:'cz',l:'Z'},{id:'r',l:'R',d:'8'},{id:'amp',l:'Amp',d:'3'},{id:'s',l:'Spd',d:'0.05'}],
  wjump:    [{id:'cx',l:'X'},{id:'cz',l:'Z'},{id:'r',l:'R',d:'8'},{id:'h',l:'H',d:'2'},{id:'s',l:'Spd',d:'0.08'}],
  star:     [{id:'cx',l:'X'},{id:'cz',l:'Z'},{id:'or',l:'OR',d:'10'},{id:'ir',l:'IR',d:'4'},{id:'s',l:'Spd',d:'0.001'}],
  fly:      [{id:'dir',l:'Dir',d:'up'},{id:'blk',l:'Blk',d:'10'},{id:'s',l:'Spd',d:'0.1'}],
  follow:   [{id:'user',l:'User'},{id:'r',l:'R',d:'3'},{id:'s',l:'Spd',d:'0.28'}],
  snake:    [{id:'user',l:'User'},{id:'dist',l:'Dist',d:'2'},{id:'s',l:'Spd',d:'0.28'}],
};

const PRESETS = [
  { anim:'orbit', vals:['0','0','5','0.05','tangent'] },
  { anim:'star', vals:['0','0','10','4','0.001'] },
  { anim:'donut', vals:['0','0','8','3','0.05'] },
];
let presetOpen = -1;

const CMDS = [
  [{l:'LC',c:'lc'},{l:'Click L',c:'click left'},{l:'Click R',c:'click right'},{l:'Farm',c:'farm'},{l:'Tab',c:'tab'},{l:'Near',c:'near'}],
  [{l:'Gravity',c:'phy'},{l:'Slot 1',c:'slot 1'},{l:'GUI',c:'gui open'},{l:'Hub',c:'hub'},{l:'Spawn',c:'spawn'},{l:'Log',c:'log'}],
  [{l:'Left 1',c:'left 1'},{l:'Right 1',c:'right 1'},{l:'Front 1',c:'front 1'},{l:'Back 1',c:'back 1'},{l:'Jump',c:'jump'},{l:'Sneak',c:'sneak'}],
];

// ── Navigation ──
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    currentView = el.dataset.view;
    document.getElementById('page-title').textContent = el.textContent.trim();
    renderView();
  });
});

// ── View renderer ──
function renderView() {
  const c = document.getElementById('view-container');
  if (currentView === 'dashboard') renderDashboard(c);
  else if (currentView === 'bots') renderBots(c);
  else if (currentView === 'commands') renderCommands(c);
  else if (currentView === 'movement') renderMovement(c);
  else if (currentView === 'animations') renderAnimations(c);
  else if (currentView === 'chat') renderChat(c);
  else if (currentView === 'console') renderConsole(c);
  else if (currentView === 'statistics') renderStatistics(c);
  else if (currentView === 'settings') renderSettings(c);
}

function renderDashboard(c) {
  const online = botsData.length;
  c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Goons Online</div><div class="stat-value">${online}</div></div>
      <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value" id="d-uptime">0s</div></div>
      <div class="stat-card"><div class="stat-label">Commands</div><div class="stat-value" id="d-cmds">0</div></div>
      <div class="stat-card"><div class="stat-label">Messages</div><div class="stat-value" id="d-msgs">0</div></div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:16px">Terminal</div>
      <div class="console-view" id="d-log" style="height:35vh"></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input id="d-term" placeholder="Type command or chat..." style="flex:1">
        <button class="btn btn-primary" onclick="dExec()">Send</button>
        <button class="btn btn-ghost" onclick="clrLog()">Clear</button>
      </div>
    </div>`;
  document.getElementById('d-term').addEventListener('keydown', e => { if (e.key === 'Enter') dExec(); });
  const out = document.getElementById('d-log');
  if (out) out.innerHTML = logBuf.slice(-100).join('<br>');
}

function dExec() {
  const val = document.getElementById('d-term').value.trim();
  if (!val) return;
  send(val);
  document.getElementById('d-term').value = '';
}

function renderBots(c) {
  if (!botsData.length) { c.innerHTML = '<div class="empty">No bots connected</div>'; return; }
  c.innerHTML = `
    <div class="card" style="padding:0">
      <table class="bot-table">
        <thead><tr><th>#</th><th>Username</th><th>HP</th><th>Food</th><th>Pos</th><th>Item</th><th>Physics</th></tr></thead>
        <tbody>${botsData.map((b,i) => `
          <tr><td>${i+1}</td><td>${b.username}</td><td>${(b.health||0).toFixed(1)}</td><td>${b.food||0}</td>
          <td>${b.position.x},${b.position.y},${b.position.z}</td><td>${b.heldItem}</td>
          <td>${b.physicsEnabled ? 'ON' : 'OFF'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderCommands(c) {
  c.innerHTML = `<div class="cmd-grid">${CMDS.map(row =>
    row.map(b => `<button class="btn ${b.c==='stop'?'btn-danger':'btn-ghost'}" onclick="send('${b.c}')">${b.l}</button>`).join('')
  ).join('')}</div>`;
}

function renderMovement(c) {
  c.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:16px">D-Pad Movement</div>
      <div style="display:grid;grid-template-columns:40px 40px 40px;gap:4px;margin-bottom:16px">
        <div></div><button class="btn btn-ghost" style="padding:6px" onclick="mov('front')">▲</button><div></div>
        <button class="btn btn-ghost" style="padding:6px" onclick="mov('left')">◀</button>
        <button class="btn btn-ghost" style="padding:6px" onclick="mov('back')">▼</button>
        <button class="btn btn-ghost" style="padding:6px" onclick="mov('right')">▶</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <label style="font-size:12px;color:var(--text-dim)">Blocks:</label>
        <input type="number" id="blk" value="1" min="1" step="1" style="width:60px">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="send('jump')">Jump</button>
        <button class="btn btn-ghost" onclick="send('sneak')">Sneak</button>
        <button class="btn btn-ghost" onclick="send('spin 0.15')">Spin</button>
        <button class="btn btn-ghost" onclick="send('spin stop')">Spin Stop</button>
        <button class="btn btn-primary" onclick="send('fly up 10')">Fly Up</button>
        <button class="btn btn-primary" onclick="send('fly down 10')">Fly Down</button>
        <button class="btn btn-ghost" onclick="send('fly stop')">Fly Stop</button>
        <button class="btn btn-danger" onclick="send('stop')">STOP</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:8px">Current Animation</div>
      <div style="font-family:var(--mono);font-size:24px;color:var(--accent)" id="cur-anim">-</div>
    </div>`;
}

let customAnim = '';
function renderAnimations(c) {
  c.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:16px">Presets</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        ${PRESETS.map((p,i) => `<button class="btn ${presetOpen===i?'btn-primary':'btn-ghost'}" onclick="togglePreset(${i})">${p.anim}</button>`).join('')}
      </div>
      <div id="preset-details"></div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:12px">Custom Animation</div>
      <select class="adrop" id="anim-drop" onchange="onAnimChange()">
        <option value="">— Select —</option>
        ${Object.keys(ANIM_DEFS).map(k => `<option value="${k}">${k}</option>`).join('')}
      </select>
      <div id="custom-anim"></div>
    </div>`;
  renderPresets();
}

function renderPresets() {
  const container = document.getElementById('preset-details');
  if (!container) return;
  container.innerHTML = PRESETS.map((p,i) => `
    <div class="preset-detail ${i===presetOpen?'open':''}" id="pd-${i}">
      <div style="color:var(--accent);margin-bottom:4px">${p.anim}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        ${ANIM_DEFS[p.anim].map((f,j) => `
          <div style="flex:1;min-width:50px">
            <label style="font-size:10px;color:var(--text-muted)">${f.l}</label>
            <input type="text" id="pp-${i}-${j}" value="${p.vals[j]||''}" style="font-family:var(--mono);font-size:11px">
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary" onclick="pstart(${i})" style="height:32px;font-size:11px">Start</button>
        <button class="btn btn-ghost" onclick="send('${p.anim} stop')" style="height:32px;font-size:11px">Stop</button>
      </div>
    </div>`).join('');
}

function togglePreset(i) {
  presetOpen = presetOpen === i ? -1 : i;
  renderPresets();
}

function pstart(i) {
  const p = PRESETS[i];
  const vals = p.vals.map((_,j) => document.getElementById(`pp-${i}-${j}`).value);
  send(p.anim + ' ' + vals.join(' '));
}

function onAnimChange() {
  const sel = document.getElementById('anim-drop');
  const name = sel.value;
  const container = document.getElementById('custom-anim');
  container.innerHTML = '';
  if (!name || !ANIM_DEFS[name]) return;
  const defs = ANIM_DEFS[name];
  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
      ${defs.map((f,i) => `
        <div style="flex:1;min-width:50px">
          <label style="font-size:10px;color:var(--text-muted)">${f.l}</label>
          <input type="text" id="ca-${i}" value="${f.d||''}" style="font-family:var(--mono);font-size:11px">
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-primary" onclick="cstart('${name}')" style="height:32px;font-size:11px">Start</button>
      <button class="btn btn-ghost" onclick="send('${name} stop')" style="height:32px;font-size:11px">Stop</button>
    </div>`;
}

function cstart(name) {
  const defs = ANIM_DEFS[name];
  const vals = defs.map((_,i) => document.getElementById(`ca-${i}`).value);
  send(name + ' ' + vals.join(' '));
}

function renderChat(c) {
  c.innerHTML = `
    <div class="card" style="padding:0">
      <div class="card-header" style="padding:16px 20px;margin:0;border-bottom:1px solid var(--glass-border)">
        <span class="card-title">Chat Log</span>
        <button class="btn btn-ghost" onclick="clrChat()" style="height:30px;font-size:11px">Clear</button>
      </div>
      <div id="chat-out" class="console-view" style="height:50vh;border:none;border-radius:0"></div>
    </div>`;
  const out = document.getElementById('chat-out');
  if (out) out.innerHTML = chatBuf.join('<br>');
}

function renderConsole(c) {
  c.innerHTML = `
    <div class="card" style="padding:0">
      <div class="card-header" style="padding:16px 20px;margin:0;border-bottom:1px solid var(--glass-border)">
        <span class="card-title">Console</span>
        <button class="btn btn-ghost" onclick="clrLog()" style="height:30px;font-size:11px">Clear</button>
      </div>
      <div id="log-out" class="console-view" style="height:55vh;border:none;border-radius:0"></div>
    </div>`;
  const out = document.getElementById('log-out');
  if (out) out.innerHTML = logBuf.slice(-100).join('<br>');
}

function renderStatistics(c) {
  const online = botsData.length;
  c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Online</div><div class="stat-value">${online}</div></div>
      <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value" id="s-uptime">0s</div></div>
      <div class="stat-card"><div class="stat-label">CPU</div><div class="stat-value" id="s-cpu">0%</div></div>
      <div class="stat-card"><div class="stat-label">RAM</div><div class="stat-value" id="s-ram">0%</div></div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:16px">Server Info</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
        <div style="color:var(--text-dim)">Status: <span style="color:var(--success)" id="s-status">Online</span></div>
        <div style="color:var(--text-dim)">Mode: <span id="s-mode">B</span></div>
        <div style="color:var(--text-dim)">IP: <span id="s-ip">-</span></div>
        <div style="color:var(--text-dim)">Version: <span id="s-ver">1.8</span></div>
      </div>
    </div>`;
}

function renderSettings(c) {
  c.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:16px">Settings</div>
      <p style="color:var(--text-dim);font-size:13px">Settings are managed server-side in config.json. Restart the backend to apply changes.</p>
    </div>`;
}

// ── Command send ──
function send(raw) {
  const cmd = raw.startsWith('!') ? raw : '!' + raw;
  fetch('/api/command', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({command:cmd}) });
}

function mov(dir) {
  const blk = document.getElementById('blk').value || 1;
  send(dir + ' ' + blk);
}

// ── Socket events ──
socket.on('console_log', log => {
  const ts = new Date(log.timestamp).toLocaleTimeString();
  const line = `<span style="color:var(--text-muted)">[${ts}]</span> <span style="color:var(--accent)">[${log.bot}]</span> ${log.message}`;
  logBuf.push(line);
  if (logBuf.length > MAX_LOG) logBuf.shift();
  ['log-out','d-log'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = logBuf.slice(-100).join('<br>'); el.scrollTop = el.scrollHeight; }
  });
  if (log.message.includes('started')) {
    const a = document.getElementById('cur-anim');
    if (a && !log.message.includes('stopped')) a.textContent = log.message.split(' ')[0];
  }
  if (log.category === 'Chat' || log.emoji === '💬') {
    chatBuf.push(line);
    if (chatBuf.length > MAX_LOG) chatBuf.shift();
    const el = document.getElementById('chat-out');
    if (el) { el.innerHTML = chatBuf.slice(-100).join('<br>'); el.scrollTop = el.scrollHeight; }
  }
});

socket.on('bot_update', bots => {
  botsData = bots;
  document.getElementById('t-online').textContent = bots.length;
  if (currentView === 'dashboard') renderDashboard(document.getElementById('view-container'));
  if (currentView === 'bots') renderBots(document.getElementById('view-container'));
});

socket.on('init', data => {
  if (data && data.bots) document.getElementById('t-online').textContent = data.bots.length;
});

// ── Status polling ──
setInterval(() => {
  fetch('/api/status').then(r=>r.json()).then(d => {
    document.getElementById('t-online').textContent = d.onlineBots;
    document.getElementById('t-cpu').textContent = (d.cpuUsage||0).toFixed(1) + '%';
    document.getElementById('t-ram').textContent = (d.memUsage||0).toFixed(1) + '%';
    const up = Math.floor(d.uptime||0);
    const h = Math.floor(up/3600), m = Math.floor((up%3600)/60), s = up%60;
    const uptimeStr = h>0 ? `${h}h ${m}m` : m>0 ? `${m}m ${s}s` : `${s}s`;
    ['d-uptime','s-uptime'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = uptimeStr; });
    ['d-cmds','d-msgs','s-cpu','s-ram'].forEach(id => { const el = document.getElementById(id); if(!el) return;
      if(id==='d-cmds') el.textContent = d.stats?.cmdsExecuted||0;
      else if(id==='d-msgs') el.textContent = (d.stats?.msgsReceived||0)+(d.stats?.msgsSent||0);
      else if(id==='s-cpu') el.textContent = (d.cpuUsage||0).toFixed(1)+'%';
      else if(id==='s-ram') el.textContent = (d.memUsage||0).toFixed(1)+'%';
    });
    ['t-mode','s-mode'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = d.currentMode||'B'; });
    ['t-ip','s-ip'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = d.serverIp||'-'; });
  }).catch(()=>{});
  const now = new Date();
  const t = document.getElementById('t-time');
  if (t) t.textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}, 3000);

// ── Log/chat clear ──
function clrLog() { logBuf = []; ['log-out','d-log'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = ''; }); }
function clrChat() { chatBuf = []; const el = document.getElementById('chat-out'); if(el) el.innerHTML = ''; }

// ── Toast ──
function toast(msg) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); }, 3000);
}

// ── Init ──
renderView();
