# Hytale Version Update Checklist

Use this when moving the workspace to a new Hytale server/client hotfix, such as `0.5.1`.

The core routine is:

1. Compile and deploy fresh jars against the new server API.
2. Run the smoke test against the patched server.

Do not treat "the old jars still load" as the full compatibility check. Loading proves only manifest/runtime tolerance; compiling proves source compatibility, and smoke testing proves the basic mod features still work.

## What Must Stay In Sync

Update these together:

- Hytale launcher/server install used by `tools/server/start-server.js`.
- `mods/SynthNPCs/build.gradle.kts` dependency:
  - `compileOnly("com.hypixel.hytale:Server:<version>")`
- `mods/SynthRCON/build.gradle.kts` dependency:
  - `compileOnly("com.hypixel.hytale:Server:<version>")`
- Each mod manifest compatibility range:
  - `mods/SynthNPCs/src/main/resources/manifest.json`
  - `mods/SynthRCON/src/main/resources/manifest.json`
- Saved patch notes or release notes in root `docs/`.

The manifest `ServerVersion` range does not always need to narrow for a patch release. If the server remains API-compatible, a range such as `>=0.5.0 <0.6.0` can be fine. The Gradle dependency should still be bumped when we want compile-time API checks against the new server jar.

## Known Risk Areas

Smoke-test these after every server update:

- Plugin loading for both `SynthNPCs` and `SynthRCON`.
- RCON health and command dispatch.
- NPC role registration/validation for `Synth_Base`.
- Chunk loader persistence and ticking state.
- World spawn provider / test-home anchor.
- Runtime validation:
  - `spawn-basic`
  - `gatherer-basic`

## Manual Update Steps

1. Patch Hytale through the launcher or install flow.
2. Confirm `tools/server/start-server.js` resolves the intended install branch/version.
3. Update Gradle `com.hypixel.hytale:Server:<version>` in both mods.
4. Update manifest `ServerVersion` ranges only if compatibility requires it.
5. Compile and deploy both mods:

```powershell
cd mods/SynthRCON
.\gradlew.bat build
.\gradlew.bat deploy

cd ..\SynthNPCs
.\gradlew.bat build
.\gradlew.bat deploy

cd ..\..
```

6. Start the patched server:

```powershell
node tools/server/start-server.js --background --save "C:\Users\ccnef\AppData\Roaming\Hytale\UserData\Saves\synthtest-02"
```

7. Run the smoke test:

```powershell
node tools/smoke/synthnpcs-smoke.js
```

The smoke test expects the server and SynthRCON to already be running. If it fails at `RCON health` with a connection-refused error, start the server first:

```powershell
node tools/server/start-server.js --background --save "C:\Users\ccnef\AppData\Roaming\Hytale\UserData\Saves\synthtest-02"
```

Use this variant after changing Gradle dependencies:

```powershell
node tools/smoke/synthnpcs-smoke.js --build --deploy
```

## Expected Smoke Results

The smoke test should confirm:

- SynthRCON health returns `ok: true`.
- `/synth chunk list` succeeds and reports the persisted loader.
- `/synth testhome show` succeeds and reports the saved anchor.
- `/validate spawn-basic` passes.
- `/validate gatherer-basic` passes.

If `spawn-basic` or `gatherer-basic` fails with `target_chunk_not_loaded`, check the chunk loader first. If the chunk loader says `kept` is nonzero but `loaded=0`, the chunk ticking behavior likely changed.
