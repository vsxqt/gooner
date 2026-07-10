# Gooner — Complete Usage Guide

## Requirements

- Node.js 16+
- A Minecraft server (offline/cracked mode, version 1.8)
- `npm install mineflayer` (or `npm install` to install all dependencies)

## Quick Start (Terminal Version)

```bash
node gooner.js
```

This is the main bot controller. No web UI, no extra setup — just the terminal. You'll be prompted to pick a mode:

```
Select mode:
  a — Login cycler  (user_prefix_1 to user_prefix_1, sends /login your_password)
  b — Play controller (user_prefix_1 to user_prefix_1, full command system)
  c — Custom usernames (3 bots from MODE_C_USERNAMES list, full command system)

Mode (a/b/c):
```

Type `a`, `b`, or `c` and press Enter.

## Web Dashboard Version (Beta)

> **⚠️ WARNING:** The web dashboard (`npm start` → http://localhost:3000) is a beta/experimental UI. It may not work reliably. Stick to `node gooner.js` for production use.

```bash
npm start
```

This starts `server.js`, which loads an Express + Socket.IO web server AND then loads `gooner.js` underneath. You still interact through the same terminal prompt — the web UI adds live telemetry charts and a command panel.

## Configuration

### gooner.js — edit these constants at the top of the file:

| Constant | Default | What it does |
|---|---|---|
| `SERVER_HOST` | `as.mineberry.net` | Your Minecraft server address |
| `SERVER_PORT` | `25565` | Server port |
| `MC_VERSION` | `'1.8'` | Must match the server |
| `BOT_PREFIX` | `'user_prefix_'` | Prefix for auto-generated bot usernames (Mode A & B) |
| `BOT_COUNT` | `1` | Number of bots to spawn (Mode B) |
| `BOT_START` | `1` | Starting number appended to BOT_PREFIX |
| `LOGIN_PASSWORD` | `'your_password'` | Password sent as `/login <pass>` (Mode A only) |
| `MODE_C_USERNAMES` | `['custom_bot_1', ...]` | Custom username list (Mode C) |
| `WEBHOOKS` | `[...]` | Discord webhook URLs for log forwarding |

### config.json

`config.json` is only used by the **web dashboard** (`server.js`). It does NOT affect `node gooner.js`.

```json
{
  "mode": "b",
  "bot_count": 3,
  "bot_start": 1,
  "webhooks": ["https://discord.com/api/webhooks/..."]
}
```

- `mode` — Startup mode (a/b/c) — read by `server.js` for display and by `gooner-collab.js` at startup
- `bot_count` / `bot_start` — Only used by `gooner-collab.js`
- `webhooks` — Only used by `gooner-collab.js`

**For `node gooner.js`, always edit the constants in the file itself, not `config.json`.**

### package.json & package-lock.json

- **`package.json`** — Lists the project metadata and dependencies (mineflayer, express, socket.io, chart.js). The `"start"` script runs `node server.js`. Required for `npm install` and `npm start`.
- **`package-lock.json`** — Auto-generated lockfile that pins exact dependency versions. Never edit it manually. Commit it so everyone gets the same versions.

## Startup Modes Explained

### Mode A — Login Cycler

Connects bots one at a time. For each bot:
1. Connects to the server
2. Waits for spawn
3. Sends `/login <LOGIN_PASSWORD>`
4. Waits 2-3 seconds
5. Disconnects
6. Moves to the next bot

Useful for: logging in multiple accounts on servers that require `/login` on first join. Each bot waits for the previous one to fully disconnect before the next connects.

The terminal will pause for you to press Enter if antibot detection is suspected.

### Mode B — Play Controller (Default)

Spawns all bots simultaneously. Each bot's username is `BOT_PREFIX + (BOT_START + index)`. Full command system is available.

After spawning, you'll see:
```
Ready. Text = chat to all | !cmd [args] | !bot <N> cmd [args]
```

Type `!help`-equivalent commands, plain text to chat, or `!bot <N> <cmd>` to target a specific bot.

### Mode C — Custom Usernames (Play Controller)

Same as Mode B, but instead of auto-generating usernames, it uses the exact usernames from the `MODE_C_USERNAMES` array. Bot numbers are assigned by position: index 0 = bot 1, index 1 = bot 2, etc.

## Commands

Type `!<command>` in the terminal. Plain text (no `!`) is broadcast as in-game chat by all bots.

### Targeting

| Input | Targets |
|---|---|
| `!cmd` | All bots |
| `!bot <N> cmd` | Bot number N only (1-based) |

### Movement

| Command | Description |
|---|---|
| `!forward [n]` | Walk forward. With a number: walk n blocks then stop |
| `!back [n]` | Walk backward |
| `!left [n]` | Strafe left |
| `!right [n]` | Strafe right |
| `!jump` | Toggle jump on/off |
| `!sneak` | Toggle sneak on/off |
| `!sprint` | Toggle sprint on/off |
| `!shift [sec]` | Hold sneak for n seconds, or toggle if no arg |
| `!stop` | Release all movement keys AND cancel all animations |

> **Note:** Only `!forward` works (not `!front`). The command checks against `MOVE_KEYS = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint']`.

### Inventory & Items

| Command | Description |
|---|---|
| `!slot <1-9>` | Switch hotbar slot (1 = leftmost) |
| `!click left` | Left-click (swing arm) |
| `!click right` | Right-click (use held item) |
| `!lc` | Toggle auto left-click spam (~20 clicks/sec) |
| `!lc stop` | Stop left-click spam |

### GUI

| Command | Description |
|---|---|
| `!gui open` | Open nearest container (chest, furnace, etc.) |
| `!gui list` | List items in the open window |
| `!gui click <slot>` | Left-click a slot |
| `!gui close` | Close the window |

### Utility

| Command | Description |
|---|---|
| `!gravity [on/off]` | Toggle antigravity (disables mineflayer physics so bot floats) |
| `!spin [speed]` | Continuous yaw rotation at given speed |
| `!spin stop` | Stop spinning |
| `!rotate` | Toggle continuous rotation (speed varies by bot index) |
| `!rotate stop` | Stop rotating |
| `!fly up <blocks> [speed]` | Rise vertically n blocks |
| `!fly down <blocks> [speed]` | Sink vertically n blocks |
| `!fly stop` | Cancel fly |
| `!p` | Toggle auto party accept (`/p accept` every 2s) |
| `!p stop` | Stop party accept |
| `!farm` | Start farm loop (waits for wooden sword, then `/bw` every 3s) |
| `!farm stop` | Stop farm loop |
| `!bw` | Start BedWars auto-join loop |
| `!bw1` through `!bw4` | Same as `!bw` |
| `!chat` | Toggle player chat message logging |
| `!log` | Toggle console output on/off |
| `!all` | List all online players from tab list |
| `!near` | List nearby players sorted by distance |
| `!<playername>` | Look up a player by name |

### Animations

All animations disable mineflayer physics (`physicsEnabled = false`) and manipulate the bot's position directly. `!stop` re-enables physics.

Animations support multi-bot: when targeting all bots, they spread evenly around the path (e.g., 4 bots on an orbit are 90° apart).

#### Facing options (for orbit-based animations)
Add as the last argument: `in` (faces center), `out` (faces away), or `tangent` (faces direction of travel — default).

#### Orbit

| Command | Description |
|---|---|
| `!orbit <cx> <cz> <r> [speed] [facing]` | Circle coordinate (cx, cz). Speed default: 0.05 |
| `!orbit stop` | Stop orbit |
| `!forbit <user> <r> [speed] [facing]` | Circle a target player. Speed default: 0.005 |
| `!forbit stop` | Stop forbit |
| `!follow <user> [r] [speed]` | Track a player (direct position edits). Radius default: 3, speed: 0.28 |
| `!follow stop` | Stop following |
| `!snake <user> <dist> [speed]` | Chain follow: bot0 follows player, bot1 follows bot0, etc. Distance default: 1, speed: 0.28 |
| `!snake stop` | Stop snake |

#### Wave Animations

| Command | Description |
|---|---|
| `!trick1 <cx> <cz> <r> [amp] [speed] [facing]` | Orbiting helix — bots circle while a sine wave lifts them in Y. Amp default: 3, speed: 0.05 |
| `!trick1 stop` | Stop trick1 |
| `!trick2 <cx> <cz> <r> [amp] [speed] [facing]` | Arm wave — bots are fixed on the ring at equal angles, a Y bump travels around. Amp default: 3, speed: 0.05 |
| `!trick2 stop` | Stop trick2 |
| `!wjump <cx> <cz> <r> [height] [speed] [facing]` | Jump wave — bots at fixed positions jump up in sequence. Height default: 2, speed: 0.08 |
| `!wjump stop` | Stop wjump |

#### Star

| Command | Description |
|---|---|
| `!star <cx> <cz> <outerR> [innerR] [speed] [facing]` | 5-pointed star path. InnerR defaults to outerR * 0.4. Speed default: 0.001 (~50s per lap) |
| `!star stop` | Stop star |

### Animation Quick Reference

```
!orbit      0 0 10             Circle (0,0) radius 10
!trick1     0 0 8 3 0.05 in    Orbiting helix, amp 3, face center
!trick2     0 0 8 3 0.05 out   Arm wave, amp 3, face outward
!wjump      0 0 8 2 0.08       Jump wave, height 2
!star       0 0 10 4 0.002     Star, outer 10, inner 4
!follow     Player1            Track Player1
!snake      Player1 2 0.2      Chain follow, dist 2
!forbit     Player1 5 0.01     Orbit Player1, radius 5
!fly up     10                 Rise 10 blocks
!fly down   5 0.3              Sink 5 blocks faster
```

## BedWars Auto-Join

`!bw` runs: `/hub` → wait → `/bw` → wait → check if in `bw-lobby-*` world → if not, repeat from `/hub`.

It handles:
- Cooldown messages ("You are on cooldown")
- Wrong lobby detection
- Staggered execution (1s delay between bots when targeting multiple)

## Discord Webhooks

Set webhook URLs in the `WEBHOOKS` array at the top of `gooner.js`. Bots cycle through the list round-robin. Each bot is rate-limited to one message per 5 seconds.

## Other Files in This Repo

| File | Purpose |
|---|---|
| `server.js` | Express + Socket.IO web server (beta). Run via `npm start` |
| `main.js` | Fork of gooner.js with extra features: CMD_TO_KEY (fixes `!front`), proxy support, `!scaffold`, party `#` commands |
| `gooner-collab.js` | Self-contained fork with built-in web terminal, designed for Google Colab. Reads config.json |
| `b1.js` | Single-bot controller with humanisation and client spoofing |
| `slaves.js` | 14-bot controller with same humanisation system |
| `regger.js` | Account registration tool — cycles through `vsxqt_on_TOP.txt` |
| `proxy-ping.js` | Proxy latency benchmark tool |

## Tips

- **Auto-reconnect**: Bots reconnect 10 seconds after disconnect (plus 500ms per bot index)
- **Spawn stagger**: Bots spawn 400ms apart to avoid overwhelming the server
- **Need `!front` to work?** Use `main.js` instead — it maps `front` → `forward`
- **Need proxies?** Use `main.js` or `gooner-collab.js` — they read `proxy.txt`
- **First time?** Start with Mode B and `BOT_COUNT: 1` to test your server connection
