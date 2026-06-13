# Reference Docs And Example Repos

`reference-repos.json` is the source of truth for external Hytale reference docs.

```bash
node tools/refs/reference-docs/sync-reference-repos.js --list
node tools/refs/reference-docs/sync-reference-repos.js --kind docs
```

Example Hytale mod source repos are managed separately by
`tools/refs/example-mods/sync-example-mod-repos.js` and live under
`./_mod-example-sourcecode/`.
