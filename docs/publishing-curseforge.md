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
