# Gooner — How to Use

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Configuration

Edit the constants at the top of `gooner.js`:

```js
const SERVER_HOST = 'as.mineberry.net';   // Your Minecraft server
const SERVER_PORT = 25565;
const MC_VERSION  = '1.8';               // Must match server
const BOT_PREFIX  = 'wbotmark_';         // Username prefix
const BOT_COUNT   = 1;                   // Number of bots
const BOT_START   = 1;                   // Starting number suffix
```

`config.json` is only used by the web dashboard for display. Edit `gooner.js` directly for real config.

## Startup Modes

When you run `npm start` (or `node server.js`), the terminal prompts:

- **a** — Login cycler: connects each bot, sends `/login <password>`, waits, disconnects, moves to next
- **b** — Play controller (default): spawns all bots with full command system
- **c** — Custom usernames: uses a list from `MODE_C_USERNAMES` in `gooner.js`

## Commands

Type `!<command>` in the terminal or web UI chat input. Plain text (no `!`) is broadcast as in-game chat by all bots.

### Targeting

| Syntax | Effect |
|---|---|
| `!<cmd>` | Runs on all bots |
| `!bot <N> <cmd>` | Targets bot N only (1-based) |

### Movement

| Command | Description |
|---|---|
| `!forward [n]` | Walk forward (n blocks, or toggle) |
| `!back [n]` | Walk backward |
| `!left [n]` | Strafe left |
| `!right [n]` | Strafe right |
| `!jump` | Jump |
| `!sprint` | Toggle sprint |
| `!sneak` | Toggle sneak |
| `!shift <sec>` | Hold sneak for N seconds |
| `!stop` | Release all keys, cancel animations, restore physics |

### Animations

All animation commands accept an optional facing: `in`, `out`, or `tangent` (default).

| Command | Description |
|---|---|
| `!orbit <cx> <cz> <r> [spd] [facing]` | Circle a coordinate |
| `!forbit <user> <r> [spd] [facing]` | Orbit a player |
| `!trick1 <cx> <cz> <r> [amp] [spd] [facing]` | Orbiting wave |
| `!trick2 <cx> <cz> <r> [amp] [spd] [facing]` | Arm wave |
| `!wjump <cx> <cz> <r> [h] [spd] [facing]` | Jump wave |
| `!star <cx> <cz> <outerR> [innerR] [spd] [facing]` | 5-pointed star path |
| `!follow <user> [r] [spd]` | Track a player |
| `!snake <user> <dist> [spd]` | Chain follow |
| `!fly up/down <blocks> [spd]` | Vertical movement |

Stop any animation with `!<command> stop` or `!stop`.

### Utility

| Command | Description |
|---|---|
| `!gravity [on/off]` | Toggle antigravity (freezes physicsEnabled) |
| `!spin [spd]` | Spin in place |
| `!rotate` | Rotate 180 degrees |
| `!slot <1-9>` | Switch hotbar slot |
| `!click left/right` | Swing arm / use item |
| `!lc` | Left-click loop |
| `!p` | Toggle party auto-accept |
| `!farm` | Auto-farm mode |
| `!gui open/list/click/close` | GUI interaction |
| `!bw` | BedWars auto-join loop |
| `!all` | List all online players |
| `!near` | List nearby entities |
| `!chat` | Toggle chat logging |
| `!log` | Toggle console output |

## Web Dashboard

The dashboard at http://localhost:3000 shows:

- **Dashboard** — Overview with live bot telemetry, charts, server stats
- **Bots** — Per-bot status (health, food, position, held item)
- **Commands** — Quick command buttons
- **Movement** — Click-to-move controls
- **Animations** — Preset animation launchers
- **Chat** — Send in-game chat from the browser
- **Console** — Real-time log viewer
- **Settings** — Update config.json from the UI

## REST API

Available at `http://localhost:3000/api/`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | Server info, bot count, stats |
| `/api/bots` | GET | Per-bot telemetry |
| `/api/command` | POST | Execute a bot command |
| `/api/chat` | POST | Send chat message |
| `/api/settings` | POST | Update config.json |

## Discord Webhooks

Set your webhook URLs in the `WEBHOOKS` array in `gooner.js`. Webhooks are used round-robin — if you have fewer webhooks than bots, they cycle. Each bot gets at most one message per 5 seconds.

## BedWars Auto-Join

The `!bw` command runs `/hub` → `/bw` until the bot lands in a `bw-lobby-*` world. It handles cooldown messages and wrong lobby detection automatically.

## Notes

- Bots run in offline/cracked mode — no Microsoft auth needed
- Auto-reconnect: 10 seconds after disconnect
- All bots use Minecraft version **1.8**
- Proxy support is NOT built into this controller — see `main.js` for proxy-enabled forks
