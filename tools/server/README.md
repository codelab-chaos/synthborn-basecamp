# Hytale Server Tools

Cross-platform Node scripts for running a Hytale dedicated server independent of the launcher / client, and driving it via RCON.

All scripts use only Node built-ins — no `npm install` required.

## Quick start (Windows defaults)

Foreground:

```bash
node tools/server/start-server.js
```

Detached:

```bash
node tools/server/start-server.js --background
node tools/rcon/synth-rcon.js synth list
node tools/server/stop-server.js
```

The Windows defaults assume the Hytale launcher's install layout:

- install root: `%APPDATA%\Hytale\install\<branch>\package`, where `<branch>` is read from `%APPDATA%\Hytale\patchline.json` (the launcher's active branch, usually `release`). Falls back to `release` → `pre-release`.
- save:         `%APPDATA%\Hytale\UserData\Saves\synth-test-01`

If the launcher switches branches (e.g. opts into `pre-release`), the script follows on the next run — no flag changes needed.

## First-time setup (one OAuth dance per save)

The server defaults to `--auth-mode authenticated`, which is the only mode a release-branch Hytale client will actually connect to (see [Notes](#notes) for why). On a fresh save the server has no credentials, so it needs to log in once on your behalf.

> **Per-save, not per-machine.** The "Encrypted" credential store lives inside the save directory. Every new save you create needs its own OAuth dance — credentials from one save don't carry over to another. There is no machine-wide auth state to inherit.

```bash
# 1. Start the server (auto-detects which save it should run against)
node tools/server/start-server.js --background

# 2. Wait for it to be ready
node tools/rcon/synth-rcon.js --health

# 3. Kick off the OAuth device flow
node tools/rcon/synth-rcon.js -- auth login device
```

Step 3 just acknowledges. The actual URL + 8-char code are written to the server console / log. Grab them (substitute your save dir):

```bash
SAVE="$APPDATA/Hytale/UserData/Saves/overseer-test"   # or whichever save you're booting
LATEST=$(ls -t "$SAVE/logs"/*.log | head -1)
grep -E "Visit|user_code" "$LATEST" | tail -3
```

You'll see something like:

```
[AbstractCommand] Visit: https://oauth.accounts.hytale.com/oauth2/device/verify
[AbstractCommand] Or visit: https://oauth.accounts.hytale.com/oauth2/device/verify?user_code=ABCD1234
```

Open the URL in a browser, approve. The server log will then show:

```
[ServerAuthManager] Auto-selected profile: <YourName> (<your-uuid>)
[ServerAuthManager] Authentication successful! Mode: OAUTH_DEVICE
```

Now persist the credentials to disk so future boots reuse them:

```bash
node tools/rcon/synth-rcon.js -- auth persistence Encrypted
# → "Credential storage changed to: Encrypted"
```

Verify:

```bash
node tools/rcon/synth-rcon.js -- auth status
# → Token Source: OAuth Device, Profile: <YourName>, Session/Identity Token: Present
```

From here on, `node tools/server/start-server.js --background` against **this save** just works — server boots, reloads encrypted credentials, you join via Direct Connect → `localhost:<port>`. Tokens auto-refresh on the hour. You'll repeat this dance:
- For every new save you create (credentials are per-save).
- If your refresh chain breaks (network outage spanning the refresh window).
- If you `/auth logout`.

## Linux / macOS

There's no canonical install path on Linux/macOS, so pass them explicitly (or set env vars once):

```bash
export HYTALE_INSTALL=/opt/hytale/package
export HYTALE_SAVE=/srv/hytale/synth-test-01
node tools/server/start-server.js
```

Layout expected under `HYTALE_INSTALL`:

```
<install>/
  game/latest/Server/HytaleServer.jar
  game/latest/Server/HytaleServer.aot   # optional, used if present
  game/latest/Assets.zip
  jre/latest/bin/java                    # optional; or use --java / system java
```

If your install doesn't ship a bundled JRE, point `--java` at any Java 25+ binary:

```bash
node tools/server/start-server.js --java /usr/bin/java
```

## start-server.js

| Flag | Default | Notes |
|---|---|---|
| `--save <path>` | `%APPDATA%\Hytale\UserData\Saves\synth-test-01` (Win) | Becomes the server's cwd. |
| `--install <path>` | `%APPDATA%\Hytale\install\<branch>\package` (Win, branch auto-detected from `patchline.json`) | Root containing `game/latest/...` |
| `--java <path>` | `<install>/jre/latest/bin/java[.exe]` | Override the JVM binary. |
| `--auth-mode <mode>` | `authenticated` | `authenticated` \| `offline` \| `insecure`. Notes: `offline` is rejected for external client connections (`offline mode is only valid in singleplayer`). `insecure` requires a dev-branch client (`server requires development mode which is not supported by this build`). For a release-branch client you can actually join, use `authenticated` with the one-time OAuth device flow below. |
| `--bind <addr:port>` | `0.0.0.0:5520` | Use `127.0.0.1:5520` to refuse LAN. |
| `--min-ram <GB>` | `2` | `-Xms`. |
| `--max-ram <GB>` | `4` | `-Xmx`. |
| `--no-aot` | off | Skip `-XX:AOTCache`. Use if the `.aot` is missing or mismatched. |
| `--skip-running-check` | off | Bypass the UDP bind preflight that prevents starting a second server on the same port. |
| `--background` | off | Spawn detached and return. |
| `--dry-run` | off | Print the resolved command and exit. |

Anything after `--` is forwarded to `HytaleServer.jar`:

```bash
node tools/server/start-server.js -- --boot-command "synth list"
```

Env fallbacks: `HYTALE_SAVE`, `HYTALE_INSTALL`, `HYTALE_JAVA`.

Before launching, `start-server.js` briefly checks whether the requested UDP bind port is already occupied. If another Hytale server is still listening on `5520`, startup aborts with a message instead of creating a confusing second process. Prefer stopping the old server with `node tools/server/stop-server.js`; use `--skip-running-check` only when you intentionally want to bypass that guard.

## stop-server.js

Sends `stop` to the SynthRCON bridge for a clean shutdown:

```bash
node tools/server/stop-server.js
node tools/server/stop-server.js --token fantastic
```

Env fallbacks: `SYNTH_RCON_HOST` (default `127.0.0.1`), `SYNTH_RCON_PORT` (default `25576`), `SYNTH_RCON_TOKEN`, `SYNTH_RCON_TIMEOUT_MS`.

## Sending arbitrary RCON commands

Use the existing CLI — it's already portable Node:

```bash
node tools/rcon/synth-rcon.js --health
node tools/rcon/synth-rcon.js synth list
node tools/rcon/synth-rcon.js synth spawn -- synth list -- synth inspect 1
```

See `tools/rcon/README.md` for full options.

## Typical loop

```bash
# Terminal 1 — server (foreground, Ctrl+C to stop)
node tools/server/start-server.js

# Terminal 2 — automation
node tools/rcon/synth-rcon.js --health
node tools/rcon/synth-rcon.js synth list
```

Or fully scripted:

```bash
node tools/server/start-server.js --background
# wait for /health to return 200 in your CI script...
node tools/rcon/synth-rcon.js synth list
node tools/server/stop-server.js
```

## Notes

- **Auth modes — what actually works for a release-branch client.** Only `authenticated` lets a normal Hytale client join (see [First-time setup](#first-time-setup-one-oauth-dance-then-never-again)). `offline` is rejected at handshake (`client.general.disconnect.offlineModeSingleplayerOnly`) — it's only usable when the client is running the server itself in singleplayer mode. `insecure` triggers a "server requires development mode which is not supported by this build" error because release-channel clients don't speak the dev-mode handshake. Don't bother with either until/unless you're on a dev-branch build.
- **AOT cache.** When `HytaleServer.aot` is present it's used via `-XX:AOTCache=...` for faster cold start. If the server install gets updated and the .aot is stale, the JVM logs a warning — pass `--no-aot` to fall back.
- **The bundled JRE.** The Hytale launcher ships its own Java 25 JRE; we use it by default so the server runs even on machines without system Java. Override with `--java` or `HYTALE_JAVA` if you need a different JVM.
- **Logs** are written to `<save>/logs/<timestamp>_server.log` by the server itself, regardless of foreground/background.
