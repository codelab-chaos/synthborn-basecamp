# Example Mod Source Repos

`example-mod-repos.json` drives the local example source-code cache in
`./_mod-example-sourcecode/`.

```bash
node tools/refs/example-mods/sync-example-mod-repos.js --list
node tools/refs/example-mods/sync-example-mod-repos.js
node tools/refs/example-mods/sync-example-mod-repos.js --only HyCitizens
node tools/refs/example-mods/sync-example-mod-repos.js --force
```

Entries with `url` are cloned or updated with Git. Entries without `url` are copied from
the legacy snapshot location at `../_references/example-sourcecode-mods/`. The target
folder is gitignored and excluded from VS Code Git/file watchers so nested repos do not
show up as basecamp work.
