# Hytale Server SDK reference

Offline `javap` signatures for the pinned `com.hypixel.hytale:Server` jar. Output lives in
[`docs/sdk/`](../../../docs/sdk/) — one markdown file per package plus search indexes.

Requires JDK on `PATH` (`jar`, `javap`). No `npm install`.

## Quick search

```bash
node tools/refs/sdk/sdk-search.js BlockPlaceUtils
node tools/refs/sdk/sdk-search.js --method placeBlock
node tools/refs/sdk/sdk-search.js --package interaction
node tools/refs/sdk/sdk-search.js --extends JavaPlugin
node tools/refs/sdk/sdk-search.js --grep CompletableFuture
```

Or grep the generated indexes in `docs/sdk/`:

- `llms.txt` — classes by package
- `methods.txt` — tab-separated method → class → package → file

Topic entry points: [`docs/sdk/README.md`](../../../docs/sdk/README.md).

## Refresh after a version bump

When mod `build.gradle.kts` files pin a new `Server:X.Y.Z`, refresh the reference so research
docs and agents grep the right signatures.

```bash
# from synthborn-basecamp repo root

# 1. Pull the pinned jar into the local Gradle cache (any mod repo works)
cd ../synthborn-kyn && ./gradlew compileJava
cd ../synthborn-basecamp

# 2. Regenerate docs (slow — ~15–30 min for --full)
node tools/refs/sdk/extract-sdk-reference.js --full

# 3. Review API changes vs last commit
node tools/refs/sdk/diff-sdk-reference.js
```

The extractor reads the jar version pinned in sibling mod repos (via
[`tools/lib/workspace.js`](../../lib/workspace.js)) and picks the matching file from
`~/.gradle/caches/modules-2/files-2.1/com.hypixel.hytale/Server/<version>/`.

### What to expect

| Step | Output |
|------|--------|
| Jar resolved | `JAR: .../Server-0.5.4.jar` and `Version: 0.5.4` |
| Full mode | `Mode: --full (auto-discovered ~915 packages)` |
| Done | `Wrote 915 package file(s)`, `llms.txt`, `methods.json` / `methods.txt` |
| App data | `apps/sdk-explorer/data/sdk-reference.json` updated for the static SDK Explorer |
| Stamp | `docs/sdk/.sdk-source.json` updated with jar fingerprint |

### Skip / force

Re-running with the **same** jar fingerprint is a no-op:

```
Up to date: already extracted from this jar … Pass --force to re-extract.
```

Use `--force` only when you changed the extractor script or package allowlist and need to
rewrite files without a new jar.

### Modes

| Flag | Packages | When to use |
|------|----------|-------------|
| *(default)* | ~60 curated packages | Fast spot-check of mod-facing APIs |
| `--full` | ~915 auto-discovered | **Default for repo commits** — matches current `docs/sdk/` |

### Rebuild indexes only (fast)

```bash
node tools/refs/sdk/build-sdk-llms-txt.js
node tools/refs/sdk/build-sdk-method-index.js
node tools/refs/sdk/build-sdk-app-data.js
```

### Overrides

```bash
# explicit jar (bypasses Gradle cache lookup)
HYTALE_SERVER_JAR=/path/to/Server-0.5.4.jar node tools/refs/sdk/extract-sdk-reference.js --full

# diff against another git ref or directory
node tools/refs/sdk/diff-sdk-reference.js --against main
node tools/refs/sdk/diff-sdk-reference.js --against /path/to/old-sdk-reference
```

## Pitfalls

- **Deprecations are invisible to `javap`.** Signature-stable `[removal]` warnings only show up
  in `./gradlew compileJava` after a version bump. Re-extracting does not surface them.
- **Curated vs full:** the default (no `--full`) writes far fewer packages. If you commit SDK
  docs, always use `--full` so counts stay near 915.
- **Version drift:** if extraction reports `0.5.3` while mods pin `0.5.4`, run
  `./gradlew compileJava` in a mod repo first to populate the cache.

## Scripts

| Script | Purpose |
|--------|---------|
| [`extract-sdk-reference.js`](extract-sdk-reference.js) | Main extractor — jar → per-package `.md` + indexes |
| [`build-sdk-llms-txt.js`](build-sdk-llms-txt.js) | Rebuild `llms.txt` from existing package files |
| [`build-sdk-method-index.js`](build-sdk-method-index.js) | Rebuild `methods.json` + `methods.txt` |
| [`build-sdk-app-data.js`](build-sdk-app-data.js) | Rebuild `apps/sdk-explorer/data/sdk-reference.json` |
| [`sdk-search.js`](sdk-search.js) | CLI search by class, method, package, extends, grep |
| [`diff-sdk-reference.js`](diff-sdk-reference.js) | Summarize package/class/method changes vs git ref |
| [`list-hytale-server-api.js`](list-hytale-server-api.js) | List class names in a package from the Hytale Server jar |
