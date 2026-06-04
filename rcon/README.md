# RCON Tools

Small command-line helpers for talking to the local Hytale RCON extension.

For command output capture, prefer `SynthRCON`'s localhost JSON bridge once that plugin is running. HyWebConnect's classic RCON response currently returns an execution acknowledgement, while command output is written to the server log.

## SynthRCON CLI

`synth-rcon.js` talks to the SynthRCON JSON bridge on port `25576` and prints captured command messages.

## Local Server Port Map

When both local dev servers are running, use the save name so the helper resolves the matching SynthRCON port:

| Save | Hytale game port | SynthRCON port | Use for |
|---|---:|---:|---|
| `synthtest-02` | `5520` | `25576` | SynthUnits commands and `/validate` scenarios |
| `overseer-test` | `5550` | `25577` | SynthOverseer `/os` commands |

For SynthUnits validation, prefer:

```bash
node tools/rcon/synth-rcon.js --save synthtest-02 validate spawn-basic
```

Check health:

```bash
node tools/rcon/synth-rcon.js --health
```

Send one command:

```bash
node tools/rcon/synth-rcon.js synth list
```

Send several commands:

```bash
node tools/rcon/synth-rcon.js synth spawn -- synth list -- synth inspect 1
```

Run Java runtime validation:

```bash
node tools/rcon/synth-rcon.js validate spawn-basic at 0,80,0
```

With token auth:

```bash
node tools/rcon/synth-rcon.js --token fantastic synth list
```

Print JSON for scripts:

```bash
node tools/rcon/synth-rcon.js --json synth list
```

Environment variables:

- `SYNTH_RCON_HOST`
- `SYNTH_RCON_PORT`
- `SYNTH_RCON_TOKEN`
- `SYNTH_RCON_TIMEOUT_MS`

## Classic RCON CLI

`node-rcon.js` uses only Node's built-in `net` module; no `npm install` is required.

If your RCON extension has a password, set it once in your shell:

```bash
export RCON_PASSWORD='your-password'
```

Send one command:

```bash
node tools/rcon/node-rcon.js synth list
```

Send several commands in one connection:

```bash
node tools/rcon/node-rcon.js synth spawn -- synth list -- synth inspect 1
```

Override connection settings:

```bash
node tools/rcon/node-rcon.js --host 127.0.0.1 --port 25575 --password 'your-password' synth list
```

Environment variables:

- `RCON_HOST`
- `RCON_PORT`
- `RCON_PASSWORD` (optional; empty password is allowed)
- `RCON_TIMEOUT_MS`
