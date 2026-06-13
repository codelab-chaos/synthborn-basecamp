# Label tools

Extract and query Hytale **en-US display names** from `_Assets/Server/Languages/en-US/server.lang`.

See the full guide: [`docs/refs/labels/README.md`](../../../docs/refs/labels/README.md)

## Extract

```bash
node tools/refs/labels/extract-labels.js
node tools/refs/labels/extract-labels.js --assets /path/to/_Assets --out docs/refs/labels
```

Writes `docs/refs/labels/labels.json` and `docs/refs/labels/labels.txt`.

## Lookup

```bash
node tools/refs/labels/lookup.js id Ingredient_Fibre
node tools/refs/labels/lookup.js name "copper sword"
node tools/refs/labels/lookup.js find copper
node tools/refs/labels/lookup.js find copper --json
```

Run extract first if `labels.json` is missing or stale.
