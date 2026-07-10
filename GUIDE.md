# Gooner — Complete Usage Guide

## Requirements

- Node.js 16+
- Minecraft server (offline/cracked mode, version 1.8)
- `npm install mineflayer` (or `npm install` for all deps)
- For proxy support: `npm install socks`

## Quick Start

```bash
node gooner.js
```

You'll be prompted to pick a mode. That's it.

## Web Dashboard (Beta)

> **⚠️ WARNING:** The web dashboard (`npm start` → http://localhost:3000) is a beta UI and may not work reliably. Use `node gooner.js` for production.

```bash
npm start
```

This runs `server.js` which adds Express + Socket.IO + live telemetry on top of `gooner.js`.

## Configuration — edit gooner.js constants:

| Constant | Default | What it does |
|---|---|---|
| `SERVER_HOST` | `as.mineberry.net` | Your Minecraft server |
| `SERVER_PORT` | `25565` | Server port |
| `MC_VERSION` | `'1.8'` | Must match server |
| `BOT_PREFIX` | `'user_prefix_'` | Prefix for bot usernames (Modes A & B) |
| `BOT_COUNT` | `4` | Number of bots (Mode B) |
| `BOT_START` | `1` | Starting number suffix |
| `LOGIN_PASSWORD` | `'your_password'` | `/login <pass>` (Mode A only) |
| `MODE_C_USERNAMES` | `['custom_bot_1', ...]` | Custom usernames (Mode C) |
| `WEBHOOKS` | `[...]` | Discord webhook URLs |

### config.json

`config.json` is only read by the web dashboard (`server.js`) and `gooner-collab.js`. It does NOT affect `node gooner.js`.

**For `node gooner.js`, edit the constants in the file itself.**

### package.json & package-lock.json

- **`package.json`** — Project metadata + dependencies (mineflayer, express, socket.io, chart.js). `"start"` runs `node server.js`.
- **`package-lock.json`** — Auto-generated lockfile pinning exact dependency versions. Never edit manually.

## Startup Modes (6 modes)

```
Select mode:
  a      — Login cycler
  ap<N>  — Login cycler with proxies (N bots per proxy)
  b      — Play controller
  bp<N>  — Play controller with proxies
  c      — Custom usernames
  cp<N>  — Custom usernames with proxies
```

### Mode A — Login Cycler
Connects bots one-at-a-time: connect → `/login <pass>` → wait → disconnect → next bot.

### Mode A with Proxies (`ap<N>`)
Same as A but routes each bot through a proxy from `proxy.txt`. `N` = bots per proxy (e.g., `ap2` = 2 bots per proxy, cycles through the list).

### Mode B — Play Controller (Default)
Spawns all bots simultaneously with full command system.

### Mode B with Proxies (`bp<N>`)
Same as B with proxy routing from `proxy.txt`.

### Mode C — Custom Usernames
Uses exact usernames from `MODE_C_USERNAMES` array. Bot 1 = first entry, etc.

### Mode C with Proxies (`cp<N>`)
Same as C with proxy routing.

### Proxy file format (`proxy.txt`)
One URL per line. Supports:
```
http://user:pass@host:port
socks5://user:pass@host:port
host:port:user:pass              (webshare format, auto-detected)
```

## Commands

Type `!<command>` in terminal. Plain text = chat to all bots.

### Targeting

| Input | Targets |
|---|---|
| `!cmd` | All bots |
| `!bot <N> cmd` | Bot N only (1-based) |

### Movement

| Command | Description |
|---|---|
| `!front [n]` | Walk forward (n blocks, or toggle) |
| `!back [n]` | Walk backward |
| `!left [n]` | Strafe left |
| `!right [n]` | Strafe right |
| `!jump` | Toggle jump |
| `!sneak` | Toggle sneak |
| `!sprint` | Toggle sprint |
| `!shift [sec]` | Hold sneak, or toggle. With number: hold N sec then release |
| `!stop` | Release all keys + cancel all animations |

> **Note:** `MOVE_KEYS = ['front', 'back', 'left', 'right', 'jump', 'sneak', 'sprint']`. Type `!front` (not `!forward`).

### Inventory & Items

| Command | Description |
|---|---|
| `!slot <1-9>` | Switch hotbar slot (1 = left) |
| `!click left` | Swing arm |
| `!click right` | Use held item |
| `!lc` | Toggle auto left-click spam (~20/sec) |
| `!lc stop` | Stop |

### GUI

| Command | Description |
|---|---|
| `!gui open` | Open nearest container |
| `!gui list` | List items in open window |
| `!gui click <slot>` | Left-click a slot |
| `!gui close` | Close window |

### Utility

| Command | Description |
|---|---|
| `!phy [on/off]` | Toggle physics on/off (off = antigravity, bot floats) |
| `!spin [speed]` | Continuous yaw spin |
| `!spin stop` | Stop spin |
| `!fly up <n> [speed]` | Rise n blocks |
| `!fly down <n> [speed]` | Sink n blocks |
| `!fly stop` | Cancel fly |
| `!p` | Toggle auto `/p accept` every 2s |
| `!p stop` | Stop |
| `!farm` | Farm loop: wait for wooden sword → `/bw` every 3s |
| `!farm stop` | Stop |
| `!bw` | BedWars auto-join (`/hub` → `/bw` → lobby-1) |
| `!chat` | Toggle chat logging |
| `!log` | Toggle console output |
| `!tab` | List all players from tab list |
| `!near` | List nearby players sorted by distance |
| `!<player>` | Look up a player by name |

### Party Commands

| Command | Description |
|---|---|
| `!add fatih <user>` | Authorize a player to issue `#` commands via party chat |
| `!remove fatih <user>` | Remove authorization |
| `!list fatih` | List authorized issuers |

Default authorized issuers: `whitehawk`, `maxver`. Party messages matching `#<cmd>` from authorized players are executed as bot commands.

### Animations

All animations disable physics and edit position directly. `!stop` restores physics. Multi-bot auto-spreads evenly around paths.

#### Facing (last arg): `in` (face center), `out` (face away), `tangent` (direction of travel — default)

| Command | Description |
|---|---|
| `!orbit <cx> <cz> <r> [spd] [facing]` | Circle coordinate. Spd default: 0.05 |
| `!orbit stop` | Stop |
| `!forbit <user> <r> [spd] [facing]` | Circle a player. Spd default: 0.005 |
| `!forbit stop` | Stop |
| `!donut <cx> <cz> <r> [amp] [spd] [facing]` | Orbiting helix — bots circle + sine wave lifts them in Y |
| `!donut stop` | Stop |
| `!airjump <cx> <cz> <r> [amp] [spd] [facing]` | Arm wave — bots fixed on ring, Y bump travels around |
| `!airjump stop` | Stop |
| `!wjump <cx> <cz> <r> [h] [spd] [facing]` | Jump wave — bots jump in sequence. H default: 2 |
| `!wjump stop` | Stop |
| `!star <cx> <cz> <outerR> [innerR] [spd] [facing]` | 5-pointed star. InnerR default: outerR × 0.4 |
| `!star stop` | Stop |
| `!follow <user> [r] [spd]` | Track a player. R default: 3, spd: 0.28 |
| `!follow stop` | Stop |
| `!snake <user> <dist> [spd]` | Chain follow. Dist default: 1, spd: 0.28 |
| `!snake stop` | Stop |

### Quick Examples

```
!front 10          Walk forward 10 blocks
!phy               Toggle antigravity
!orbit 0 0 10      Circle (0,0) radius 10
!donut 0 0 8 3     Orbiting helix
!airjump 0 0 8 3   Arm wave
!wjump 0 0 8 2     Jump wave
!star 0 0 10       Star path
!follow Player1    Track player
!snake Player1 2   Chain follow
!fly up 10         Rise 10 blocks
!add fatih Bob     Authorize Bob for # commands
```

## BedWars Auto-Join

`!bw` runs `/hub` → wait → `/bw` → wait → check for `bw-lobby-*`. Repeats from `/hub` on failure. Handles cooldowns and wrong lobbies. 1s stagger between bots.

## Discord Webhooks

Set webhook URLs in `WEBHOOKS` array at top of `gooner.js`. Round-robin across bots. 5s rate limit per bot.

## Tips

- **Auto-reconnect**: 10s + index × 500ms after disconnect
- **Spawn stagger**: 400ms between bots
- **Proxy file**: `proxy.txt` in the same directory (not gitignored — don't commit secrets)
- **First time?** Use Mode B with `BOT_COUNT: 1` to test your connection
