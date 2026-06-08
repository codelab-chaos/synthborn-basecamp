# Remote Mac deployment

Build mods on Windows, run Hytale dev servers on a Mac host. All commands run from the
**repo root** unless noted.

Shared library: `tools/library/remote-host.js`  
Server control CLI: `tools/server/remote-server.js`  
Deploy CLIs: `tools/deploy.js`, `tools/remote-deploy.js`

---

## Setup (once per machine)

### 1. Config file

Copy `tools/remote-host.env.example` → `remote-host.env` at the **repo root** (gitignored).
One file for all Synth* mods. Legacy per-mod `remote-host.env` paths still work as fallback.

| Variable | Purpose |
|----------|---------|
| `HYTALE_REMOTE_ENABLED` | `true` = remote Mac; `false` = local Windows |
| `HYTALE_REMOTE_SSH` | SSH config host alias (preferred over host+user) |
| `HYTALE_REMOTE_HOST` | mDNS or hostname of the Mac |
| `HYTALE_REMOTE_USER` | Mac login name |
| `HYTALE_REMOTE_SAVES` | Mac saves root (quoted path with spaces) |
| `HYTALE_REMOTE_INSTALL` | Mac Hytale install package dir |
| `HYTALE_REMOTE_REPO` | Optional path to hytale-mods on Mac (for `start-server.js`) |
| `SYNTH_RCON_HOST` | Hostname or IP Windows uses for RCON + Terrascape HTTP |
| `SYNTH_TERRASCAPE_URL` | Optional full Terrascape URL; defaults to `http://$SYNTH_RCON_HOST:5960` when remote is on |

Toggle per command with `--remote` or `--local` on any wired tool.

### Stable hostname (recommended)

Reserve a LAN IP on your router, then map a friendly name on **Windows** (`C:\Windows\System32\drivers\etc\hosts`, as Administrator):

```
192.168.0.128  macbook-server.org
```

Set `SYNTH_RCON_HOST=macbook-server.org` in `remote-host.env`. When the Mac’s IP changes, update **only the hosts file** (one line), not every tool or mod. Terrascape becomes `http://macbook-server.org:5960`.

SSH `~/.ssh/config` can use the same name:

```
Host hytale-mac
  HostName macbook-server.org
  User chadneff
```

`.local` mDNS is fine for casual use; a hosts alias is more reliable from Windows for RCON/HTTP.

### 2. SSH (Windows)

Tools use `C:\Windows\System32\OpenSSH\ssh.exe` / `scp.exe`, **not** Git Bash ssh.

```powershell
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

`~/.ssh/config` example:

```
Host hytale-mac
  HostName macbook-server.org
  User chadneff
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  AddKeysToAgent yes
```

### 3. Mac prerequisites

- Hytale installed with a release server package under `HYTALE_REMOTE_INSTALL`
- Dev saves present under `HYTALE_REMOTE_SAVES` (each save has `dev-server.json`, `mods/`, etc.)
- Node **not** required unless the full hytale-mods repo is cloned to `HYTALE_REMOTE_REPO`

---

## Remote server control

```bash
node tools/server/remote-server.js status --all
node tools/server/remote-server.js status overseer-test

node tools/server/remote-server.js start overseer-test --max-ram 6 --wait
node tools/server/remote-server.js stop overseer-test
node tools/server/remote-server.js restart synthtest-02 --max-ram 6 --wait --force
```

| Command | What it does |
|---------|--------------|
| `start` | SSH to Mac → launch Hytale server (direct `java` or repo `start-server.js` if present) |
| `stop` | SSH → `curl` POST `stop` to SynthRCON on Mac **localhost** |
| `stop --force` | SSH kill by PID file / UDP bind port if clean stop fails |
| `restart` | stop (tolerates already-down) → pause 4s → start; `--wait` polls RCON health |
| `status` | RCON `/health` from Windows via `SYNTH_RCON_HOST` |

### Save ports

Read from each save's `dev-server.json` on Windows (local copy). Defaults:

| Save | Game bind | RCON port |
|------|-----------|-----------|
| `overseer-test` | `0.0.0.0:5550` | `25577` |
| `synthtest-02` | `0.0.0.0:5520` | `25576` |
| `synth-worldview-mvp` | `0.0.0.0:5959` | `25578` |

Remote start forces `-Dsynthrcon.host=0.0.0.0` so health checks work from the LAN.

### Mac-side artifacts

- Logs: `<save>/logs/dev-server.out` (stdout/stderr from direct java start)
- PID: `<save>/.dev-server.pid`

---

## Deploy mods to the remote server

Remote deploy = **gradle build on Windows** + **scp jar to Mac** `<save>/mods/`.

Jars land at:

```
$HYTALE_REMOTE_SAVES/<save>/mods/
```

### Recommended target wrappers

```bash
node tools/remote-deploy.js --list
node tools/remote-deploy.js overseer --restart --verify
node tools/remote-deploy.js units --smoke
```

| Target | Save | Deployed jars |
|--------|------|---------------|
| `overseer` | `overseer-test` | `SynthRCON`, `SynthOverseer` |
| `units` | `synthtest-02` | `SynthRCON`, `SynthUnits` |
| `terrascape` | `synth-worldview-mvp` | `SynthRCON`, `SynthTerrascape` |

`tools/remote-deploy.js` is a thin wrapper over `tools/deploy.js --remote`; the target matrix
lives in `tools/library/deploy-targets.js`.

### SynthOverseer legacy wrapper

```bash
node tools/overseer/redeploy.js              # build + scp jar (+ overseer config files)
node tools/overseer/redeploy.js --restart    # stop → deploy → start → verify setup line
node tools/overseer/redeploy.js --verify     # confirm running jar via remote log grep
```

Respects `HYTALE_REMOTE_ENABLED` in `remote-host.env`. Target save: `overseer-test`.

### SynthUnits smoke (build + deploy both mods)

```bash
node tools/smoke/synthunits-smoke.js --build --deploy
```

Deploys SynthUnits + SynthRCON jars to `synthtest-02/mods/` on the Mac when remote is enabled.

### Manual pattern

Any tool can call `deployModRemote` from `tools/library/remote-host.js`:

1. `./gradlew fatJar` in the mod directory
2. scp newest jar to remote `<save>/mods/`
3. Restart server so the new jar loads

For local-only deploy, use normal gradle:

```bash
cd mods/SynthOverseer && .\gradlew.bat deploy    # copies to local Windows save
```

---

## End-to-session loops

### SynthOverseer on remote Mac

```bash
node tools/overseer/redeploy.js --restart
# or manually:
node tools/server/remote-server.js stop overseer-test
node tools/overseer/redeploy.js
node tools/server/remote-server.js start overseer-test --wait
node tools/overseer/redeploy.js --verify
```

### SynthUnits validation on remote Mac

```bash
node tools/smoke/synthunits-smoke.js --build --deploy
node tools/server/remote-server.js start synthtest-02 --wait
node tools/rcon/synth-rcon.js --save synthtest-02 --health
# … validate / smoke commands …
node tools/server/remote-server.js stop synthtest-02
```

See [AGENTS.md](../AGENTS.md) § SynthUnits validation for scenario details.

---

## How remote start/stop works

```
Windows (Cursor)                         Mac host
────────────────                         ──────────
remote-server.js start  ──SSH────────►  nohup java … HytaleServer.jar
remote-server.js stop   ──SSH────────►  curl 127.0.0.1:<rcon>/command {"command":"stop"}
remote-server.js status ──HTTP────────► SYNTH_RCON_HOST:<rcon>/health
redeploy / deployModRemote ──SCP──────►  <save>/mods/*.jar
```

**SynthRCON `/command` is localhost-only** on the server. That is why stop goes through SSH
even though health checks hit the Mac over the LAN. Game commands from `synth-rcon.js` on
Windows may return `403 forbidden_remote_address` until SynthRCON allows token-authenticated
remote commands (health already works).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `ssh … permission denied` | Key not in Windows ssh-agent | `ssh-add` via PowerShell OpenSSH |
| `parse error near '&&'` | Old remote-host.js | Update repo; background start must not use `& &&` |
| `java not found under …/jre/latest` | Wrong JRE layout | Mac uses `jre/latest/Contents/Home/bin/java` |
| Health UP but stop 403 from Windows | SynthRCON localhost guard | Use `remote-server.js stop` (SSH curl), not `stop-server.js` directly |
| RCON connection refused from Windows | Server down or wrong port | `status --all`; check `SYNTH_RCON_HOST` is LAN IP |
| Start says port in use | Previous server still running | `stop --force` then start again |
| Deploy ok but old mod behavior | Server not restarted | `restart` or stop → start after scp |

---

## Files reference

| Path | Role |
|------|------|
| `remote-host.env` (repo root) | Machine-specific remote config (gitignored) — **canonical** |
| `tools/remote-host.env.example` | Committed template |
| `tools/deploy.js` | Local/default target deploy CLI |
| `tools/remote-deploy.js` | Remote target deploy CLI |
| `tools/library/deploy-targets.js` | Shared target matrix and deploy/test orchestration |
| `tools/library/remote-host.js` | SSH, scp, deploy, start/stop helpers |
| `tools/server/remote-server.js` | start / stop / restart / status CLI |
| `tools/server/remote-logs.js` | remote Mac save log tail/grep/auth helper |
| `tools/overseer/redeploy.js` | SynthOverseer build + deploy + verify |
| `tools/rcon/synth-rcon.js` | RCON client (health + commands) |
| `tools/server/start-server.js` | Local or Mac-repo server launcher |
| `tools/server/stop-server.js` | Local RCON stop (use remote-server.js when remote) |
