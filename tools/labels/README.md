# Label tools

Extract and query Hytale **en-US display names** from `_Assets/Server/Languages/en-US/server.lang`.

See the full guide: [`docs/labels/README.md`](../../docs/labels/README.md)

## Extract

```bash
node tools/labels/extract-labels.js
node tools/labels/extract-labels.js --assets /path/to/_Assets --out docs/labels
```

Writes `docs/labels/labels.json` and `docs/labels/labels.txt`.

## Lookup

```bash
node tools/labels/lookup.js id Ingredient_Fibre
node tools/labels/lookup.js name "copper sword"
node tools/labels/lookup.js find copper
node tools/labels/lookup.js find copper --json
```

Run extract first if `labels.json` is missing or stale.
