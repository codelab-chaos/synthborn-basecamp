# Hytale Server SDK reference

Offline `javap` signatures for the pinned `com.hypixel.hytale:Server` jar. Output lives in
[`docs/sdk/`](../../../docs/sdk/) — one markdown file per package plus search indexes.

Requires JDK on `PATH` (`jar`, `javap`) and `unzip`. No `npm install`.

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

Start with the Basecamp release planner. It checks the jar hash and reports changed
class bytecode before any disassembly:

```bash
cd tools
npm run update:plan
```

```bash
# from synthborn-basecamp repo root

# 1. Pull the pinned jar into the local Gradle cache (any mod repo works)
cd ../synthborn-kyn && ./gradlew compileJava
cd ../synthborn-basecamp

# 2. Preview and refresh incrementally
node tools/refs/sdk/extract-sdk-reference.js --full --plan
node tools/refs/sdk/extract-sdk-reference.js --full

# 3. Review API changes vs last commit
node tools/refs/sdk/diff-sdk-reference.js
```

The deterministic incremental pipeline compares each selected class entry's ZIP CRC-32
and uncompressed size with a local signature cache. Only new/changed classes go to
`javap -protected`, in batches of 50 classes per JVM. Their normalized signatures are
merged with unchanged cached signatures; only package Markdown with different content
is written. Full mode also deletes obsolete generated package files. Method bodies can
change without changing a public signature, so preflight counts are conservative.

`--plan` is read-only; `--json` emits the class lists for tooling. Neither disassembles
classes or creates output files. The release planner includes these counts automatically.

The disposable `docs/sdk/.sdk-cache.json` is gitignored. A first run, corrupt/missing
cache, changed extractor, changed JDK/javap version, or `--force` triggers a batched cold
inspection. The cache is an optimization, not the source of truth. Missing/edited package
Markdown is repaired from the signatures on the next extraction. Custom `--out` runs
keep app data in that output directory instead of touching the main SDK Explorer.

Indexes and version metadata are regenerated cheaply after extraction. They may change
when package Markdown does not. The new version is passed explicitly to the app builder
so new API data cannot accidentally carry the previous source version.

The extractor reads the jar version pinned in sibling mod repos (via
[`tools/lib/workspace.js`](../../lib/workspace.js)) and picks the matching file from
`~/.gradle/caches/modules-2/files-2.1/com.hypixel.hytale/Server/<version>/`.

### What to expect

| Step | Output |
|------|--------|
| Jar resolved | `JAR: .../Server-<version>.jar` and `Version: <version>` |
| Full mode | `Mode: --full (auto-discovered ~915 packages)` |
| Done | `Wrote 915 package file(s)`, `llms.txt`, `methods.json` / `methods.txt` |
| App data | `apps/sdk-explorer/data/sdk-reference.json` updated for the static SDK Explorer |
| Stamp | `docs/sdk/.sdk-source.json` updated with jar fingerprint |

### Skip / force

With a warm cache and unchanged class bytes, no classes are disassembled and no unchanged
package Markdown is rewritten. `--force` bypasses signature reuse; use it to independently
verify a refresh. Extraction fails before publishing files if a javap batch fails.

```bash
node tools/refs/sdk/extract-sdk-reference.js --full --plan
node tools/refs/sdk/extract-sdk-reference.js --full --json
node --test tools/refs/sdk/tests/incremental-sdk.test.js
```

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
HYTALE_SERVER_JAR=/path/to/Server-<version>.jar node tools/refs/sdk/extract-sdk-reference.js --full

# diff against another git ref or directory
node tools/refs/sdk/diff-sdk-reference.js --against main
node tools/refs/sdk/diff-sdk-reference.js --against /path/to/old-sdk-reference
```

## Pitfalls

- **This signature view does not include deprecation metadata.** `javap -protected` does
  not emit annotation details; `javap -v` can expose them. Compile the mods with
  deprecation/removal lint to audit actual use. This optimization preserves the existing
  top-level-type coverage and exclusions; it does not add nested types or usage guidance.
- **Curated vs full:** the default (no `--full`) writes far fewer packages. If you commit SDK
  docs, always use `--full` so counts stay near 915.
- **Version drift:** if extraction reports an older version than the mods pin, run
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
