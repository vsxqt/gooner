const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ==========================================
// 1. MONKEY-PATCHING & INTERCEPTION
// ==========================================
// We intercept readline to capture the CLI interface so the web UI can send commands.
const readline = require('readline');
let cliInterface = null;
const originalCreateInterface = readline.createInterface;
readline.createInterface = function(opts) {
    const iface = originalCreateInterface.call(readline, opts);
    cliInterface = iface;
    // Auto-start the bot controller using the mode from config.json
    setTimeout(() => {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        if (cliInterface) cliInterface.emit('line', config.mode || 'b');
    }, 500);
    return iface;
};

// We intercept mineflayer.createBot to capture bot instances for live telemetry
const mineflayer = require('mineflayer');
const activeBots = new Map();
const botStats = { reconnects: 0, msgsReceived: 0, msgsSent: 0, cmdsExecuted: 0 };
const originalCreateBot = mineflayer.createBot;
mineflayer.createBot = function(opts) {
    const bot = originalCreateBot.call(mineflayer, opts);
    
    bot.on('login', () => {
        activeBots.set(bot.username, bot);
    });

    bot.on('kicked', () => botStats.reconnects++);
    bot.on('end', () => {
        activeBots.delete(bot.username);
    });

    return bot;
};

// We intercept console.log to stream logs to the frontend without modifying gooner_bot.js
const origLog = console.log;
console.log = function(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    
    // Parse the specific format used by gooner_bot.js: "emoji [username] message"
    const match = msg.match(/^([^\s]+) \[([^\]]+)\] (.*)$/);
    if (match) {
        const [full, emoji, botName, text] = match;
        let category = 'Info';
        if (['✅', '✉️', '🔄'].includes(emoji)) category = 'Success';
        if (['📢'].includes(emoji)) category = 'Server Message';
        if (['💬'].includes(emoji)) { category = 'Chat'; botStats.msgsReceived++; }
        if (['🚫', '💥'].includes(emoji)) category = 'Error';
        if (['🔌'].includes(emoji)) category = 'Disconnect';
        if (['⏳', '⚠️'].includes(emoji)) category = 'Warning';
        if (['⏹️', '▶️', '👊', '🚶', '⬇️', '⬆️', '🌊', '👋', '🦘', '⭐', '🔵', '🟣', '👣', '🌍', '🪂', '🏟️', '🏠', '🎮', '🔁'].includes(emoji)) category = 'Commands';
        
        const logEntry = { timestamp: new Date(), bot: botName, category, message: text, emoji };
        io.emit('console_log', logEntry);
    } else if (msg.startsWith('>>')) {
        const logEntry = { timestamp: new Date(), bot: 'SYSTEM', category: 'Commands', message: msg, emoji: '⚙️' };
        io.emit('console_log', logEntry);
        botStats.cmdsExecuted++;
    } else {
        const logEntry = { timestamp: new Date(), bot: 'SYSTEM', category: 'Info', message: msg, emoji: 'ℹ️' };
        io.emit('console_log', logEntry);
    }
    origLog.apply(console, args);
};

// ==========================================
// 2. EXPRESS & SOCKET.IO SETUP
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 3. REST API ROUTES
// ==========================================
app.get('/api/bots', (req, res) => {
    const bots = Array.from(activeBots.values()).map(b => ({
        username: b.username,
        health: b.health || 0,
        food: b.food || 0,
        dimension: b.game?.dimension || 'minecraft:overworld',
        position: b.entity?.position ? { x: b.entity.position.x.toFixed(1), y: b.entity.position.y.toFixed(1), z: b.entity.position.z.toFixed(1) } : {x:0,y:0,z:0},
        yaw: b.entity?.yaw?.toFixed(2) || 0,
        pitch: b.entity?.pitch?.toFixed(2) || 0,
        heldItem: b.heldItem?.name || 'none',
        physicsEnabled: b.physicsEnabled
    }));
    res.json(bots);
});

app.get('/api/status', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    res.json({
        serverStatus: 'Online',
        onlineBots: activeBots.size,
        offlineBots: 0,
        currentMode: JSON.parse(fs.readFileSync('./config.json', 'utf8')).mode.toUpperCase(),
        serverIp: 'eu.mineberry.net', // Extracted statically from your file
        mcVersion: '1.8',
        cpuUsage: process.cpuUsage().user / 1000000, // Simplified CPU metric
        memUsage: (usedMem / totalMem) * 100,
        uptime: process.uptime(),
        stats: botStats
    });
});

app.post('/api/command', (req, res) => {
    const { command } = req.body;
    if (cliInterface) {
        cliInterface.emit('line', command);
        res.json({ success: true, message: 'Command executed' });
    } else {
        res.status(500).json({ success: false, message: 'CLI not ready' });
    }
});

app.post('/api/chat', (req, res) => {
    const { message } = req.body;
    if (cliInterface) {
        cliInterface.emit('line', message); // No prefix sends as chat
        botStats.msgsSent += activeBots.size;
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

app.post('/api/settings', (req, res) => {
    const newConfig = req.body;
    fs.writeFileSync('./config.json', JSON.stringify(newConfig, null, 2));
    res.json({ success: true, message: 'Settings saved. Restart backend to apply.' });
});

// ==========================================
// 4. SOCKET.IO REAL-TIME TELEMETRY
// ==========================================
io.on('connection', (socket) => {
    socket.emit('init', { bots: Array.from(activeBots.keys()) });
});

// Master tick to emit bot states every 500ms
setInterval(() => {
    const botsData = Array.from(activeBots.values()).map(b => ({
        username: b.username,
        health: b.health || 0,
        food: b.food || 0,
        dimension: b.game?.dimension || 'minecraft:overworld',
        position: b.entity?.position ? { x: b.entity.position.x.toFixed(1), y: b.entity.position.y.toFixed(1), z: b.entity.position.z.toFixed(1) } : {x:0,y:0,z:0},
        yaw: b.entity?.yaw?.toFixed(2) || 0,
        pitch: b.entity?.pitch?.toFixed(2) || 0,
        heldItem: b.heldItem?.name || 'none',
        physicsEnabled: b.physicsEnabled,
        velocity: b.entity?.velocity ? { x: b.entity.velocity.x.toFixed(2), y: b.entity.velocity.y.toFixed(2), z: b.entity.velocity.z.toFixed(2) } : {x:0,y:0,z:0}
    }));
    
    io.emit('bot_update', botsData);
}, 500);

// ==========================================
// 5. START EVERYTHING
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Gooner] Running on http://localhost:${PORT}`);
    // Load the original controller logic
    require('./gooner_bot.js');
});