# Hytale Version Update Checklist

Use this when moving the workspace to a new Hytale server/client release or hotfix
(e.g. `0.5.3` → `0.5.4`).

The core routine is:

1. Shut everything down cleanly before patching.
2. Patch Hytale through the launcher.
3. Capture the new assets (TOC + `_Assets/`) so updates are documented and diffable.
4. Recompile and redeploy fresh jars against the new server API.
5. Smoke-test against the patched server.

Do not treat "the old jars still load" as the full compatibility check. Loading proves only
manifest/runtime tolerance; **compiling** proves source compatibility, and **smoke testing**
proves the basic mod features still work.

> Machines: **macbookpro** (this Mac) and **windowsMSI** (the Windows PC). Build/deploy works
> on both; `./gradlew deploy` resolves the Hytale save path per-OS. This doc shows the Mac
> commands first; the Windows equivalents use `.\gradlew.bat`. Build prerequisites (JDK 25,
> etc.) are covered in [`deployment.md`](deployment.md).

The four Gradle mods and their deploy saves:

| Repo | Jar | Save |
|------|-----|------|
| `synthborn-overseer` | SynthOverseer | `overseer-test` |
| `synthborn-kyn` | SynthUnits | `synthtest-02` |
| `synthborn-rcon` | SynthRCON | `synthtest-02` |
| `synthborn-terrascape` | SynthTerrascape | `synth-worldview-mvp` |

(`synthborn-basecamp` has no Gradle build — it holds the shared tools and docs.)

---

## 1. Shut down before patching

The Hytale updater refuses to patch while game processes — or sometimes **any `java`
process** — are running. There are two distinct kinds of JVM to clear:

**a. Hytale game servers** (`HytaleServer.jar`, on the bundled JRE). Prefer a graceful RCON
stop so worlds save. Each server runs with a `-Dsynthrcon.port=2557x`:

```bash
# graceful, per running save (RCON 'stop'); from windowsMSI this is wrapped by remote-server.js
curl -X POST 127.0.0.1:<rcon-port>/command -d '{"command":"stop"}'
# or, from windowsMSI over SSH:
node tools/server/remote-server.js stop <save>
```

Fallbacks if a server won't stop cleanly (e.g. hung at 100% CPU):

```bash
pkill -TERM -f HytaleServer.jar   # graceful-ish; SIGTERM runs JVM shutdown hooks
pkill -9    -f HytaleServer.jar   # last resort for a hung server
```

**b. Gradle build daemons** (`java` from Homebrew openjdk, left over ~3h after a build).
They don't touch Hytale files but trip the updater's "is java running?" check:

```bash
( cd synthborn-overseer && ./gradlew --stop )   # stops the shared Gradle daemons
pkill -f GradleWorkerMain                         # any stray workers
```

Leave the **Hytale Launcher** running — you need it to install. Confirm everything is clear:

```bash
pgrep -fl HytaleServer.jar || echo "no servers"
pgrep -fl /bin/java        || echo "no JVMs"
```

Stale `<save>/.dev-server.pid` files (pointing to dead PIDs) get left behind after a
force-kill and can cause false "server running" reports — delete them.

## 2. Patch Hytale

1. Update through the launcher (or install flow).
2. Confirm the new version. The most reliable marker is the Server jar manifest; the launcher
   log also records the from/to:

```bash
unzip -p "<install>/game/latest/Server/HytaleServer.jar" META-INF/MANIFEST.MF | grep -i Implementation-Version
grep -i "applying game update" "<install>/../hytale-launcher.log" | tail -1
```

`<install>` = `~/Library/Application Support/Hytale/install/release/package` on macbookpro,
`%APPDATA%/Hytale/install/release/package` on windowsMSI.

## 3. Capture the new assets

The patch overwrites `Assets.zip`, so capture the baseline **right after** updating. A
versioned, committable TOC (path · size · CRC-32 per file) is the change-detection trail —
`git diff assets-toc-<old>.json assets-toc-<new>.json` shows exactly what Hypixel changed:

```bash
cd synthborn-basecamp
node tools/assets/build-assets-toc.js            # writes tools/assets/toc/assets-toc-<version>.json (committable)
```

Optionally refresh the unpacked reference (`_Assets/` is gitignored, ~3.3 GB):

```bash
ditto -x -k "<install>/game/latest/Assets.zip" _Assets   # full overwrite extract
```

> Note: the very first run establishes the baseline — you can only *diff* from the next
> update onward (and only if you captured the TOC before the next patch overwrote the zip).

## 4. Bump the server API version

First confirm the new version is actually published, or every build fails:

```bash
curl -s https://maven.hytale.com/release/com/hypixel/hytale/Server/maven-metadata.xml | grep -E "release|version"
```

Then bump the **exact** Gradle pin in all four mods (`compileOnly`, and `testImplementation`
where present — `synthborn-rcon` has only `compileOnly`):

```
com.hypixel.hytale:Server:<old>  ->  com.hypixel.hytale:Server:<new>
```

Manifest `ServerVersion` ranges usually do **not** need to change for a patch: a range like
`>=0.5.0 <0.6.0` already covers any `0.5.x`. Only narrow it if compatibility requires it.
Bumping the Gradle dependency is what gives compile-time API checks against the new jar.

## 5. Recompile and redeploy

Servers should be down (step 1), so deploy is just a file copy. From each repo:

```bash
# macbookpro
( cd synthborn-overseer  && ./gradlew clean deploy )
( cd synthborn-kyn       && ./gradlew clean deploy )
( cd synthborn-rcon      && ./gradlew clean deploy )
( cd synthborn-terrascape && ./gradlew clean deploy )   # also runs webpack :buildWeb (needs `npm install` once)
```

```powershell
# windowsMSI
cd synthborn-overseer ; .\gradlew.bat clean deploy ; cd ..
# ...repeat per repo
```

`deploy` resolves the save path per-OS and never clobbers the real (gitignored)
`overseer-config.json`. Confirm fresh jars landed and the new artifact resolved:

```bash
find ~/.gradle/caches -path "*hytale*Server*<new>*" -name "*.jar" | head -1   # proves it compiled against <new>
```

## 6. Smoke test

Start the patched server and run the smoke test (expects server + SynthRCON already running):

```bash
node tools/server/remote-server.js start synthtest-02 --wait   # or start-server.js locally
node tools/smoke/synthunits-smoke.js
```

After changing Gradle dependencies, the build+deploy+smoke variant:

```bash
node tools/smoke/synthunits-smoke.js --build --deploy
```

### Known risk areas — smoke-test these after every server update
- Plugin loading for all four mods.
- RCON health and command dispatch.
- NPC role registration/validation for `Synth_Base`.
- Chunk loader persistence and ticking state.
- World spawn provider / test-home anchor.
- Runtime validation: `spawn-basic`, `gatherer-basic`.

### Expected smoke results
- SynthRCON health returns `ok: true`.
- `/synth chunk list` succeeds and reports the persisted loader.
- `/synth testhome show` succeeds and reports the saved anchor.
- `/validate spawn-basic` passes.
- `/validate gatherer-basic` passes.

If `spawn-basic` or `gatherer-basic` fails with `target_chunk_not_loaded`, check the chunk
loader first. If it reports `kept` nonzero but `loaded=0`, the chunk ticking behavior likely
changed.

---

## What must stay in sync
- Hytale launcher/server install used by `tools/server/start-server.js`.
- `com.hypixel.hytale:Server:<version>` in `build.gradle.kts` of overseer, kyn, rcon, terrascape.
- Each mod's `src/main/resources/manifest.json` `ServerVersion` range (only if compatibility requires).
- The assets TOC under `tools/assets/toc/` (commit one per release).
- Saved patch/release notes in `docs/`.
