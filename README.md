# Link Button Sidebar

Link Button Sidebar is an Obsidian plugin for inserting frequently used wiki links from a compact sidebar. Buttons can have different display labels and page targets, live inside reorderable groups, and use colors from a theme-friendly palette.

The current version is 0.2.1. Manual installation is available from GitHub Releases; availability in Obsidian's community directory depends on the directory review and publication process.

## Features

- Separate **Label** and **Page** fields. A button labeled `Project` can insert `[[Projects/Current]]`.
- Reorder groups and buttons with drag-and-drop. Groups also have arrow controls.
- Move buttons between groups, add empty groups, and use groups as visual separators in the sidebar.
- Choose the button dot from a compact palette or enter a safe custom HEX color.
- Use a compact tablet layout and collapsible group overview on narrow mobile screens.
- See how many times each target is already mentioned in the current note. Repeated links are allowed and shown as a number; the button always remains an insertion action.
- Insert selected single-line text as an alias: selecting `the project` and pressing a button targeting `Projects/Current` produces `[[Projects/Current|the project]]`.
- Preserve multi-line selections and add surrounding spaces only where prose needs them.
- Disable insertion when no Markdown note is available, while showing the exact target note in the sidebar.
- Confirm destructive group resets/deletions and offer **Undo** after a deletion.

## Install manually

1. Create `.obsidian/plugins/link-button-sidebar/` inside your vault.
2. Copy `manifest.json`, `main.js`, and `styles.css` into that folder.
3. Reload Obsidian.
4. Open **Settings → Community plugins** and enable **Link Button Sidebar**.
5. Open the panel from the ribbon or run **Link Button Sidebar: Open sidebar** from the command palette.

## Configure buttons and groups

Open **Settings → Community plugins → Link Button Sidebar**.

Each button is shown as a compact row with its color dot, **Label**, **Page**, and delete action. Select the color dot to open the color menu:

- **Label** is the text visible on the button. Leave it empty to display the page target.
- **Page** is the wiki-link destination. The field displays wiki-link brackets around the editable value; `Projects/Current`, `Project#Next actions`, and pasted `[[Project]]` values are accepted and normalized.
- **Dot color** selects one of 12 palette colors or a custom `#RRGGBB` value.

Drag a group by its grip and a button by its color dot. Dropping a button on another group moves it there. On phones, groups collapse into an overview; open a group to edit its buttons and use the grip or color dot to drag them. A delete button is always visible beside each editable button row at every screen width; there is no additional action menu. General insertion options are available in the collapsed **Behavior** section below the groups.

Buttons with identical page targets are valid. Each one inserts another link when clicked, and all matching buttons show the same current-note mention count.

## Insertion behavior

The plugin inserts into the active Markdown note, or the most recently focused Markdown note when the sidebar itself has focus. It does not fall back to an unrelated open note. The current destination is displayed above the groups.

With **Use selected text as link alias** enabled:

- A single-line selection is replaced with `[[Page|selection]]`.
- A multi-line selection is left intact and the link is inserted before it.

Inside Markdown tables, the alias separator is escaped automatically so inserting a link does not split the table cell.

With **Add a trailing space when needed** enabled, a space is inserted at the end of a line or before regular text, but not before punctuation or existing whitespace.

Mention counts include normal wiki links, aliases, embeds, relative targets resolved by Obsidian, and links to headings on the configured page. Links inside fenced code, inline code, HTML comments, Obsidian `%%` comments, and indented code blocks are ignored. Markdown-style `[text](target)` links are not counted.

### Line break after a link

Enable **Start a new line after a link** in Settings → Link Button Sidebar → **Behavior** to move the cursor to the next line without adding a blank line. The option defaults off, overrides trailing spaces, and reuses one existing line break. Existing blank lines and following text are preserved. Markdown tables keep their inline behavior.

## Updating from 0.1.x

Existing flat button settings are migrated automatically. Button labels, page targets, group order, duplicate buttons, and recognized colors are preserved. Valid legacy HEX colors that do not match the palette are preserved as custom colors; invalid CSS values fall back to **Accent**.

## Troubleshooting

- If every button is disabled, open or focus a Markdown note and check the target shown at the top of the sidebar.
- If a button is marked invalid, correct its **Page** value in settings.
- If the panel is hidden, run **Link Button Sidebar: Open sidebar** from the command palette.
- If settings cannot be read, editing and saving are blocked to protect the original `data.json`. Try reloading the plugin first; if the error persists, restore that file from a backup.
- If you assigned a hotkey in a development build, reassign it to **Open sidebar** after this update: its internal command ID is now `open-sidebar`.

## Privacy and compatibility

The plugin makes no network requests, collects no telemetry, and requires no account or payment. It stores its configuration in the vault's plugin `data.json` using Obsidian's API, reads the active editor for mention counts, and changes note text only when you select an insertion button. It does not access files outside the vault or install anything at runtime.

The manifest declares Obsidian 1.4.0 or later and allows mobile use. Desktop/mobile release testing is described in [RELEASING.md](RELEASING.md). Button reordering uses native drag-and-drop; check touch support on the target device. The custom settings editor uses the older, supported settings API; individual controls are not indexed by the newer global settings search.

## Development

`main.js` is both the readable source and the distributable entry point; no compilation or bundler is needed. The plugin has no runtime dependencies other than Obsidian.

Use Node.js 22.13+ and install development-only lint tools:

```sh
npm ci --ignore-scripts
npm run validate
npm run package
```

`validate` runs ESLint, including the official Obsidian rules for JavaScript, and the regression tests. `package` also validates the metadata and copies exactly three release files to `release/<version>/`. `npm run build` is the production entry point for the same pipeline; the plugin uses plain JavaScript and needs no compilation. Tests alone remain dependency-free:

```sh
npm test
```

ESLint 9 is pinned to the compatible peer range of the official Obsidian validator's dependencies. npm currently warns that this major version is out of support; upgrade the validator and lint stack together when their peer ranges allow it. These tools are not included in the plugin release.

GitHub Actions runs the checks on Linux and Windows. An exact version tag prepares a **draft**, not a published release. See [RELEASING.md](RELEASING.md) for the real-device checklist and community submission steps, and [CHANGELOG.md](CHANGELOG.md) for changes.

## License

This project is available under the [MIT License](LICENSE).
