# PEIQ release

The version lives in two files and both must match in the tagged commit:
`package.json` and `APP_VERSION` in `js/core/version.js`.

## Steps

1. Confirm the target version and that the user asked for a release.
2. Bump `package.json` and `js/core/version.js` in one commit. Do not touch `LICENSE`,
   the license fields, or the public name.
3. Update the release records in the same change:
   - plan §0 current state and the test count;
   - a new milestone block in `docs/history/milestones.md` §15 when a milestone closes;
   - a new checklist in `docs/history/releases.md` §17;
   - `docs/history/decisions.md` §18 only when a decision changed;
   - `README.md` only when the user asked for user-facing changes.
4. Run the full suite, not a subset:

   ```bash
   npm test
   ```

5. Commit with an imperative subject and a body explaining the release and its scope.
6. Tag that exact commit, locally:

   ```bash
   git tag -a v1.4.0 -m "PaletteExtractorAndImageQuantizer 1.4.0"
   git show v1.4.0:package.json
   git show v1.4.0:js/core/version.js
   git tag --list 'v*'
   ```

## Rules

- Never move, delete, or reuse a tag.
- Never push, publish, or create a release or PR.
- A commit that lacks either version update is not a release commit.
- Tags stay local; the plan's release checklist is the record.
