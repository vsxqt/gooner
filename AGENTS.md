# Gooner — Agent Guide

## Quick start
```bash
npm install && node gooner.js   # terminal version (recommended)
npm install && npm start        # web dashboard (beta UI)
```
Node >=16. `socks` needed for proxy modes — `npm install socks` if `MODULE_NOT_FOUND`.

No tests, CI, or linter.

## Files

| File | Lines | Purpose |
|---|---|---|
| **`gooner.js`** | 1921 | Main bot controller. Proxy support, party system, all commands. Run via `node gooner.js` |
| **`server.js`** | 187 | Express + Socket.IO web dashboard (beta). Run via `npm start`. Loads `gooner.js`. REST: `GET /api/status|bots`, `POST /api/command|chat|settings` |
| **`main.js`** | 1980 | Fork — older version, untracked |
| **`gooner-collab.js`** | 1870 | Fork with built-in HTTP server for Colab, untracked |
| **`b1.js`** | 1667 | Humanised single-bot controller, `eu.mineberry.net`, untracked |
| **`slaves.js`** | 1584 | 14-bot humanised controller, `eu.mineberry.net`, untracked |
| **`regger.js`** | 196 | Account reg tool from `vsxqt_on_TOP.txt`, untracked |
| **`proxy-ping.js`** | 81 | Proxy benchmark, untracked |

## Key features in gooner.js

- **6 modes**: `a`, `ap<N>`, `b`, `bp<N>`, `c`, `cp<N>` — proxy variants read `proxy.txt`
- **Commands**: `!front` (not `!forward`), `!phy` (not `!gravity`), `!donut`/`!airjump` (not `!trick1`/`!trick2`), no `!rotate`
- **Party system**: `#<cmd>` from authorized `fatihs` via party chat. Defaults: `whitehawk`, `maxver`. `!add/remove/list fatih`
- **Animations**: orbit, forbit, donut, airjump, wjump, star, follow, snake, fly, spin — all freeze `physicsEnabled`, `!stop` restores it
- **Proxy**: SOCKS5 via `SocksClient`, HTTP CONNECT via `net.connect`, webshare format auto-detect, auto-failover, proxy agent cache
- **ERR_OUT_OF_RANGE**: Suppressed via `uncaughtException` + patched `EventEmitter.prototype.emit`
- **`clearAnim()`**: Cleanup helper called before every new animation, on `!stop`, and on disconnect
- **BW auto-join**: Loops `/hub` → `/bw` until `bw-lobby-*`

## Config

Edit `gooner.js` constants (SERVER_HOST, BOT_PREFIX, BOT_COUNT, etc.). `config.json` is only read by server.js display + gooner-collab.js.

## Known bugs

- `!bot <N> <cmd>` rejects usernames — expects numeric 1-based index (`!isNaN(parseInt(...))`)
- `!front` passed to `setControlState` when physics is on — mineflayer expects `'forward'` (physics-off air-walk works fine)

## Sensitive files

`.gitignore` covers `proxy.txt`, `proxy-results.txt`, `output.txt`, `node_modules/`. `vsxqt_on_TOP.txt` is NOT gitignored — don't commit secrets.
