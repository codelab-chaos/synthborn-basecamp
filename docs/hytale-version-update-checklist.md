# Hytale Version Update Checklist

Use this when moving the workspace to a new Hytale server/client release or hotfix
(e.g. `0.5.3` → `0.5.4`).

The core routine is:

1. Shut everything down cleanly before patching.
2. Patch Hytale through the launcher and port the official patch notes.
3. Run the fast impact plan before starting any extractors.
4. Capture/sync assets and regenerate only the affected Basecamp references/apps.
5. Recompile and redeploy fresh jars against the new server API.
6. Smoke-test against the patched server.
7. Write the release worklog.

Do this for every patch the launcher applies, including hotfixes you do not otherwise act on.
The patch overwrites `Assets.zip`, so a skipped release loses its asset baseline and its
change trail. Steps 2 through 4 take about a minute when nothing relevant changed.

Do not treat "the old jars still load" as the full compatibility check. Loading proves only
manifest/runtime tolerance; **compiling** proves source compatibility, and **smoke testing**
proves the basic mod features still work.

> Machines: **macbookpro** (this Mac) and **windowsMSI** (the Windows PC). Build/deploy works
> on both; each deployable mod repo owns its deploy script. This basecamp checklist covers
> shared reference refreshes and points operational steps back to the owning repos.

The deployable Gradle mods and their deploy saves:

| Repo | Jar | Save |
|------|-----|------|
| `synthborn-overseer` | SynthOverseer | `overseer-test` |
| `synthborn-kyn` | SynthUnits | `synthtest-02` |
| `synthborn-terrascape` | Terrascape | `synth-worldview-mvp` |

(`synthborn-basecamp` has no Gradle build — it holds the shared tools and docs.)

---

## 1. Shut down before patching

The Hytale updater refuses to patch while game processes — or sometimes **any `java`
process** — are running. There are two distinct kinds of JVM to clear:

**a. Hytale game servers** (`HytaleServer.jar`, on the bundled JRE). Prefer the
owning deploy script's graceful stop path so worlds save:

Use each owning repo's deploy tool for graceful shutdown, for example:

```bash
( cd ../synthborn-kyn && node tools/deploy.js stop --force )
( cd ../synthborn-overseer && node tools/deploy.js stop --force )
( cd ../synthborn-terrascape && node tools/deploy.js stop --force )
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

3. Port the official notes so Basecamp keeps release notes for every game version. Hytale
   publishes one patch-notes post per Update and one rolling hotfix post per Update that
   gains a section for each `0.x.y` hotfix, so re-port the hotfix post after each hotfix:

```bash
cd synthborn-basecamp/tools
npm run notes:port -- https://hytale.com/news/<year>/<month>/update-<n>-patch-notes
npm run notes:port -- https://hytale.com/news/<year>/<month>/hotfixes-update-<n>
```

Then add the new version row(s) to `docs/patch-notes/README.md`. Read the "Before You Play"
and modder-facing sections before touching the mods; protocol bumps and asset schema changes
are announced there first.

## 3. Plan the update first

Run the read-only planner immediately after patching:

```bash
cd synthborn-basecamp/tools
npm run update:plan
```

This is the normal release convention. It reads the asset ZIP directory and hashes the
server jar, which is much faster than extracting assets or running `javap` across thousands
of classes. It reports:

- exact added, changed, and removed asset counts;
- which Basecamp references/apps consume those paths;
- whether the SDK jar actually changed;
- the commands that would be run.

Use `npm run update:plan -- --show-files` when the path list is useful. The previous TOC is
selected automatically; `--from-toc <file>` is available for an unusual baseline. On WSL,
the Windows launcher install is auto-detected. Set `HYTALE_GAME_LATEST` or pass `--game`
when Hytale lives somewhere else.

When the plan looks right:

```bash
npm run update:apply
```

`update:apply` incrementally syncs `_Assets`, captures the new TOC when needed, and runs
only affected Basecamp data/app pipelines. Full SDK signature extraction runs only when
the server jar fingerprint changed. `--force-sdk` is the simple escape hatch after changing
the extractor itself.

The planner intentionally does not edit sibling Gradle pins, deploy jars, or start servers;
those remain explicit mod-repository steps below.

The routing convention is deliberately small:

| Changed input | Updated consumer |
|---|---|
| English `server.lang` | Label index and NPC display metadata |
| `Server/NPC/**` | NPC catalog |
| Recipe, item, or drop JSON | Recipe/loot indexes, dependency trees, and Recipe Kiosk data |
| Bench item JSON | Bench tier index |
| Item/resource JSON or `Common/Icons/**` | Recipe Kiosk item-icon atlas |
| Prefab JSON or item JSON (which supplies block colors) | Prefab index, gallery packs, and preview atlases |
| Server jar SHA-256/version | Full SDK references and SDK Explorer data |
| Anything else | Recorded in the TOC and reported, but no unrelated app is rebuilt |

## 4. Capture the new assets

The patch overwrites `Assets.zip`, so capture the baseline **right after** updating. A
versioned, committable TOC (path · size · CRC-32 per file) is the change-detection trail —
`git diff assets-toc-<old>.json assets-toc-<new>.json` shows exactly what Hypixel changed:

```bash
cd synthborn-basecamp
node tools/refs/assets/build-assets-toc.js  # writes docs/refs/assets/toc/assets-toc-<version>.json
```

The normal `npm run update:apply` path performs this capture and sync. The commands below
are the manual fallback.

Refresh the unpacked reference (`_Assets/` is gitignored, ~3.3 GB). If `_Assets/` still
matches the last committed TOC, use the old TOC as the baseline so only added/changed files
are extracted and removed files are deleted:

```bash
node tools/refs/assets/sync-assets.js --dry-run --from-toc docs/refs/assets/toc/assets-toc-<old>.json
node tools/refs/assets/sync-assets.js           --from-toc docs/refs/assets/toc/assets-toc-<old>.json
```

If `_Assets/` may have local drift, omit `--from-toc`. That scans the existing directory and
computes local CRCs before deciding what to extract:

```bash
node tools/refs/assets/sync-assets.js --dry-run
node tools/refs/assets/sync-assets.js
```

> Note: the very first run establishes the baseline — you can only *diff* from the next
> update onward (and only if you captured the TOC before the next patch overwrote the zip).

## 5. Bump the server API version

First confirm the new version is actually published, or every build fails:

```bash
curl -s https://maven.hytale.com/release/com/hypixel/hytale/Server/maven-metadata.xml | grep -E "release|version"
```

Then bump the **exact** Gradle pin in each deployable mod (`compileOnly`, and
`testImplementation` where present):

```
com.hypixel.hytale:Server:<old>  ->  com.hypixel.hytale:Server:<new>
```

Manifest `ServerVersion` ranges usually do **not** need to change for a patch: a range like
`>=0.5.0 <0.6.0` already covers any `0.5.x`. Only narrow it if compatibility requires it.
A **minor** bump is different: `0.5.x` to `0.6.x` falls outside `<0.6.0`, so the old jars
will not load at all until the range is widened (for example `>=0.6.0 <0.7.0`).
Bumping the Gradle dependency is what gives compile-time API checks against the new jar.

## 6. Recompile and redeploy

Servers should be down (step 1). Build and deploy from each owning repo:

```bash
( cd ../synthborn-overseer   && node tools/deploy.js build )
( cd ../synthborn-kyn        && node tools/deploy.js build )
( cd ../synthborn-terrascape && node tools/deploy.js build )   # also runs webpack :buildWeb
```

Then use the repo-local deploy target you need, for example `node tools/deploy.js restart`
or `node tools/deploy.js --target combined restart`. Confirm the new artifact resolved:

```bash
find ~/.gradle/caches -path "*hytale*Server*<new>*" -name "*.jar" | head -1   # proves it compiled against <new>
```

## 7. Smoke test

Start the patched server and run smoke tests from the owning repo. For example:

```bash
( cd ../synthborn-kyn && node tools/deploy.js restart )
( cd ../synthborn-kyn && node tools/deploy.js rcon -- validate spawn-basic )
( cd ../synthborn-kyn && node tools/deploy.js rcon -- validate berry-harvest at <x,y,z> )
```

For the integration save:

```bash
( cd ../synthborn-kyn && node tools/deploy.js --target combined restart )
```

### Known risk areas — smoke-test these after every server update
- Plugin loading for all deployable mods.
- RCON health and command dispatch.
- NPC role registration/validation for `Synth_Base`.
- Chunk loader persistence and ticking state.
- World spawn provider / test-home anchor.
- Runtime validation: `spawn-basic` plus one currently registered quick mechanics scenario.
  As of 0.5.6, use `berry-harvest` for a resource primitive smoke; confirm available names with
  `validate list mechanics`.

### Expected smoke results
- RCON health returns `ok: true`.
- `/synth chunk list` succeeds and reports the persisted loader.
- `/synth testhome show` succeeds and reports the saved anchor.
- `/validate spawn-basic` passes.
- `/validate berry-harvest at <x,y,z>` passes.

If `spawn-basic` or the quick mechanics scenario fails with `target_chunk_not_loaded`, check the chunk
loader first. If it reports `kept` nonzero but `loaded=0`, the chunk ticking behavior likely
changed.

Note: `gatherer-basic` and `gathering-basics` are stale validator names in the current Kyn help text;
they are not registered scenarios in `RuntimeValidationRunner` as of the 0.5.6 update. The confirmed
arena live suites are useful deeper validation, but they can exceed the RCON command timeout and
should not be used as the default version-update smoke.

---

## What must stay in sync
- Hytale launcher/server install used by each owning repo's deploy script.
- `com.hypixel.hytale:Server:<version>` in `build.gradle.kts` of overseer, kyn, and terrascape.
- Each mod's `src/main/resources/manifest.json` `ServerVersion` range (only if compatibility requires).
- The assets TOC under `docs/refs/assets/toc/` (commit one per release, hotfixes included).
- Official patch notes under `docs/patch-notes/` and the version index in its README.
- A worklog per processed release: `docs/hytale-update-<version>-worklog.md`.
