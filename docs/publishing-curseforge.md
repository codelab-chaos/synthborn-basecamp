# Publishing to CurseForge

Reference links for when we publish Synthborn mods to CurseForge — read these **before**
submitting so the upload passes moderation on the first try.

## References

- **Passing CurseForge moderation review** — what reviewers check and the common reasons
  uploads get rejected (file packaging, metadata, descriptions, licensing):
  <https://blog.curseforge.com/how-to-pass-moderation-review-on-curseforge-2/>

- **Hytale modding docs — Publishing to CurseForge** — the Hytale-specific publishing flow
  (project setup, manifest/metadata expectations, upload steps):
  <https://hytalemodding.dev/en/docs/publishing/curseforge>

## Notes

- Each deployable mod repo owns its own build/jar; this doc is the shared publishing reference.
- Cross-check the mod `manifest.json` (name, version, authors, description) against the
  moderation guidance before each release.
- File naming (Synthborn convention; neither guide above sets one): the jar carries the plain
  version only, for example `Terrascape-0.1.1.jar`. Prerelease labels such as `beta.2` live on
  the git tag (`v0.1.1-beta.2`), the GitHub prerelease flag, the CurseForge release type
  (`beta`) and display name, and the release notes. Terrascape is the reference
  implementation (`build.gradle.kts` `fatJar`, `.github/workflows/release-candidate.yml`).
  Chaos Atlas agrees: its CurseForge service doc treats release channel as upload metadata,
  and its reader labels files by `displayName` (falling back to `fileName`) with the channel
  from `releaseType`, so the beta label still shows there with a plain jar name.
- Game version target: upload each file against the Hytale Update it was built for (for
  example `0.7`), never the "Early Access" wildcard. The mods use server internals, and those
  APIs change between Updates (0.6 to 0.7 removed the column accessors), so a wildcard
  promises compatibility the jar does not have. CurseForge now lists a version per Update, so
  target the latest one. The manifest `ServerVersion` minimum drives it: Terrascape's
  `publish-curseforge.yml` takes the major.minor of `ServerVersion` (`>=0.7.2` gives `0.7`)
  and fails with the list of available names if CurseForge has no match. Raise the manifest
  minimum with each Update migration so the target moves with it.
