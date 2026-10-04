# Releasing

The current version is **0.2.2**. These scripts do not submit or publish the community-directory entry.

## Local preflight

Use Node.js 22.13 or later and run:

```sh
npm ci --ignore-scripts
npm run build
```

The build runs lint and tests, verifies release metadata, and copies only `main.js`, `manifest.json`, and `styles.css` to `release/<version>/`. It does not publish anything. No compilation is needed because `main.js` is the plain JavaScript source and distributable. Do not include `data.json`, development dependencies, or test files in the release assets.

Install these three files in a separate test vault at `.obsidian/plugins/link-button-sidebar/`, then check in real Obsidian:

- Open, close, reload, and disable the plugin; check for errors and orphaned panels or popovers.
- Add and rename groups and buttons, edit a page target, select preset/custom colors, reorder within/between groups, delete and undo. Confirm the results survive a reload.
- Insert into the intended note, repeat a link, use selected text as an alias, and try a Markdown table. Confirm insertion is disabled when no target note is available.
- Check light/dark themes and wide/narrow settings. On a real phone, test group expansion, deletion, color selection, and drag-and-drop.
- Check settings migration using a copy of an older configuration. Keep the original vault and settings intact.

Automated checks do not replace desktop and mobile smoke tests. Verify the declared minimum Obsidian version before publishing; raise it if compatibility cannot be confirmed.

## Publish and submit

1. Put the reviewed source in a public GitHub repository. Keep `README.md`, `LICENSE`, `manifest.json`, `main.js`, and `styles.css` at its root.
2. Confirm the author details in `manifest.json`. Keep the version in `manifest.json`, `package.json`, and `versions.json` consistent.
3. Tag the reviewed commit with the exact version from the manifest, without `v` (currently **`0.2.2`**). The release workflow validates the tag, builds and attests all three assets, and prepares a draft GitHub release. Review its notes and three individual assets, then publish the release. A source ZIP alone is insufficient. Verify each downloaded asset with `gh attestation verify <file> --repo DmiKud/obsidian-link-button-sidebar`.
4. Sign in to [Obsidian Community](https://community.obsidian.md), link your GitHub account, and use **Add a plugin**. The directory reads the manifest from the repository's default branch and verifies repository ownership.
5. Resolve any automated review errors and publish the directory entry when ready. Submission alone does not make the plugin installable.

Follow the current [official submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin); submission is through the community directory, not a pull request to `community-plugins.json`.

For later releases, update `manifest.json`, `package.json`, `versions.json`, and `CHANGELOG.md`; refresh the lockfile with `npm install --package-lock-only --ignore-scripts`. Repeat the checks and use the exact new `x.y.z` version as the tag. Users receive updates from GitHub releases after the initial directory listing is approved.
