// ============================================================
//  gooner.js — Mineflayer Multi-Bot Controller
//  Annotated & cleaned for public release.
//
//  REQUIREMENTS:
//    Node.js v16+
//    npm install mineflayer
//
//  USAGE:
//    node gooner.js
//    Then pick a mode: a (login cycler) or b (play controller)
//
//  See the COMMAND REFERENCE at the bottom of this file.
// ============================================================

const mineflayer = require('mineflayer'); // Main Minecraft bot library
const readline   = require('readline');   // For reading terminal input
const https      = require('https');      // For sending Discord webhook messages

// ────────────────────────────────────────────────────────────
//  SHARED CONFIG — edit these to match your server & bots
// ────────────────────────────────────────────────────────────

const SERVER_HOST = 'as.mineberry.net';   // ← replace with your server address
const SERVER_PORT = 25565;                // ← replace with your server port
const MC_VERSION  = '1.8';               // ← Minecraft version string
const BOT_PREFIX  = 'user_prefix_';    // ← change this to match your bot usernames

// ────────────────────────────────────────────────────────────
//  MODE A CONFIG — login cycler
// ────────────────────────────────────────────────────────────

const LOGIN_PASSWORD = 'your_password';   // ← /login password sent after join (Mode A only)

// ────────────────────────────────────────────────────────────
//  MODE B CONFIG — play controller
// ────────────────────────────────────────────────────────────

const BOT_COUNT = 1;   // How many bots to spawn (numbered sequentially)
const BOT_START = 1;   // Starting number suffix for bot usernames

// ────────────────────────────────────────────────────────────
//  MODE C CONFIG — custom username list (play controller)
//  Each username is used exactly as written — no prefix applied.
//  Bot numbers are assigned by position: first entry = bot 1, etc.
//  The full command system (same as Mode B) applies to all of them.
// ────────────────────────────────────────────────────────────

const MODE_C_USERNAMES = [
  'custom_bot_1',    // ← bot 1 - replace with your own usernames
  'custom_bot_2',    // ← bot 2
  'custom_bot_3',    // ← bot 3
  // add as many as you need — no limit
];
// Replace these with your own Discord webhook URLs.
// Create a webhook in Discord: Channel Settings → Integrations → Webhooks → New Webhook
const WEBHOOKS = [
  'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID_1/YOUR_WEBHOOK_TOKEN_1',
  'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID_2/YOUR_WEBHOOK_TOKEN_2',
  // Add as many webhooks as you need. They cycle round-robin across bots.
];

// Returns the webhook URL for a given bot index (round-robin)
function webhookFor(index) { return WEBHOOKS[index % WEBHOOKS.length]; }


// ============================================================
//  MODE SELECT — prompts user on startup
// ============================================================

// Create a readline interface for terminal input
var rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('\nSelect mode:');
console.log('  a — Login cycler  (' + BOT_PREFIX + BOT_START + ' to ' + (BOT_START + BOT_COUNT - 1) + ', sends /login ' + LOGIN_PASSWORD + ')');
console.log('  b — Play controller (' + BOT_PREFIX + BOT_START + ' to ' + (BOT_START + BOT_COUNT - 1) + ', full command system)');
console.log('  c — Custom usernames (' + MODE_C_USERNAMES.length + ' bots from MODE_C_USERNAMES list, full command system)');
process.stdout.write('\nMode (a/b/c): ');

rl.once('line', function(answer) {
  var mode = answer.trim().toLowerCase();
  if      (mode === 'a') { startModeA(); }
  else if (mode === 'b') { startModeB(BOT_COUNT, function(i) { return BOT_PREFIX + (BOT_START + i); }); }
  else if (mode === 'c') { startModeB(MODE_C_USERNAMES.length, function(i) { return MODE_C_USERNAMES[i]; }); }
  else {
    console.log('Unknown mode. Enter a, b, or c.');
    process.exit(1);
  }
});


// ============================================================
//  MODE A — Sequential login cycler
//  Connects bots one at a time, sends /login, then disconnects
//  and moves on to the next bot in the sequence.
// ============================================================

function startModeA() {
  console.log('\n[MODE A] Login cycler started. Bots ' + BOT_START + '-' + (BOT_START + BOT_COUNT - 1));

  var currentIndex = BOT_START;  // Which bot number we're currently connecting
  var stopped      = false;      // Paused flag (e.g. when antibot is detected)
  var currentBot   = null;       // Reference to the currently active bot

  // Returns a random integer between min and max (inclusive)
  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // Connect the next bot in sequence
  function connectNext() {
    if (stopped) return;

    // All bots have been processed — exit cleanly
    if (currentIndex > BOT_START + BOT_COUNT - 1) {
      console.log('[A] All accounts cycled. Done.');
      process.exit(0);
      return;
    }

    var username = BOT_PREFIX + currentIndex;
    currentIndex++;

    console.log('[A] Connecting: ' + username);

    // Create the Mineflayer bot in offline (cracked) mode
    var bot = mineflayer.createBot({
      host: SERVER_HOST, port: SERVER_PORT,
      username: username, version: MC_VERSION, auth: 'offline',
    });
    currentBot = bot;
    var loggedIn = false; // Tracks whether /login has been sent and bot is ready to disconnect

    // Fired when the bot successfully joins the server
    bot.on('login', function() {
      console.log('[A] ' + username + ' logged in, sending /login in 1s...');
      setTimeout(function() {
        if (stopped) return;
        bot.chat('/login ' + LOGIN_PASSWORD);

        // Wait a random 2–3s after login before disconnecting (looks more human)
        var delay = rnd(2000, 3000);
        setTimeout(function() {
          if (stopped) return;
          loggedIn = true;
          bot.quit(); // Disconnect cleanly
        }, delay);
      }, 1000);
    });

    // Listen to server messages — we only care about system messages (not player chat)
    bot.on('message', function(jsonMsg) {
      var text = jsonMsg.toString().trim();
      if (!text) return;

      // Skip lines that look like player chat ([Rank] Name: message or <Name> message)
      if (/^\[.*\].*[\u2192\u27a1]/.test(text)) return;
      if (/^\[\w[^\]]*\]\s*\w+\s*:/.test(text)) return;
      if (/^</.test(text)) return;

      console.log('[A] ' + username + ' SYS: ' + text);

      // If "antibot" appears in any server message, pause and wait for user input
      if (/antibot/i.test(text)) {
        console.log('\n[!!! ANTIBOT DETECTED !!!] "' + text + '"');
        console.log('[A] Bot paused. Press ENTER to continue to next bot, or Ctrl+C to quit.');
        stopped = true;
        if (currentBot) { try { currentBot.quit(); } catch(_) {} }
        process.stdin.resume();
        process.stdin.once('data', function() {
          stopped = false;
          loggedIn = true; // Mark as done so the end event moves forward
          var delay = Math.floor(Math.random() * 2000) + 2000;
          setTimeout(connectNext, delay);
        });
      }
    });

    // Suppress common harmless network errors
    bot.on('error', function(e) {
      var m = (e && e.message) || '';
      if (/timed out|ECONNRESET|socketClosed|EPIPE/.test(m)) return;
      console.log('[A] ' + username + ' error: ' + m);
    });

    // Log kick reasons and check for antibot kicks
    bot.on('kicked', function(reason) {
      var r = typeof reason === 'object' ? JSON.stringify(reason) : String(reason);
      console.log('[A] ' + username + ' kicked: ' + r);

      if (/antibot/i.test(r)) {
        console.log('\n[!!! ANTIBOT DETECTED via KICK !!!] "' + r + '"');
        console.log('[A] Bot paused. Press ENTER to continue to next bot, or Ctrl+C to quit.');
        stopped = true;
        process.stdin.resume();
        process.stdin.once('data', function() {
          stopped = false;
          var delay = Math.floor(Math.random() * 2000) + 2000;
          setTimeout(connectNext, delay);
        });
      }
    });

    // When this bot disconnects, wait a moment then connect the next one
    bot.on('end', function(reason) {
      console.log('[A] ' + username + ' disconnected: ' + reason);
      if (currentBot === bot) currentBot = null;
      if (loggedIn && !stopped) {
        var delay = rnd(2000, 3000);
        setTimeout(connectNext, delay); // Move to the next account
      }
    });
  }

  connectNext(); // Kick off the first connection
}


// ============================================================
//  MODE B / C — Full play controller
//  Spawns all bots simultaneously and exposes a live terminal
//  command interface for controlling their movement, actions,
//  and game-specific behaviour.
//
//  botCount    — how many bots to spawn
//  getUsername — function(index) → username string
//                Mode B: index → BOT_PREFIX + (BOT_START + index)
//                Mode C: index → MODE_C_USERNAMES[index]
// ============================================================

function startModeB(botCount, getUsername) {
  var modeName = (getUsername(0) === BOT_PREFIX + BOT_START) ? 'B' : 'C';
  console.log('\n[MODE ' + modeName + '] Play controller started. ' + botCount + ' bot(s).');

  // ── Discord webhook sender ───────────────────────────────
  // Queues messages per-bot to avoid rate limits (one message every 5s per bot)
  var dcQueue = {};
  function sendToDiscord(url, botName, content) {
    try {
      if (!dcQueue[botName]) dcQueue[botName] = { busy: false, next: null };
      var q = dcQueue[botName];
      q.next = { url: url, content: String(content).slice(0, 2000) }; // Discord max 2000 chars
      if (q.busy) return; // Will be flushed when current send completes
      q.busy = true;

      function flush() {
        var item = q.next; q.next = null;
        if (!item) { q.busy = false; return; }
        var payload = JSON.stringify({ username: botName, content: item.content });
        var u = new URL(item.url);
        var req = https.request({
          hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, function(res) {
          res.resume();
          setTimeout(flush, 5000); // 5s cooldown between messages per bot
        });
        req.on('error', function() { setTimeout(flush, 5000); }); // Retry on error
        req.write(payload); req.end();
      }
      flush();
    } catch(_) {}
  }

  // ── Console logging with deduplication ──────────────────
  var lastLog     = {};      // Last logged message per bot (prevents same-message spam)
  var globalDedup = {};      // Global dedup for broadcast messages (📢)
  var loggingOn   = true;    // Can be toggled with !log command

  function lg(u, emoji, msg) {
    if (!loggingOn) return;
    if (/kitpvp/i.test(msg)) return; // Suppress noisy kitpvp spam

    var perBot = emoji + msg;
    if (lastLog[u] === perBot) return; // Same message as last time for this bot
    lastLog[u] = perBot;

    // Global dedup for broadcast/system messages
    if (emoji === '📢') {
      if (globalDedup[msg]) return;
      globalDedup[msg] = true;
      setTimeout(function() { delete globalDedup[msg]; }, 5000);
    }
    console.log(emoji + ' [' + u + '] ' + msg);
  }

  // ── Bot state storage ────────────────────────────────────
  var bots    = new Map();                      // username → bot instance
  var botList = new Array(botCount).fill(null); // index → bot instance
  var bwState = new Array(botCount).fill(null); // BedWars join state machine
  var bwLobby = new Array(botCount).fill(0);    // Last known BW lobby number

  // Single per-bot state object — replaces 9 separate timer arrays.
  // .shiftTimer : timeout id for timed sneak (still its own timeout, rare event)
  // .anim       : string key of active 50ms animation, or null
  // .pTick      : ticks until next /p accept  (40 ticks = 2 s @ 50 ms/tick)
  // .farmTick   : ticks until next farm check (60 ticks = 3 s)
  // .farming    : bool — currently in farm mode
  // animation params stored inline (see each doXxx function)
  var botState = [];
  for (var _si = 0; _si < botCount; _si++) {
    botState.push({ shiftTimer: null, anim: null, pTick: 0, farmTick: 0, farming: false, lcTick: 0, follow: { active: false }, snake: { active: false } });
  }

  // Forbit group tracking — evenly space bots orbiting the same player
  var forbitGroups = {};
  var forbitClocks = {}; // shared clock per target — all bots using same target share one advancing angle
  function removeForbitGroup(idx) {
    for (var _fg in forbitGroups) {
      var _fa = forbitGroups[_fg];
      var _fi = _fa.indexOf(idx);
      if (_fi !== -1) {
        _fa.splice(_fi, 1);
        if (_fa.length === 0) { delete forbitGroups[_fg]; delete forbitClocks[_fg]; return; }
        _fa.sort(function(a,b) { return a - b; });
        for (var _fj = 0; _fj < _fa.length; _fj++) {
          botState[_fa[_fj]].forbitPhase = (2 * Math.PI * _fj) / _fa.length;
        }
        return;
      }
    }
  }
  function addForbitGroup(targetUser, idx) {
    if (!forbitGroups[targetUser]) forbitGroups[targetUser] = [];
    var g = forbitGroups[targetUser];
    if (g.indexOf(idx) !== -1) return;
    g.push(idx);
    g.sort(function(a,b) { return a - b; });
    for (var _fk = 0; _fk < g.length; _fk++) {
      botState[g[_fk]].forbitPhase = (2 * Math.PI * _fk) / g.length;
    }
  }

  // Shared wave clocks — three floats advanced once per master tick.
  // No separate setInterval per feature; the master tick owns them all.
  var waveClocks = { t1: 0, t2: 0, wj: 0 };
  var waveSpeed  = { t1: 0.05, t2: 0.05, wj: 0.08 }; // updated when a feature starts
  var waveActive = { t1: 0,    t2: 0,    wj: 0    };  // how many bots use each wave

  // ── Bot spawner ──────────────────────────────────────────
  // Creates a single bot, registers all event listeners,
  // and auto-respawns it 10s after disconnect.
  function spawnBot(index) {
    var username = getUsername(index);
    var webhook  = webhookFor(index);

    lg(username, '🔄', 'Connecting...');

    var bot = mineflayer.createBot({
      username: username, version: MC_VERSION, auth: 'offline',
      host: SERVER_HOST, port: SERVER_PORT,
      viewDistance: 'tiny',          // Reduce chunk load for performance
      physicsEnabled: true,          // Required for movement commands
      checkTimeoutInterval: 60000,   // Ping timeout (ms)
    });

    bots.set(username, bot);
    botList[index] = bot;

    // Fired on successful server join
    bot.on('login', function() {
      if (!bot._loginLogged) {
        bot._loginLogged = true;
        lg(username, '✅', 'Logged in');
        sendToDiscord(webhook, username, '✅ Logged in');
      }
    });

    // Fired on any chat/system message
    bot.on('message', function(jsonMsg) {
      var text = jsonMsg.toString().trim();
      if (!text) return;

      // Pass to BW state machine listener if active
      if (bot._bwListener) bot._bwListener(text);

      // Filter out player chat lines — only forward system messages
      if (/^\[.*\].*[\u2192\u27a1]/.test(text)) return;
      if (/^\[\w[^\]]*\]\s*\w+\s*:/.test(text)) return;
      if (/^</.test(text)) return;
      if (/kitpvp/i.test(text)) return;

      lg(username, '📢', text);
      sendToDiscord(webhook, username, text);
    });

    // ── Player tracking for !all / !near / !<name> ──
    bot._entityMap = Object.create(null);
    bot._lastPos = Object.create(null);
    bot._chatLogging = false;

    function pSave(name, entity) {
      if (!name || !entity) return;
      bot._lastPos[name.toLowerCase()] = {
        x: entity.position.x, y: entity.position.y, z: entity.position.z, t: Date.now()
      };
    }

    bot.on('entitySpawn', function(e) {
      if (e.type !== 'player') return;
      bot._entityMap[e.id] = e.username;
      pSave(e.username, e);
    });

    bot.on('entityMoved', function(e) {
      if (e.type !== 'player') return;
      var n = e.username || bot._entityMap[e.id];
      if (n) pSave(n, e);
    });

    bot.on('entityUpdate', function(e) {
      if (e.type !== 'player') return;
      var n = e.username || bot._entityMap[e.id];
      if (n) pSave(n, e);
    });

    bot.on('chat', function(user, msg) {
      if (!bot._chatLogging) return;
      if (user === username) return;
      lg(username, '💬', user + ': ' + msg);
    });

    // Suppress common harmless network errors
    bot.on('error', function(e) {
      var m = (e && e.message) || '';
      if (/timed out|ECONNRESET|socketClosed|EPIPE/.test(m)) return;
      if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(m)) lg(username, '💥', m);
    });

    // Parse and log kick reason (handles JSON kick packets)
    bot.on('kicked', function(reason) {
      var r = reason;
      try {
        var p = JSON.parse(reason);
        function extractText(obj) {
          if (!obj) return '';
          if (typeof obj === 'string') return obj;
          var t = obj.text || obj.translate || '';
          if (obj.extra) t += obj.extra.map(extractText).join('');
          if (obj.with)  t += obj.with.map(extractText).join(' ');
          return t;
        }
        r = extractText(p).trim() || '';
      } catch(_) {}
      if (!r) return;
      lg(username, '🚫', 'Kicked: ' + r);
      sendToDiscord(webhook, username, '🚫 Kicked: ' + r);
    });

    // On disconnect: clean up all timers and schedule a reconnect
    bot.on('end', function(reason) {
      bot._loginLogged = false;
      lg(username, '🔌', 'DC: ' + reason);
      sendToDiscord(webhook, username, '🔌 DC: ' + reason);

      bots.delete(username);
      botList[index] = null;

      var st = botState[index];
      if (st.shiftTimer) { clearTimeout(st.shiftTimer); st.shiftTimer = null; }
      // Decrement wave-active counts before clearing anim
      if (st.anim === 'trick1') waveActive.t1 = Math.max(0, (waveActive.t1 || 0) - 1);
      if (st.anim === 'trick2') waveActive.t2 = Math.max(0, (waveActive.t2 || 0) - 1);
      if (st.anim === 'wjump')  waveActive.wj = Math.max(0, (waveActive.wj || 0) - 1);
      st.anim    = null;
      st.pTick   = 0;
      st.farmTick= 0;
      st.farming = false;
      st.lcTick  = 0;
      st.follow.active = false;
      st.snake.active = false;
      removeForbitGroup(index);
      try { bot.physicsEnabled = true; } catch(_) {}

      setTimeout(function() { spawnBot(index); }, 10000 + index * 500);
    });
  }

  // Spawn all bots with a small stagger (400ms apart) to avoid connection floods
  for (var _i = 0; _i < botCount; _i++) {
    (function(idx) { setTimeout(function() { spawnBot(idx); }, idx * 400); })(_i);
  }


  // ── MASTER TICK (single 50 ms interval for ALL bots) ─────
  // Replaces up to BOT_COUNT × 7 separate setIntervals.
  // Each bot gets exactly one callback slot per tick; if its anim is null
  // we skip instantly.  Wave clocks are floats — advancing them costs nothing.
  setInterval(function() {
    // Advance shared wave clocks once per tick
    waveClocks.t1 += waveSpeed.t1;
    waveClocks.t2 += waveSpeed.t2;
    waveClocks.wj += waveSpeed.wj;

    for (var _mi = 0; _mi < botCount; _mi++) {
      var _st  = botState[_mi];
      var _bot = botList[_mi];
      if (!_bot || !_bot.entity) continue;  // bot offline — free skip

      var _ent = _bot.entity;
      var _pos = _ent.position;
      var _vel = _ent.velocity;
      var _a   = _st.anim;

      // ── !follow — track and move toward a player ──
      if (!_a && _st.follow.active) {
        freezePhysics(_bot);
        var _ft = _st.follow;
        var _target = null;
        for (var _fk in _bot.players) {
          if (_fk.toLowerCase() === _ft.targetUser && _bot.players[_fk].entity) {
            _target = _bot.players[_fk].entity; break;
          }
        }
        if (_target) {
          var _tPos = _target.position;
          var _fdx = _tPos.x - _pos.x;
          var _fdy = _tPos.y - _pos.y;
          var _fdz = _tPos.z - _pos.z;
          var _fd = Math.sqrt(_fdx*_fdx + _fdy*_fdy + _fdz*_fdz);

          if (_fd > _ft.radius) {
            var _moved = false;
            for (var _ai = _ft.axisIdx; _ai < 3; _ai++) {
              var _diff = _ai === 0 ? _fdx : (_ai === 1 ? _fdy : _fdz);
              if (Math.abs(_diff) < 0.3) { _ft.axisIdx++; continue; }
              var _step = Math.min(_ft.speed, Math.abs(_diff));
              if (_ai === 0) _pos.x += (_fdx > 0 ? 1 : -1) * _step;
              else if (_ai === 1) _pos.y += (_fdy > 0 ? 1 : -1) * _step;
              else _pos.z += (_fdz > 0 ? 1 : -1) * _step;
              _ft.stuckTicks = 0;
              _moved = true;
              break;
            }
            if (!_moved) {
              _ft.stuckTicks++;
              if (_ft.stuckTicks >= 10) {
                _pos.x = _tPos.x; _pos.y = _tPos.y; _pos.z = _tPos.z;
                _ft.stuckTicks = 0;
                lg(_bot.username, '⬇️', 'teleported to ' + _ft.targetUser);
              }
            }
            if (_ft.axisIdx >= 3) _ft.axisIdx = 0;
          }

          var _fyaw = Math.atan2(-_fdx, -_fdz);
          var _fhz = Math.sqrt(_fdx*_fdx + _fdz*_fdz);
          try { _bot.look(_fyaw, -Math.atan2(_fdy, _fhz), false); } catch(_) {}
        }
        _vel.x = 0; _vel.y = 0; _vel.z = 0;
      }

      // ── !snake — chain follow (physics-free) ──
      if (_st.snake.active) {
        freezePhysics(_bot);
        var _sn = _st.snake;
        var _snTarget = null;
        if (_mi === 0) {
          for (var _snk in _bot.players) {
            if (_snk.toLowerCase() === _sn.targetUser && _bot.players[_snk].entity) {
              _snTarget = _bot.players[_snk].entity.position;
              break;
            }
          }
        } else {
          var _prevBot = botList[_mi - 1];
          if (_prevBot && _prevBot.entity) _snTarget = _prevBot.entity.position;
        }
        if (_snTarget) {
          var _sndx = _snTarget.x - _pos.x;
          var _sndy = _snTarget.y - _pos.y;
          var _sndz = _snTarget.z - _pos.z;
          var _snd = Math.sqrt(_sndx*_sndx + _sndy*_sndy + _sndz*_sndz);
          if (_snd > _sn.dist) {
            var _snTX = _snTarget.x - (_sndx / _snd) * _sn.dist;
            var _snTY = _snTarget.y - (_sndy / _snd) * _sn.dist;
            var _snTZ = _snTarget.z - (_sndz / _snd) * _sn.dist;
            var _snTdx = _snTX - _pos.x;
            var _snTdy = _snTY - _pos.y;
            var _snTdz = _snTZ - _pos.z;
            var _snTd = Math.sqrt(_snTdx*_snTdx + _snTdy*_snTdy + _snTdz*_snTdz);
            if (_snTd > 0.3) {
              var _sstep = Math.min(_sn.speed, _snTd);
              _pos.x += (_snTdx / _snTd) * _sstep;
              _pos.y += (_snTdy / _snTd) * _sstep;
              _pos.z += (_snTdz / _snTd) * _sstep;
              _sn.stuckTicks = 0;
            } else {
              _sn.stuckTicks++;
              if (_sn.stuckTicks >= 10) {
                _pos.x = _snTX; _pos.y = _snTY; _pos.z = _snTZ;
                _sn.stuckTicks = 0;
                lg(_bot.username, '⬇️', 'snake teleported');
              }
            }
            var _snyaw = Math.atan2(-_sndx, -_sndz);
            var _snhz = Math.sqrt(_sndx*_sndx + _sndz*_sndz);
            try { _bot.look(_snyaw, -Math.atan2(_sndy, _snhz), false); } catch(_) {}
          }
        }
        _vel.x = 0; _vel.y = 0; _vel.z = 0;
      }

      // ── /p accept counter ──────────────────────────────────
      if (_st.pTick > 0) {
        _st.pTick--;
        if (_st.pTick === 0) {
          try { _bot.chat('/p accept'); } catch(_) {}
          _st.pTick = 40; // reset: 40 ticks × 50ms = 2 s
        }
      }

      // ── left-click spam counter ────────────────────────────
      // lcTick > 0 means !lc is active. Fires swingArm every tick (20/s).
      if (_st.lcTick > 0) {
        try { _bot.swingArm(); } catch(_) {}
      }

      // ── farm counter ───────────────────────────────────────
      if (_st.farmTick > 0) {
        _st.farmTick--;
        if (_st.farmTick === 0) {
          var _held = _bot.heldItem;
          var _sword = _held && /wooden_sword/i.test(_held.name);
          if (_sword && !_st.farming) { _st.farming = true; lg(_bot.username,'⚔️','wooden sword — spamming /bw'); }
          if (!_sword && _st.farming) { _st.farming = false; lg(_bot.username,'⏳','sword gone, waiting...'); }
          if (_st.farming) { try { _bot.chat('/bw'); } catch(_) {} }
          _st.farmTick = 60; // 60 ticks × 50ms = 3 s
        }
      }

      // ── animations ─────────────────────────────────────────
      if (!_a) continue;

      if (_a === 'rotate') {
        _st.rotYaw += _st.rotSpeed;
        try { _bot.look(_st.rotYaw, 0, false); } catch(_) {}
        continue;
      }

      if (_a === 'spin') {
        _st.spinYaw = (_st.spinYaw || 0) + (_st.spinSpeed || 0.15);
        try { _bot.look(_st.spinYaw, 0, false); } catch(_) {}
        continue;
      }

      // All other animations write position — need entity
      var tx, tz, ty, yaw, pitch;

      if (_a === 'orbit') {
        _st.angle += _st.speed;
        tx = _st.cx + _st.radius * Math.cos(_st.angle);
        tz = _st.cz + _st.radius * Math.sin(_st.angle);
        ty = _st.baseY;
        yaw = _st.faceIn  ? Math.atan2(_st.cz - tz, _st.cx - tx)
            : _st.faceOut ? Math.atan2(tz - _st.cz, tx - _st.cx)
            :               -(_st.angle + 1.5707963); // tangent (π/2 pre-computed)
        try { _pos.x = tx; _pos.z = tz; _pos.y = ty; _vel.x = 0; _vel.y = 0; _vel.z = 0; } catch(_) { continue; }
        try { _bot.look(yaw, 0, false); } catch(_) {}
        continue;
      }

      if (_a === 'forbit') {
        var _fbtPos = null;
        for (var _fbk2 in _bot.players) {
          if (_fbk2.toLowerCase() === _st.forbitTarget && _bot.players[_fbk2].entity) {
            _fbtPos = _bot.players[_fbk2].entity.position; break;
          }
        }
        if (!_fbtPos) continue;

        // Shared clock per target — all bots on same target stay phase-locked
        var _fc = forbitClocks[_st.forbitTarget];
        if (_fc === undefined) _fc = 0;
        _fc += _st.forbitSpeed;
        forbitClocks[_st.forbitTarget] = _fc;

        var _fPhase = _st.forbitPhase || 0;
        var _fCombined = _fc + _fPhase;
        tx = _fbtPos.x + _st.forbitRadius * Math.cos(_fCombined);
        tz = _fbtPos.z + _st.forbitRadius * Math.sin(_fCombined);
        ty = _fbtPos.y;
        yaw = _st.faceIn  ? Math.atan2(_fbtPos.z - tz, _fbtPos.x - tx)
            : _st.faceOut ? Math.atan2(tz - _fbtPos.z, tx - _fbtPos.x)
            :               -(_fCombined + 1.5707963);

        // Stuck detection — teleport if >1 block off target for 1s (20 ticks)
        var _fDist = Math.sqrt((_pos.x - tx)*(_pos.x - tx) + (_pos.z - tz)*(_pos.z - tz) + (_pos.y - ty)*(_pos.y - ty));
        var _fStk = _st.forbitStuck || 0;
        if (_fDist > 1) {
          _fStk++;
          if (_fStk >= 20) { _pos.x = tx; _pos.z = tz; _pos.y = ty; _fStk = 0; }
        } else { _fStk = 0; }
        _st.forbitStuck = _fStk;

        try { _pos.x = tx; _pos.z = tz; _pos.y = ty; _vel.x = 0; _vel.y = 0; _vel.z = 0; } catch(_) { continue; }
        try { _bot.look(yaw, 0, false); } catch(_) {}
        continue;
      }

      if (_a === 'fly') {
        var _rem = _st.flyBlocks - _st.flyMoved;
        var _d   = _rem < _st.flyStep ? _rem : _st.flyStep;
        try { _pos.y += _st.flyUp ? _d : -_d; _vel.x = 0; _vel.y = 0; _vel.z = 0; } catch(_) { continue; }
        _st.flyMoved += _d;
        if (_st.flyMoved >= _st.flyBlocks - 0.001) {
          _st.anim = null;
          lg(_bot.username, '✅', 'fly done');
        }
        continue;
      }

      if (_a === 'trick1') {
        _st.angle += _st.speed;
        tx = _st.cx + _st.radius * Math.cos(_st.angle);
        tz = _st.cz + _st.radius * Math.sin(_st.angle);
        ty = _st.baseY + _st.amp * Math.sin(waveClocks.t1 + _st.wavePhase);
        yaw = _st.faceIn  ? Math.atan2(_st.cz - tz, _st.cx - tx)
            : _st.faceOut ? Math.atan2(tz - _st.cz, tx - _st.cx)
            :               -(_st.angle + 1.5707963);
        try { _pos.x = tx; _pos.z = tz; _pos.y = ty; _vel.x = 0; _vel.y = 0; _vel.z = 0; } catch(_) { continue; }
        pitch = Math.atan2(_st.amp * _st.speed * Math.cos(waveClocks.t1 + _st.wavePhase), _st.speed * _st.radius);
        try { _bot.look(yaw, -pitch, false); } catch(_) {}
        continue;
      }

      if (_a === 'trick2') {
        // tx/tz are constant — pre-stored; only Y changes
        ty = _st.baseY + _st.amp * Math.sin(_st.ringAngle - waveClocks.t2);
        pitch = Math.atan2(_st.amp * waveSpeed.t2 * Math.cos(_st.ringAngle - waveClocks.t2), 1);
        try { _pos.x = _st.tx; _pos.z = _st.tz; _pos.y = ty; _vel.x = 0; _vel.y = 0; _vel.z = 0; } catch(_) { continue; }
        try { _bot.look(_st.yaw, -pitch, false); } catch(_) {}
        continue;
      }

      if (_a === 'wjump') {
        var _raw = Math.sin(_st.ringAngle - waveClocks.wj);
        ty = _st.baseY + _st.jumpH * (_raw > 0 ? _raw : 0);
        try { _pos.x = _st.tx; _pos.z = _st.tz; _pos.y = ty; _vel.x = 0; _vel.y = 0; _vel.z = 0; } catch(_) { continue; }
        try { _bot.look(_st.yaw, 0, false); } catch(_) {}
        continue;
      }

      if (_a === 'star') {
        _st.starT = (_st.starT + _st.speed) % 1;
        var _sv  = _st.starVerts;
        var _vf  = _st.starT * 10;
        var _v0  = ((_vf | 0) % 10) * 2;
        var _v1  = ((_v0 / 2 + 1) % 10) * 2;
        var _fr  = _vf - (_vf | 0);
        tx = _sv[_v0]     + (_sv[_v1]     - _sv[_v0])     * _fr;
        tz = _sv[_v0 + 1] + (_sv[_v1 + 1] - _sv[_v0 + 1]) * _fr;
        var _dtx = _sv[_v1] - _sv[_v0], _dtz = _sv[_v1 + 1] - _sv[_v0 + 1];
        yaw = _st.faceIn  ? Math.atan2(_st.cz - tz, _st.cx - tx)
            : _st.faceOut ? Math.atan2(tz - _st.cz, tx - _st.cx)
            :               -(Math.atan2(_dtz, _dtx) + 1.5707963);
        try { _pos.x = tx; _pos.z = tz; _pos.y = _st.baseY; _vel.x = 0; _vel.y = 0; _vel.z = 0; } catch(_) { continue; }
        try { _bot.look(yaw, 0, false); } catch(_) {}
        continue;
      }
    }
  }, 50);


  // ── Movement helpers ─────────────────────────────────────
  var MOVE_KEYS = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
  function stopAll(bot) {
    for (var k = 0; k < MOVE_KEYS.length; k++) {
      try { bot.setControlState(MOVE_KEYS[k], false); } catch(_) {}
    }
  }

  function walkBlocks(bot, username, dir, blocks) {
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    stopAll(bot);
    var start = bot.entity.position.clone();
    try { bot.setControlState(dir, true); } catch(e) { lg(username, '❌', e.message); return; }
    lg(username, '🚶', dir + ' x' + blocks);
    // walkBlocks keeps its own interval — it's a one-shot, not a sustained animation
    var iv = setInterval(function() {
      if (!bot.entity) { clearInterval(iv); return; }
      var p    = bot.entity.position;
      var dist = (dir === 'left' || dir === 'right') ? Math.abs(p.x - start.x) : Math.abs(p.z - start.z);
      if (dist >= blocks) { clearInterval(iv); stopAll(bot); lg(username, '✅', 'Done ' + dir); }
    }, 50);
  }

  // ── Distance / position helpers (for !near / !<name>) ────
  function posStr(p) {
    return 'x:' + p.x.toFixed(1) + ' y:' + p.y.toFixed(1) + ' z:' + p.z.toFixed(1);
  }
  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }


  // ── Rotate ───────────────────────────────────────────────
  function startRotate(bot, username, index, stop) {
    var st = botState[index];
    if (st.anim === 'rotate' || stop) {
      st.anim = null;
      lg(username, '⏹️', 'rotate stopped');
      return;
    }
    st.anim     = 'rotate';
    st.rotYaw   = 0;
    st.rotSpeed = 0.15 + (index % 20) * 0.005;
    lg(username, '🔄', 'spinning');
  }

  function doSpin(bot, username, index, stop, speed) {
    var st = botState[index];
    if (st.anim === 'spin' || stop) {
      st.anim = null;
      lg(username, '⏹️', 'spin stopped');
      return;
    }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    st.anim     = 'spin';
    st.spinYaw  = 0;
    st.spinSpeed = (!isNaN(speed) && speed > 0) ? speed : 0.15 + (index % 20) * 0.005;
    lg(username, '🌀', 'spin speed=' + st.spinSpeed.toFixed(3));
  }


  function doShift(bot, username, index, seconds) {
    var st = botState[index];
    if (st.shiftTimer) { clearTimeout(st.shiftTimer); st.shiftTimer = null; }

    var isHolding = bot.controlState && bot.controlState['sneak'];
    if (!seconds && isHolding) {
      try { bot.setControlState('sneak', false); } catch(_) {}
      lg(username, '⏹️', 'shift released');
      return;
    }

    try { bot.setControlState('sneak', true); } catch(e) { lg(username, '❌', e.message); return; }

    if (seconds && seconds > 0) {
      lg(username, '⬇️', 'shift ' + seconds + 's');
      st.shiftTimer = setTimeout(function() {
        try { bot.setControlState('sneak', false); } catch(_) {}
        st.shiftTimer = null;
        lg(username, '⏹️', 'shift released');
      }, seconds * 1000);
    } else {
      lg(username, '⬇️', 'shift hold');
    }
  }


  function doP(bot, username, index, stop) {
    var st = botState[index];
    if (st.pTick > 0 || stop) {
      st.pTick = 0;
      lg(username, '⏹️', '/p accept stopped');
      return;
    }
    st.pTick = 40 + index * 2; // stagger start slightly per bot
    lg(username, '✉️', '/p accept every 2s');
  }

  // ── Left-click spam ──────────────────────────────────────
  // Toggles continuous arm-swing (left click / punch) every tick (~20/s).
  // Useful for hitting mobs, breaking blocks, or combat.
  function doLc(bot, username, index, stop) {
    var st = botState[index];
    if (st.lcTick > 0 || stop) {
      st.lcTick = 0;
      lg(username, '⏹️', 'lc stopped');
      return;
    }
    st.lcTick = 1; // any value > 0 enables it; the master tick fires every frame
    lg(username, '👊', 'lc spam ON (~20/s)');
  }

  function doFarm(bot, username, index, stop) {
    var st = botState[index];
    if (st.farmTick > 0 || stop) {
      st.farmTick = 0;
      st.farming  = false;
      lg(username, '⏹️', 'farm stopped');
      return;
    }
    st.farmTick = 1; // fire on next tick to check immediately
    st.farming  = false;
    lg(username, '🌾', 'farm: waiting for wooden sword...');
  }


  function doOrbit(bot, username, index, stop, cx, cz, radius, speed, phaseOffset, facing) {
    var st = botState[index];
    if (stop) { st.anim = null; restorePhysics(bot); lg(username, '⏹️', 'orbit stopped'); return; }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (isNaN(cx) || isNaN(cz) || isNaN(radius) || radius <= 0) { lg(username, '❌', 'orbit <cx> <cz> <radius> [speed] [in|out|tangent]'); return; }
    var spd = (speed > 0 && !isNaN(speed)) ? speed : 0.05;
    st.anim    = 'orbit';
    st.cx      = cx; st.cz = cz; st.radius = radius; st.speed = spd;
    st.angle   = (phaseOffset !== undefined && !isNaN(phaseOffset)) ? phaseOffset : Math.atan2(bot.entity.position.z - cz, bot.entity.position.x - cx);
    st.baseY   = bot.entity.position.y;
    st.faceIn  = facing === 'in';
    st.faceOut = facing === 'out';
    freezePhysics(bot);
    lg(username, '🔵', 'orbit r=' + radius + ' spd=' + spd.toFixed(3) + ' face=' + (facing || 'tangent'));
  }


  function doForbit(bot, username, index, stop, targetUser, radius, speed, facing) {
    var st = botState[index];
    if (stop) {
      removeForbitGroup(index);
      st.anim = null; restorePhysics(bot); lg(username, '⏹️', 'forbit stopped');
      return;
    }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (!targetUser || isNaN(radius) || radius <= 0) { lg(username, '❌', 'forbit <user> <radius> [speed] [in|out|tangent]'); return; }
    var spd = (speed > 0 && !isNaN(speed)) ? speed : 0.005;
    st.anim = 'forbit';
    st.forbitTarget = targetUser.replace(/[<>]/g, '').toLowerCase();
    st.forbitRadius = radius;
    st.forbitSpeed = spd;
    st.faceIn = facing === 'in';
    st.faceOut = facing === 'out';
    st.forbitStuck = 0;
    addForbitGroup(st.forbitTarget, index);
    freezePhysics(bot);
    lg(username, '🟣', 'forbit target=' + st.forbitTarget + ' r=' + radius + ' spd=' + spd.toFixed(3) + ' face=' + (facing || 'tangent'));
  }


  function doGravity(bot, username, on) {
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (on === undefined) on = (bot.physicsEnabled !== false);
    try { bot.physicsEnabled = !on; bot.entity.velocity.x = 0; bot.entity.velocity.y = 0; bot.entity.velocity.z = 0; } catch(e) { lg(username, '❌', e.message); return; }
    lg(username, on ? '🪂' : '🌍', 'antigravity ' + (on ? 'ON' : 'OFF'));
  }

  function freezePhysics(bot) {
    try { bot.physicsEnabled = false; bot.entity.velocity.x = 0; bot.entity.velocity.y = 0; bot.entity.velocity.z = 0; } catch(_) {}
  }
  function restorePhysics(bot) {
    try { bot.physicsEnabled = true; } catch(_) {}
  }


  function doFly(bot, username, index, dir, blocks, speed) {
    var st = botState[index];
    if (dir === 'stop') { st.anim = null; restorePhysics(bot); lg(username, '⏹️', 'fly stopped'); return; }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (dir !== 'up' && dir !== 'down') { lg(username, '❌', 'fly up|down <blocks> [speed]'); return; }
    if (isNaN(blocks) || blocks <= 0)   { lg(username, '❌', 'fly: blocks must be > 0'); return; }
    var step = (speed > 0 && !isNaN(speed)) ? speed : 0.1;
    freezePhysics(bot);
    st.anim     = 'fly';
    st.flyUp    = (dir === 'up');
    st.flyBlocks = blocks;
    st.flyStep  = step;
    st.flyMoved = 0;
    lg(username, dir === 'up' ? '⬆️' : '⬇️', 'fly ' + dir + ' ' + blocks + ' blk @ ' + step + '/tick');
  }


  function doTrick1(bot, username, index, stop, cx, cz, radius, amplitude, speed, phaseOffset, facing) {
    var st = botState[index];
    if (st.anim === 'trick1') { waveActive.t1 = Math.max(0, waveActive.t1 - 1); }
    st.anim = null;
    if (stop) { restorePhysics(bot); lg(username, '⏹️', 'trick1 stopped'); return; }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (isNaN(cx) || isNaN(cz) || isNaN(radius) || radius <= 0) { lg(username, '❌', 'trick1 <cx> <cz> <radius> [amp] [speed] [in|out|tangent]'); return; }
    var spd = (speed > 0 && !isNaN(speed)) ? speed : 0.05;
    waveSpeed.t1 = spd;
    waveActive.t1++;
    st.anim      = 'trick1';
    st.cx = cx; st.cz = cz; st.radius = radius; st.speed = spd;
    st.amp       = (amplitude > 0 && !isNaN(amplitude)) ? amplitude : 3;
    st.angle     = (phaseOffset !== undefined && !isNaN(phaseOffset)) ? phaseOffset : Math.atan2(bot.entity.position.z - cz, bot.entity.position.x - cx);
    st.wavePhase = (phaseOffset !== undefined && !isNaN(phaseOffset)) ? phaseOffset : 0;
    st.baseY     = bot.entity.position.y;
    st.faceIn    = facing === 'in';
    st.faceOut   = facing === 'out';
    freezePhysics(bot);
    lg(username, '🌊', 'trick1 r=' + radius + ' amp=' + st.amp + ' face=' + (facing || 'tangent'));
  }


  function doTrick2(bot, username, index, stop, cx, cz, radius, amplitude, speed, phaseOffset, facing) {
    var st = botState[index];
    if (st.anim === 'trick2') { waveActive.t2 = Math.max(0, waveActive.t2 - 1); }
    if (st.anim === 'trick1') { waveActive.t1 = Math.max(0, waveActive.t1 - 1); }
    st.anim = null;
    if (stop) { restorePhysics(bot); lg(username, '⏹️', 'trick2 stopped'); return; }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (isNaN(cx) || isNaN(cz) || isNaN(radius) || radius <= 0) { lg(username, '❌', 'trick2 <cx> <cz> <radius> [amp] [speed] [in|out|tangent]'); return; }
    var spd      = (speed > 0 && !isNaN(speed)) ? speed : 0.05;
    var ringAngle = (phaseOffset !== undefined && !isNaN(phaseOffset)) ? phaseOffset : Math.atan2(bot.entity.position.z - cz, bot.entity.position.x - cx);
    waveSpeed.t2 = spd;
    waveActive.t2++;
    st.anim      = 'trick2';
    st.cx = cx; st.cz = cz;
    st.amp       = (amplitude > 0 && !isNaN(amplitude)) ? amplitude : 3;
    st.ringAngle = ringAngle;
    st.baseY     = bot.entity.position.y;
    // Pre-compute fixed position and yaw (ring position never moves)
    st.tx  = cx + radius * Math.cos(ringAngle);
    st.tz  = cz + radius * Math.sin(ringAngle);
    st.yaw = facing === 'in'  ? Math.atan2(cz - st.tz, cx - st.tx)
           : facing === 'out' ? Math.atan2(st.tz - cz, st.tx - cx)
           :                    -(ringAngle + 1.5707963);
    freezePhysics(bot);
    lg(username, '👋', 'trick2 r=' + radius + ' amp=' + st.amp + ' face=' + (facing || 'tangent'));
  }


  function doWjump(bot, username, index, stop, cx, cz, radius, jumpHeight, speed, phaseOffset, facing) {
    var st = botState[index];
    if (st.anim === 'wjump') { waveActive.wj = Math.max(0, waveActive.wj - 1); }
    st.anim = null;
    if (stop) { restorePhysics(bot); lg(username, '⏹️', 'wjump stopped'); return; }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (isNaN(cx) || isNaN(cz) || isNaN(radius) || radius <= 0) { lg(username, '❌', 'wjump <cx> <cz> <radius> [height] [speed] [in|out|tangent]'); return; }
    var spd       = (speed > 0 && !isNaN(speed)) ? speed : 0.08;
    var ringAngle = (phaseOffset !== undefined && !isNaN(phaseOffset)) ? phaseOffset : Math.atan2(bot.entity.position.z - cz, bot.entity.position.x - cx);
    waveSpeed.wj = spd;
    waveActive.wj++;
    st.anim      = 'wjump';
    st.cx = cx; st.cz = cz;
    st.jumpH     = (jumpHeight > 0 && !isNaN(jumpHeight)) ? jumpHeight : 2;
    st.ringAngle = ringAngle;
    st.baseY     = bot.entity.position.y;
    // Pre-compute fixed position and yaw
    st.tx  = cx + radius * Math.cos(ringAngle);
    st.tz  = cz + radius * Math.sin(ringAngle);
    st.yaw = facing === 'in'  ? Math.atan2(cz - st.tz, cx - st.tx)
           : facing === 'out' ? Math.atan2(st.tz - cz, st.tx - cx)
           :                    -(ringAngle + 1.5707963);
    freezePhysics(bot);
    lg(username, '🦘', 'wjump r=' + radius + ' h=' + st.jumpH + ' face=' + (facing || 'tangent'));
  }


  function doStar(bot, username, index, stop, cx, cz, outerR, innerR, speed, phaseOffset, facing) {
    var st = botState[index];
    st.anim = null;
    if (stop) { restorePhysics(bot); lg(username, '⏹️', 'star stopped'); return; }
    if (!bot || !bot.entity) { lg(username, '❌', 'Not spawned'); return; }
    if (isNaN(cx) || isNaN(cz) || isNaN(outerR) || outerR <= 0) { lg(username, '❌', 'star <cx> <cz> <outerR> [innerR] [speed] [in|out|tangent]'); return; }
    var iR  = (innerR > 0 && !isNaN(innerR)) ? innerR : outerR * 0.4;
    var spd = (speed  > 0 && !isNaN(speed))  ? speed  : 0.001;

    // Pre-bake all 10 star vertices into a flat Float64Array: [x,z, x,z, ...]
    // This replaces per-tick trig + object allocation inside the hot loop.
    var verts = new Float64Array(20); // 10 vertices × 2 coords
    for (var _vi = 0; _vi < 10; _vi++) {
      var _isOuter = (_vi % 2 === 0);
      var _va      = (_vi / 10) * 2 * Math.PI - 1.5707963;
      var _vr      = _isOuter ? outerR : iR;
      verts[_vi * 2]     = cx + _vr * Math.cos(_va);
      verts[_vi * 2 + 1] = cz + _vr * Math.sin(_va);
    }

    st.anim      = 'star';
    st.cx = cx; st.cz = cz;
    st.starVerts = verts;
    st.starT     = (phaseOffset !== undefined && !isNaN(phaseOffset)) ? ((phaseOffset / (2 * Math.PI)) % 1 + 1) % 1 : 0;
    st.speed     = spd;
    st.baseY     = bot.entity.position.y;
    st.faceIn    = facing === 'in';
    st.faceOut   = facing === 'out';
    freezePhysics(bot);
    lg(username, '⭐', 'star outer=' + outerR + ' inner=' + iR.toFixed(1) + ' face=' + (facing || 'tangent'));
  }


  // ── BedWars auto-join state machine ──────────────────────
  // Repeatedly attempts /hub → /bw until the bot lands in bw-lobby-1.
  // Handles cooldown messages, wrong lobbies, and retries automatically.
  function bwJoin(botIndex) {
    var bot      = botList[botIndex];
    var username = getUsername(botIndex);
    var webhook  = webhookFor(botIndex);
    if (!bot) return;

    // Reset any existing BW state
    if (bwState[botIndex] && bwState[botIndex].t) clearTimeout(bwState[botIndex].t);
    bot._bwListener = null;

    var prev     = bwState[botIndex];
    var attempts = prev ? prev.attempts + 1 : 1;
    bwState[botIndex] = { attempts: attempts, t: null };

    // Step 1: send /hub, then wait 1.5s before sending /bw
    function doHub() {
      var b = botList[botIndex];
      if (!b || !bwState[botIndex]) return;
      lg(username, '🏠', '#' + bwState[botIndex].attempts + ' /hub');
      try { b.chat('/hub'); } catch(e) { return; }
      bwState[botIndex].t = setTimeout(doJoin, 1500);
    }

    // Step 2: send /bw and listen for the server's response
    function doJoin() {
      var b = botList[botIndex];
      if (!b || !bwState[botIndex]) return;
      lg(username, '🎮', '/bw');
      bwLobby[botIndex] = 0;
      try { b.chat('/bw'); } catch(e) { return; }

      // If no matching message arrives in 12s, retry from /hub
      bwState[botIndex].t = setTimeout(function() {
        b._bwListener = null;
        lg(username, '⚠️', 'no response, retry');
        bwState[botIndex].attempts++;
        doHub();
      }, 12000);

      // Intercept server messages while waiting for BW response
      b._bwListener = function(text) {

        // Server told us to wait N seconds (cooldown)
        var coolMatch = text.match(/wait\s+(\d+)\s*second/i);
        if (coolMatch) {
          clearTimeout(bwState[botIndex].t);
          b._bwListener = null;
          var secs = parseInt(coolMatch[1]) + 1;
          lg(username, '⏳', 'cooldown ' + secs + 's');
          bwState[botIndex].attempts++;
          bwState[botIndex].t = setTimeout(doHub, secs * 1000);
          return;
        }

        // Server sent a lobby name like "bw-lobby-3"
        var m = text.match(/bw-lobby-?(\d+)/i);
        if (m) {
          var lobbyNum = parseInt(m[1]);
          bwLobby[botIndex] = lobbyNum;
          clearTimeout(bwState[botIndex].t);
          b._bwListener = null;

          if (lobbyNum === 1) {
            // We want lobby-1 — wait for the login event confirming we're there
            lg(username, '🏟️', 'heading to bw-lobby-1...');
            var lt = setTimeout(function() {
              b.removeListener('login', onLogin);
              bwState[botIndex].attempts++; doHub(); // Timed out waiting for transfer
            }, 10000);
            var onLogin = function() {
              clearTimeout(lt); b.removeListener('login', onLogin);
              lg(username, '✅', 'In bw-lobby-1!');
              sendToDiscord(webhook, username, '✅ In bw-lobby-1');
              bwState[botIndex] = null; // Done — clear state
            };
            b.on('login', onLogin);
          } else {
            // Wrong lobby — retry once transfer completes
            lg(username, '🔁', 'lobby-' + lobbyNum + ', retrying...');
            var lt2 = setTimeout(function() {
              b.removeListener('login', onLogin2);
              bwState[botIndex].attempts++; doHub();
            }, 10000);
            var onLogin2 = function() {
              clearTimeout(lt2); b.removeListener('login', onLogin2);
              bwState[botIndex].attempts++;
              bwState[botIndex].t = setTimeout(doHub, 1000);
            };
            b.on('login', onLogin2);
          }
        }
      };
    }

    doHub(); // Kick off the join sequence
  }


  // ── Command executor ─────────────────────────────────────
  // Interprets a parsed command and applies it to a single bot.
  function execCmd(bot, username, index, cmd, args) {
    if (!bot) { console.log('[' + username + '] not connected'); return; }

    // ── Movement commands (forward / back / left / right / jump / sneak / sprint) ──
    // With a number arg: walk that many blocks, then stop.
    // Without a number arg: toggle the key on/off.
    if (MOVE_KEYS.indexOf(cmd) !== -1) {
      if (args.length > 0 && !isNaN(parseFloat(args[0]))) {
        walkBlocks(bot, username, cmd, parseFloat(args[0]));
      } else {
        var on = !(bot.controlState && bot.controlState[cmd]);
        try { bot.setControlState(cmd, on); } catch(e) { lg(username, '❌', e.message); return; }
        lg(username, on ? '▶️' : '⏹️', (on ? 'hold ' : 'release ') + cmd);
      }
      return;
    }

    // ── stop — release all keys and cancel all animations ──
    if (cmd === 'stop') {
      stopAll(bot);
      var _st = botState[index];
      if (_st.shiftTimer) { clearTimeout(_st.shiftTimer); _st.shiftTimer = null; }
      if (_st.anim === 'trick1') waveActive.t1 = Math.max(0, waveActive.t1 - 1);
      if (_st.anim === 'trick2') waveActive.t2 = Math.max(0, waveActive.t2 - 1);
      if (_st.anim === 'wjump')  waveActive.wj = Math.max(0, waveActive.wj  - 1);
      _st.anim    = null;
      _st.pTick   = 0;
      _st.farmTick= 0;
      _st.farming = false;
      _st.lcTick  = 0;
      _st.follow.active = false;
      _st.snake.active = false;
      removeForbitGroup(index);
      restorePhysics(bot);
      lg(username, '⏹️', 'stopped');
      return;
    }

    // ── slot <1-9> — switch hotbar slot ──
    if (cmd === 'slot') {
      var s = parseInt(args[0], 10);
      if (!s || s < 1 || s > 9) { lg(username, '❌', 'slot 1-9'); return; }
      try { bot.setQuickBarSlot(s - 1); lg(username, '🎒', 'slot ' + s); } catch(e) { lg(username, '❌', e.message); }
      return;
    }

    // ── click left|right — swing arm or activate item ──
    if (cmd === 'click') {
      try {
        if (args[0] === 'right') { bot.activateItem(); lg(username, '🖱️', 'right click'); }
        else                     { bot.swingArm();     lg(username, '👊', 'left click');  }
      } catch(e) { lg(username, '❌', e.message); }
      return;
    }

    // ── gui — interact with open container windows ──
    if (cmd === 'gui') {

      // gui click <slot> — left-click a slot in the current open window
      if (args[0] === 'click') {
        var gslot = parseInt(args[1], 10);
        if (isNaN(gslot)) { lg(username, '❌', 'gui click <slot>'); return; }
        var win = bot.currentWindow;
        if (!win) { lg(username, '❌', 'no open window'); return; }
        try {
          win.requiresConfirmation = false; // Bypass confirmation on some servers
          bot.clickWindow(gslot, 0, 0);
          lg(username, '🪟', 'clicked slot ' + gslot);
        } catch(e) { lg(username, '❌', 'gui: ' + e.message); }
        return;
      }

      // gui open — find and open the nearest container block
      if (args[0] === 'open') {
        if (!bot.entity) { lg(username, '❌', 'not spawned'); return; }
        var pos   = bot.entity.position;
        var found = null, bestDist = 9999;
        var CONT  = { chest:1, trapped_chest:1, ender_chest:1, dispenser:1, dropper:1,
                      hopper:1, furnace:1, crafting_table:1, enchanting_table:1, anvil:1, brewing_stand:1 };

        // Search a 9×5×9 area around the bot for the nearest container
        for (var cx = -4; cx <= 4; cx++) for (var cy = -2; cy <= 2; cy++) for (var cz = -4; cz <= 4; cz++) {
          var b2 = bot.blockAt(pos.offset(cx, cy, cz));
          if (b2 && CONT[b2.name]) {
            var d = Math.sqrt(cx * cx + cy * cy + cz * cz);
            if (d < bestDist) { bestDist = d; found = b2; }
          }
        }

        if (!found) { lg(username, '❌', 'no container nearby'); return; }
        bot.activateBlock(found);
        lg(username, '🪟', 'opening ' + found.name);
        return;
      }

      // gui list — print all items in the current window to console
      if (args[0] === 'list') {
        var w = bot.currentWindow;
        if (!w) { lg(username, '❌', 'no open window'); return; }
        var items = [];
        for (var si = 0; si < w.slots.length; si++) {
          if (w.slots[si]) items.push(si + ':' + w.slots[si].name);
        }
        lg(username, '🪟', (w.title || 'window') + ': ' + (items.slice(0, 20).join(', ') || 'empty'));
        return;
      }

      // gui close — close the currently open window
      if (args[0] === 'close') {
        try { bot.closeWindow(bot.currentWindow); lg(username, '🪟', 'closed'); } catch(e) {}
        return;
      }
      return;
    }

    // ── bw — start BedWars auto-join sequence ──
    if (cmd === 'bw' || /^bw[1-4]$/.test(cmd)) { bwJoin(index); return; }

    // ── rotate — toggle continuous yaw spin (or stop) ──
    if (cmd === 'rotate') { startRotate(bot, username, index, args[0] === 'stop' || botState[index].anim === 'rotate'); return; }

    // ── spin [speed] — continuous yaw spin with custom speed ──
    if (cmd === 'spin') { doSpin(bot, username, index, args[0] === 'stop', parseFloat(args[0])); return; }

    // ── shift [seconds] — hold sneak for N seconds (or toggle) ──
    if (cmd === 'shift')  { doShift(bot, username, index, parseFloat(args[0]) || 0); return; }

    // ── p — toggle /p accept spam every 2s ──
    if (cmd === 'p')      { doP(bot, username, index, args[0] === 'stop'); return; }

    // ── farm — toggle wooden-sword /bw farm loop ──
    if (cmd === 'farm')   { doFarm(bot, username, index, args[0] === 'stop'); return; }

    // ── lc — toggle left-click spam (arm swing every tick) ──
    if (cmd === 'lc')     { doLc(bot, username, index, args[0] === 'stop'); return; }

    // ── orbit — circle around a coordinate ──
    // !orbit <cx> <cz> <radius> [speed] [in|out|tangent]
    if (cmd === 'orbit') {
      var isStop  = args[0] === 'stop';
      var oFacing = ['in','out','tangent'].indexOf(args[4]) !== -1 ? args[4] : undefined;
      doOrbit(bot, username, index, isStop,
        parseFloat(args[0]), parseFloat(args[1]),
        parseFloat(args[2]), parseFloat(args[3]), undefined, oFacing);
      return;
    }

    // ── gravity — toggle antigravity using physicsEnabled ──
    if (cmd === 'gravity') {
      var gState = args[0] === 'on' ? true : args[0] === 'off' ? false : undefined;
      doGravity(bot, username, gState);
      return;
    }

    // ── fly — move up/down N blocks smoothly ──
    if (cmd === 'fly') {
      doFly(bot, username, index, args[0], parseFloat(args[1]), parseFloat(args[2]));
      return;
    }

    // ── trick1 — orbiting bots with time-based travelling wave ──
    // !trick1 <cx> <cz> <radius> [amp] [speed] [in|out|tangent]
    if (cmd === 'trick1') {
      var t1stop   = args[0] === 'stop';
      var t1facing = ['in','out','tangent'].indexOf(args[5]) !== -1 ? args[5] : undefined;
      doTrick1(bot, username, index, t1stop,
        parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]),
        parseFloat(args[3]), parseFloat(args[4]), undefined, t1facing);
      return;
    }

    // ── trick2 — arm-wave: bots fixed on ring, bump travels around ──
    // !trick2 <cx> <cz> <radius> [amp] [speed] [in|out|tangent]
    if (cmd === 'trick2') {
      var t2stop   = args[0] === 'stop';
      var t2facing = ['in','out','tangent'].indexOf(args[5]) !== -1 ? args[5] : undefined;
      doTrick2(bot, username, index, t2stop,
        parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]),
        parseFloat(args[3]), parseFloat(args[4]), undefined, t2facing);
      return;
    }

    // ── wjump — wave jump: bots jump in sequence around the ring ──
    // !wjump <cx> <cz> <radius> [height] [speed] [in|out|tangent]
    if (cmd === 'wjump') {
      var wjStop   = args[0] === 'stop';
      var wjFacing = ['in','out','tangent'].indexOf(args[5]) !== -1 ? args[5] : undefined;
      doWjump(bot, username, index, wjStop,
        parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]),
        parseFloat(args[3]), parseFloat(args[4]), undefined, wjFacing);
      return;
    }

    // ── star — move bots in a 5-pointed star pattern ──
    // !star <cx> <cz> <outerR> [innerR] [speed] [in|out|tangent]
    if (cmd === 'star') {
      var stStop   = args[0] === 'stop';
      var stFacing = ['in','out','tangent'].indexOf(args[5]) !== -1 ? args[5] : undefined;
      doStar(bot, username, index, stStop,
        parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]),
        parseFloat(args[3]), parseFloat(args[4]), undefined, stFacing);
      return;
    }

    // ── !forbit <user> <radius> [speed] [in|out|tangent] / !forbit stop ──
    if (cmd === 'forbit') {
      var fbStop  = args[0] === 'stop';
      var fbFacing = ['in','out','tangent'].indexOf(args[3]) !== -1 ? args[3] : undefined;
      doForbit(bot, username, index, fbStop, args[0], parseFloat(args[1]), parseFloat(args[2]), fbFacing);
      return;
    }

    // ── !follow <user> [radius] [speed] / !follow stop ──
    if (cmd === 'follow') {
      if (args[0] === 'stop') {
        botState[index].follow.active = false;
        if (!botState[index].anim) restorePhysics(bot);
        lg(username, '⏹️', 'follow stopped');
        return;
      }
      if (!args[0] || !bot.entity) { lg(username, '❌', 'follow <user> [radius] [speed]'); return; }
      var _fUser = args[0].replace(/[<>]/g, '').toLowerCase();
      var _fRad = parseFloat(args[1]) || 3;
      var _fSpd = parseFloat(args[2]) || 0.28;
      var _fst = botState[index];
      _fst.follow.active = true;
      _fst.follow.targetUser = _fUser;
      _fst.follow.radius = _fRad;
      _fst.follow.speed = _fSpd;
      _fst.follow.axisIdx = 0;
      _fst.follow.stuckTicks = 0;
      freezePhysics(bot);
      lg(username, '👣', 'following ' + _fUser + ' rad=' + _fRad + ' spd=' + _fSpd);
      return;
    }

    // ── !snake <user> <dist> [speed] / !snake stop ──
    if (cmd === 'snake') {
      if (args[0] === 'stop') {
        botState[index].snake.active = false;
        if (!botState[index].anim) restorePhysics(bot);
        lg(username, '⏹️', 'snake stopped');
        return;
      }
      if (!args[0] || !bot.entity) { lg(username, '❌', 'snake <user> <dist> [speed]'); return; }
      var _snUser = args[0].replace(/[<>]/g, '').toLowerCase();
      var _snDist = parseFloat(args[1]);
      if (isNaN(_snDist) || _snDist <= 0) _snDist = 1;
      var _snSpd = parseFloat(args[2]) || 0.28;
      var _snst = botState[index];
      _snst.snake.active = true;
      _snst.snake.targetUser = _snUser;
      _snst.snake.dist = _snDist;
      _snst.snake.speed = _snSpd;
      _snst.snake.stuckTicks = 0;
      freezePhysics(bot);
      lg(username, '⛓️', 'snake target=' + _snUser + ' dist=' + _snDist + ' spd=' + _snSpd);
      return;
    }

    // ── !chat — toggle player chat logging ──
    if (cmd === 'chat') {
      bot._chatLogging = !bot._chatLogging;
      lg(username, '💬', 'chat logging ' + (bot._chatLogging ? 'ON' : 'OFF'));
      return;
    }

    // ── !all — list players from tab list ──
    if (cmd === 'all') {
      if (!bot.entity) { lg(username, '❌', 'Not spawned'); return; }
      var names = Object.keys(bot.players);
      lg(username, '👥', names.length + ' players: ' + names.join(', '));
      return;
    }

    // ── !near — nearby players sorted by distance ──
    if (cmd === 'near') {
      if (!bot.entity) { lg(username, '❌', 'Not spawned'); return; }
      var me = bot.entity.position;
      var list = [];
      for (var nk in bot.players) {
        var pl = bot.players[nk];
        if (pl && pl.entity) list.push({ name: pl.username, d: dist(me, pl.entity.position), p: pl.entity.position });
      }
      list.sort(function(a, b) { return a.d - b.d; });
      var lines = [];
      for (var li = 0; li < list.length; li++) lines.push(list[li].name + ' ' + list[li].d.toFixed(1) + 'm');
      lg(username, '📍', 'nearby (' + list.length + '): ' + (lines.slice(0, 10).join(' | ') || 'none'));
      return;
    }

    // ── !<player> — player name lookup fallthrough ──
    if (bot.entity) {
      var lookup = cmd.replace(/[<>]/g, '');
      var live = null;
      for (var pk in bot.players) {
        if (pk.toLowerCase() === lookup) { live = bot.players[pk]; break; }
      }
      if (live && live.entity) {
        var d = dist(bot.entity.position, live.entity.position);
        lg(username, '👤', live.username + ' live ' + d.toFixed(1) + 'm');
        return;
      }
      var cached = bot._lastPos && bot._lastPos[lookup];
      if (cached) {
        lg(username, '👤', lookup + ' cached');
        return;
      }
    }
    lg(username, '❓', 'unknown: ' + cmd);
  }


  // ── Terminal command loop ─────────────────────────────────
  // Reads lines from stdin and routes them to the correct bot(s).
  //
  //  Plain text (no !)  → sent as in-game chat by all bots
  //  !<cmd> [args]      → runs <cmd> on ALL bots
  //  !bot <N> <cmd>     → runs <cmd> on bot number N only
  //  !log               → toggles console output on/off

  console.log('\nReady. Text = chat to all | !cmd [args] | !bot <N> cmd [args]');

  rl.on('line', function(rawLine) {
    var input = rawLine.trim();
    if (!input) return;

    // No prefix → broadcast as chat to all bots
    if (input[0] !== '!') {
      var sent = 0;
      bots.forEach(function(bot) { try { bot.chat(input); sent++; } catch(_) {} });
      console.log('>> chat: ' + sent + ' bots');
      return;
    }

    // Tokenise (lowercase, collapse spaces)
    var tokens = [];
    var parts  = input.slice(1).trim().split(' ');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] !== '') tokens.push(parts[i].toLowerCase());
    }
    if (!tokens.length) return;

    // !log — toggle console output
    if (tokens[0] === 'log') {
      loggingOn = !loggingOn;
      console.log('>> logging ' + (loggingOn ? 'ON' : 'OFF'));
      return;
    }

    var targets = [];
    var cmd, args;

    // !bot <N> <cmd> [args] — target a specific bot by number (1-based)
    if (tokens[0] === 'bot' && tokens[1] && !isNaN(parseInt(tokens[1], 10))) {
      var idx = parseInt(tokens[1], 10) - 1;
      if (idx < 0 || idx >= botCount || !botList[idx]) {
        console.log('Bot ' + (idx + 1) + ' not online');
        return;
      }
      targets = [{ bot: botList[idx], username: getUsername(idx), index: idx }];
      cmd  = tokens[2] || '';
      args = tokens.slice(3);
    } else {
      // Target all online bots
      for (var j = 0; j < botCount; j++) {
        if (botList[j]) targets.push({ bot: botList[j], username: getUsername(j), index: j });
      }
      cmd  = tokens[0];
      args = tokens.slice(1);
    }

    if (!cmd) return;
    if (targets.length > 1) console.log('>> !' + cmd + (args.length ? ' ' + args.join(' ') : '') + ' [' + targets.length + ' bots]');

    // ── Coordinated multi-bot dispatchers ───────────────────────────────────────
    // For commands that need evenly-spaced phase offsets, we intercept here
    // before the generic execCmd loop and inject the phase into each bot call.
    // A helper extracts the facing arg (last arg if it's in/out/tangent).
    function getFacing(a, defaultIdx) {
      for (var fi = a.length - 1; fi >= 0; fi--) {
        if (a[fi] === 'in' || a[fi] === 'out' || a[fi] === 'tangent') return a[fi];
      }
      return undefined;
    }

    if (targets.length > 1) {
      var n    = targets.length;
      var face = getFacing(args);

      // orbit
      if (cmd === 'orbit' && args[0] !== 'stop') {
        var oCx = parseFloat(args[0]), oCz = parseFloat(args[1]);
        var oR  = parseFloat(args[2]), oSpd = parseFloat(args[3]);
        for (var oi = 0; oi < n; oi++) {
          (function(entry, ph) {
            doOrbit(entry.bot, entry.username, entry.index, false, oCx, oCz, oR, oSpd, ph, face);
          })(targets[oi], (2 * Math.PI * oi) / n);
        }
        return;
      }

      // trick1
      if (cmd === 'trick1' && args[0] !== 'stop') {
        var t1Cx = parseFloat(args[0]), t1Cz = parseFloat(args[1]);
        var t1R  = parseFloat(args[2]), t1Amp = parseFloat(args[3]), t1Spd = parseFloat(args[4]);
        for (var ti = 0; ti < n; ti++) {
          (function(entry, ph) {
            doTrick1(entry.bot, entry.username, entry.index, false, t1Cx, t1Cz, t1R, t1Amp, t1Spd, ph, face);
          })(targets[ti], (2 * Math.PI * ti) / n);
        }
        return;
      }

      // trick2 — bots get fixed ring positions, wave travels via global clock
      if (cmd === 'trick2' && args[0] !== 'stop') {
        var t2Cx = parseFloat(args[0]), t2Cz = parseFloat(args[1]);
        var t2R  = parseFloat(args[2]), t2Amp = parseFloat(args[3]), t2Spd = parseFloat(args[4]);
        for (var t2i = 0; t2i < n; t2i++) {
          (function(entry, ph) {
            doTrick2(entry.bot, entry.username, entry.index, false, t2Cx, t2Cz, t2R, t2Amp, t2Spd, ph, face);
          })(targets[t2i], (2 * Math.PI * t2i) / n);
        }
        return;
      }

      // wjump — same fixed-ring approach, jump wave travels
      if (cmd === 'wjump' && args[0] !== 'stop') {
        var wjCx = parseFloat(args[0]), wjCz = parseFloat(args[1]);
        var wjR  = parseFloat(args[2]), wjH = parseFloat(args[3]), wjSpd = parseFloat(args[4]);
        for (var wji = 0; wji < n; wji++) {
          (function(entry, ph) {
            doWjump(entry.bot, entry.username, entry.index, false, wjCx, wjCz, wjR, wjH, wjSpd, ph, face);
          })(targets[wji], (2 * Math.PI * wji) / n);
        }
        return;
      }

      // star — bots spread evenly around the star path
      if (cmd === 'star' && args[0] !== 'stop') {
        var stCx = parseFloat(args[0]), stCz = parseFloat(args[1]);
        var stOR = parseFloat(args[2]), stIR = parseFloat(args[3]), stSpd = parseFloat(args[4]);
        for (var sti = 0; sti < n; sti++) {
          (function(entry, ph) {
            doStar(entry.bot, entry.username, entry.index, false, stCx, stCz, stOR, stIR, stSpd, ph, face);
          })(targets[sti], (2 * Math.PI * sti) / n);
        }
        return;
      }

      // forbit — orbit a player, bots spread evenly around the ring
      if (cmd === 'forbit' && args[0] !== 'stop') {
        var fbUser = args[0];
        var fbRad  = parseFloat(args[1]), fbSpd = parseFloat(args[2]);
        for (var fbi = 0; fbi < n; fbi++) {
          (function(entry) {
            doForbit(entry.bot, entry.username, entry.index, false, fbUser, fbRad, fbSpd, face);
          })(targets[fbi]);
        }
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // BW join commands are staggered 1s apart to avoid chat floods
    var isBW = cmd === 'bw' || /^bw[1-4]$/.test(cmd);
    for (var t = 0; t < targets.length; t++) {
      (function(entry, delay) {
        setTimeout(function() { execCmd(entry.bot, entry.username, entry.index, cmd, args); }, delay);
      })(targets[t], isBW ? t * 1000 : 0);
    }
  });
}


// ============================================================
//
//  ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗
// ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗
// ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║
// ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║
// ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝
//  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝
//
//  REFERENCE
//
// ════════════════════════════════════════════════════════════════════
//
//  HOW TO SEND CHAT  (no prefix)
//  ─────────────────────────────
//  hello world       →  all bots send "hello world" in chat
//
//
//  HOW TO TARGET A SINGLE BOT
//  ──────────────────────────
//  !bot <N> <cmd>    →  run <cmd> on bot number N only
//  Example: !bot 3 forward 10
//
//
//  MOVEMENT COMMANDS  (all bots unless prefixed with !bot N)
//  ─────────────────────────────────────────────────────────
//  !forward [blocks]    Hold W, or walk N blocks then stop
//  !back    [blocks]    Hold S, or walk N blocks then stop
//  !left    [blocks]    Hold A, or strafe N blocks then stop
//  !right   [blocks]    Hold D, or strafe N blocks then stop
//  !jump                Toggle jump key
//  !sprint              Toggle sprint key
//  !sneak               Toggle sneak key
//  !stop                Release all keys & cancel all timers
//
//
//  ITEM / INVENTORY COMMANDS
//  ─────────────────────────
//  !slot <1-9>          Switch hotbar slot (1 = leftmost)
//  !click left          Left-click / swing arm (once)
//  !click right         Right-click / activate held item (once)
//  !lc                  Toggle left-click spam (~20 punches/sec, every tick)
//  !lc stop             Stop left-click spam
//
//
//  CONTAINER (GUI) COMMANDS
//  ────────────────────────
//  !gui open            Open the nearest container block
//  !gui list            List items in the open window
//  !gui click <slot>    Click slot number in open window
//  !gui close           Close the current window
//
//
//  ROTATION COMMAND
//  ────────────────
//  !rotate              Toggle smooth continuous head spin
//  !rotate stop         Stop spinning
//
//
//  SPIN COMMAND
//  ────────────
//  !spin [speed]        Continuous yaw spin at custom speed
//  !spin stop           Stop spinning
//
//
//  SNAKE COMMAND (physics-free chain follow)
//  ──────────────────────────────────────────
//  !snake <user> <dist> [speed]
//  !snake stop
//
//  Bot 0 follows the target player at exactly <dist> blocks (offset-position).
//  Bot 1 follows bot 0, bot 2 follows bot 1, etc. — forms a straight chain.
//  Uses freezePhysics (direct position writes), no walking.
//  Like !follow but chained.
//
//
//  SNEAK / SHIFT COMMAND
//  ─────────────────────
//  !shift               Toggle sneak (hold indefinitely)
//  !shift <seconds>     Hold sneak for N seconds, then release
//
//
//  PARTY COMMAND
//  ─────────────
//  !p                   Toggle /p accept spam (every 2 seconds)
//  !p stop              Stop /p accept spam
//
//
//  FARM COMMAND
//  ────────────
//  !farm                Start farm loop:
//                         waits until bot holds a wooden sword,
//                         then spams /bw every 3s until sword is gone
//  !farm stop           Stop the farm loop
//
//
//  ORBIT COMMAND
//  ─────────────
//  !orbit <cx> <cz> <radius> [speed] [facing]
//  !orbit stop
//
//  facing = tangent (default) | in (face centre) | out (face away)
//  Multi-bot: bots auto-spread evenly around the ring.
//
//  Examples:
//    !orbit 100 200 5            — ring at r=5, all bots face tangent
//    !orbit 0 0 10 0.02 in       — slow orbit, all face centre
//    !bot 3 orbit 50 50 3 out    — bot #3 solo, faces outward
//
//
//  GRAVITY COMMAND
//  ───────────────
//  !gravity             Toggle antigravity on/off (uses physicsEnabled)
//  !gravity on          Enable antigravity explicitly
//  !gravity off         Disable antigravity, restore normal fall
//  Note: !stop also restores physics.
//
//
//  FLY COMMAND
//  ───────────
//  !fly up <blocks> [speed]    Rise N blocks smoothly (blk/tick, default 0.1)
//  !fly down <blocks> [speed]  Sink N blocks smoothly
//  !fly stop                   Cancel an in-progress fly move
//  Examples:
//    !fly up 10          — rise 10 blocks (~2 blk/s)
//    !fly up 5 0.3       — rise 5 blocks faster (~6 blk/s)
//    !fly down 3 0.05    — sink 3 blocks very slowly
//
//
//  TRICK1 — ORBITING BOTS WITH TRAVELLING SINE WAVE
//  ──────────────────────────────────────────────────
//  !trick1 <cx> <cz> <radius> [amp] [speed] [facing]
//  !trick1 stop
//
//  Bots ORBIT the ring while each bot's Y is driven by a shared global
//  clock offset by its phase — the wave rolls around the orbiting ring.
//  Think: floating helix / corkscrew formation.
//
//  Examples:
//    !trick1 0 0 8 3 0.05 in     — orbiting wave, all face centre
//    !trick1 0 0 10 5 0.04       — bigger amp, slower
//
//
//  TRICK2 — ARM WAVE (bots fixed on ring, bump travels around)
//  ────────────────────────────────────────────────────────────
//  !trick2 <cx> <cz> <radius> [amp] [speed] [facing]
//  !trick2 stop
//
//  Bots stay at their FIXED ring positions — they do NOT orbit.
//  A single "bump" in Y travels around the ring over time, exactly
//  like people doing the wave while holding hands in a circle.
//  This is the proper coordinated arm-wave effect.
//
//  Examples:
//    !trick2 100 200 8           — arm-wave, r=8, amp=3, face tangent
//    !trick2 0 0 10 5 0.04 in    — bigger wave, all face centre
//    !trick2 0 0 8 2 0.08        — fast small wave
//
//
//  WAVE JUMP (!wjump)
//  ──────────────────
//  !wjump <cx> <cz> <radius> [height] [speed] [facing]
//  !wjump stop
//
//  Bots stand at their fixed ring positions and jump in sequence —
//  a single jump-bump travels around the ring like a stadium wave.
//  Works without flight (jump goes up only, no going underground).
//
//  Examples:
//    !wjump 0 0 8              — jump wave, r=8, h=2 blocks
//    !wjump 0 0 8 3 0.1 in     — higher jump, faster, facing centre
//
//
//  STAR COMMAND
//  ────────────
//  !star <cx> <cz> <outerRadius> [innerRadius] [speed] [facing]
//  !star stop
//
//  All bots move along a 5-pointed star path centred on (cx, cz).
//  Multi-bot: bots spread evenly around the path so the whole star
//  is always "lit up" with bots at different points simultaneously.
//
//  outerRadius  — distance from centre to star tips
//  innerRadius  — distance from centre to inner notches
//                 (default = outerRadius × 0.4, classic sharp star)
//  speed        — path fraction per tick (default 0.001 ≈ full lap in ~50s)
//  facing       — tangent (default) | in | out
//
//  Examples:
//    !star 0 0 10              — sharp 5-star, r=10, default speed
//    !star 0 0 10 6 0.002      — rounder star (inner r=6), slower
//    !star 0 0 8 3 0.001 in    — all bots face centre as they trace the star
//    !bot 1 star 0 0 10        — only bot #1 traces the star solo
//
//
//  FACING NOTE (applies to orbit, trick1, trick2, wjump, star)
//  ────────────
//  tangent  — bot faces its direction of travel (default)
//  in       — bot always looks toward the centre point
//  out      — bot always looks away from the centre point
//
//
//  BEDWARS AUTO-JOIN
//  ─────────────────
//  !bw                  Start BedWars auto-join:
//                         loops /hub → /bw until landing in bw-lobby-1
//                         handles cooldowns and wrong lobbies automatically
//
//
//  LOGGING
//  ───────
//  !log                 Toggle console output on/off
//                       (Discord webhook messages are unaffected)
//
//
// ════════════════════════════════════════════════════════════════════
//
//  SETUP INSTRUCTIONS
//  ──────────────────
//  1. Install Node.js (v16 or newer): https://nodejs.org
//
//  2. Install the required dependency:
//       npm install mineflayer
//
//  3. Open this file and edit the CONFIG section at the top:
//       SERVER_HOST    →  your server's address
//       SERVER_PORT    →  your server's port (default 25565)
//       MC_VERSION     →  e.g. '1.8', '1.16.5', '1.20.1'
//       BOT_PREFIX     →  prefix for all bot usernames
//       LOGIN_PASSWORD →  password sent to /login (Mode A only)
//       BOT_COUNT      →  how many bots to spawn in Mode B
//       BOT_START      →  starting number for bot username suffixes
//       WEBHOOKS       →  list of Discord webhook URLs for bot logging
//
//  4. Run the script:
//       node gooner.js
//
//  5. Choose a mode when prompted:
//       a  →  Login cycler (sequentially logs each bot in and out)
//       b  →  Play controller (spawns all bots using BOT_PREFIX + number)
//       c  →  Play controller using custom usernames from MODE_C_USERNAMES
//             Edit the MODE_C_USERNAMES array near the top of the file.
//             Bot numbers are assigned by order: first name = bot 1, etc.
//             The full command system (!orbit, !trick2, etc.) works identically.
//
//  NOTES
//  ─────
//  • All bots run in offline (cracked) mode — no Microsoft/Mojang auth.
//  • Discord webhooks cycle round-robin if you have fewer webhooks than bots.
//  • Bots auto-reconnect 10s after disconnecting.
//  • BW auto-join will retry indefinitely until it reaches bw-lobby-1.
//
// ════════════════════════════════════════════════════════════════════
//
//  Annotations added by ChatGPT
//
// ============================================================
