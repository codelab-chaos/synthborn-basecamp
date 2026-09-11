# Hytale Patch Notes

Committed ports of the official hytale.com release posts, one folder for the whole
history so every game version Basecamp has processed has its notes next to its asset
TOC and worklog. Hytale publishes one patch-notes post per Update and one rolling
hotfix post per Update that gains a section for each `0.x.y` hotfix.

Port a new post with:

```bash
cd tools
npm run notes:port -- https://hytale.com/news/<year>/<month>/update-<n>-patch-notes
npm run notes:port -- https://hytale.com/news/<year>/<month>/hotfixes-update-<n>
```

Re-port the hotfix post after each hotfix, then add the version row below. The porter
needs `pandoc` on PATH; see
[`tools/refs/patch-notes/port-hytale-post.js`](../../tools/refs/patch-notes/port-hytale-post.js).

## Versions

| Version | Released | Notes | Basecamp trail |
|---|---|---|---|
| 0.6.5 | Sep 10, 2026 | [Hotfixes: Update 6](hytale-hotfixes-update-6.md#065) | [`assets-toc-0.6.5.json`](../refs/assets/toc/assets-toc-0.6.5.json), [worklog](../hytale-update-0.6.5-worklog.md) |
| 0.6.4 | Sep 7, 2026 | [Hotfixes: Update 6](hytale-hotfixes-update-6.md#064) | [`assets-toc-0.6.4.json`](../refs/assets/toc/assets-toc-0.6.4.json), [worklog](../hytale-update-0.6.4-worklog.md) |
| 0.6.3 | Aug 31, 2026 | [Hotfixes: Update 6](hytale-hotfixes-update-6.md#063) | not processed |
| 0.6.2 | Aug 27, 2026 | [Hotfixes: Update 6](hytale-hotfixes-update-6.md#062) | not processed |
| 0.6.1 | Aug 27, 2026 | [Update 6 Patch Notes](hytale-update-6-patch-notes.md), [Hotfixes: Update 6](hytale-hotfixes-update-6.md#061) | not processed |
| 0.5.9 | Aug 18, 2026 | no published notes found | not processed; installed on windowsMSI, no TOC captured |
| 0.5.8 | | no published notes found | not processed |
| 0.5.7 | Jul 22, 2026 | [Hotfixes: Update 5](hytale-hotfixes-update-5.md#057) | [`assets-toc-0.5.7.json`](../refs/assets/toc/assets-toc-0.5.7.json), [worklog](../hytale-update-0.5.7-worklog.md) |
| 0.5.6 | Jun 17, 2026 | [Hotfixes: Update 5](hytale-hotfixes-update-5.md#056) | [`assets-toc-0.5.6.json`](../refs/assets/toc/assets-toc-0.5.6.json), [worklog](../hytale-update-0.5.6-worklog.md) |
| 0.5.5 | Jun 16, 2026 | [Hotfixes: Update 5](hytale-hotfixes-update-5.md#055) | not processed |
| 0.5.4 | Jun 5, 2026 | [Hotfixes: Update 5](hytale-hotfixes-update-5.md#054) | [`assets-toc-0.5.4.json`](../refs/assets/toc/assets-toc-0.5.4.json) |
| 0.5.3 | May 29, 2026 | [Hotfixes: Update 5](hytale-hotfixes-update-5.md#053) | not processed |
| 0.5.2 | May 27, 2026 | [Hotfixes: Update 5](hytale-hotfixes-update-5.md#052) | not processed |
| 0.5.1 | May 26, 2026 | [Update 5 Patch Notes](hytale-update-5-patch-notes.md), [Hotfixes: Update 5](hytale-hotfixes-update-5.md#051) | not processed |

Update 6 (0.6.1) also has a
[pre-release notes post](https://hytale.com/news/2026/5/pre-release-patch-notes-update-6)
that is not ported; the release post supersedes it. Earlier Updates 1 through 4 predate
Basecamp and are not ported.

## Where to look first after a release

- **Before You Play** at the top of an Update post: OpenGL, protocol, and rebuild notices.
- **Modder-Facing Changes**, **Asset Schemas & Formats**, **Renames & Deprecations**,
  **Protocol & Networking**, and **For Plugin Developers** sections: what the sibling mods
  must react to.
- **Hotfix roundup** for the exact `0.x.y` you installed: small but sometimes
  modder-facing (for example `ClientTool` and `ItemGrid` behavior in 0.6.4).
