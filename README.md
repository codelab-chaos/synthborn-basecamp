# synthborn-basecamp

Shared tooling, docs, and game-asset extracts for the Synthborn Hytale mods.
Node built-ins only — no `npm install` for the core tools. Run from this repo root.

## Layout

Split out of the old `hytale-mods` monorepo. Each mod is now its own sibling repo
under the workspace root; basecamp holds the cross-cutting bits.

```
<workspace root>/            e.g. ~/git/hytale-mods
├── synthborn-basecamp/      tools/, docs/, _Assets/, remote-host.env   ← this repo
├── synthborn-rcon/          SynthRCON jar
├── synthborn-overseer/      SynthOverseer jar
├── synthborn-kyn/           SynthUnits jar
└── synthborn-terrascape/    SynthTerrascape jar
```

Each mod is a **self-contained Gradle build** — no `../` or basecamp references — so it
builds standalone in its own GitHub repo. Deploy config (`remote-host.env`, gitignored)
lives in **basecamp only**; the mod repos carry none.

The basecamp→mod directory map is defined once in
[`tools/library/workspace.js`](tools/library/workspace.js) (`MODULE_DIRS`). Everything
that reaches into a mod repo resolves through it — update that file if a mod is renamed.

## Deploy matrix

| Target       | Save (unchanged)      | Jars deployed                |
|--------------|-----------------------|------------------------------|
| `overseer`   | `overseer-test`       | `SynthRCON`, `SynthOverseer` |
| `units`      | `synthtest-02`        | `SynthRCON`, `SynthUnits`    |
| `terrascape` | `synth-worldview-mvp` | `SynthRCON`, `SynthTerrascape` |

```bash
node tools/deploy.js --list
node tools/deploy.js overseer --restart --verify
node tools/deploy.js units --smoke
node tools/deploy.js terrascape --test
node tools/remote-deploy.js overseer --restart --verify   # Mac host
```

See [`AGENTS.md`](../AGENTS.md) (workspace root) for the full operator quickstart —
server logs, build/deploy/restart loops, and the SynthUnits validation lanes.

## Cross-repo dependencies

**No build-time coupling.** Each mod is a self-contained Gradle build (own `gradlew`,
deps from `maven.hytale.com`); none compiles against basecamp or another sibling. A mod
can be built standalone: `./gradlew deploy -PmodsDir=<save>/mods`.

The only coupling is **operational** — basecamp tooling reaches into the mod repos:

| Mod repo               | What basecamp tooling touches |
|------------------------|-------------------------------|
| _all four_             | `tools/deploy.js` / `remote-deploy.js` (runs each mod's `gradlew deploy`); `tools/server/*` (start/stop/logs); `tools/rcon/synth-rcon.js`; `remote-host.env` |
| `synthborn-overseer`   | `tools/overseer/redeploy.js`; generators that read its source and write back into its resources — `build-builder-catalog-doc.js`, `extract-npcs.js`, `index-hytale-prefabs.js` |
| `synthborn-kyn`        | `tools/smoke/synthunits-smoke.js`; the `synth-rcon.js validate …` lane |
| `synthborn-terrascape` | `deploy.js terrascape --test` → its `npm test`; `tools/terrascape/probe-blocks.js`; `--clear-cache` |
| `synthborn-rcon`       | deployed as a companion jar alongside every target |

What each mod relies on basecamp **for**: the build/deploy/run/validate harness plus the
shared SDK reference and `_Assets` extracts under `docs/` — nothing at compile or runtime.

## SDK reference

[`docs/sdk-reference/`](docs/sdk-reference/) holds offline `javap` signatures for the pinned
`com.hypixel.hytale:Server` jar. Search via [`llms.txt`](docs/sdk-reference/llms.txt) (classes),
[`methods.txt`](docs/sdk-reference/methods.txt) (methods), or `node tools/sdk/sdk-search.js`.

After bumping `Server:X.Y.Z` in a mod's `build.gradle.kts`:

```bash
cd ../synthborn-kyn && ./gradlew compileJava   # pull jar into Gradle cache
cd ../synthborn-basecamp
node tools/sdk/extract-sdk-reference.js --full
node tools/sdk/diff-sdk-reference.js           # review changes vs last commit
```

See [`tools/sdk/README.md`](tools/sdk/README.md) and [`docs/sdk-reference/README.md`](docs/sdk-reference/README.md).

`kyn` and `terrascape` also keep their own mod-local `tools/` (e.g. `extract-world-interfaces.js`,
`generate-grid.js`); those are independent of basecamp.
