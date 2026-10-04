# Changelog

## 0.2.2

### Added

- Right-click a sidebar button to open its linked note in a new tab in the same Obsidian window.

### Fixed

- Insert links with a single newline instead of adding an extra blank line.

## 0.2.1

### Fixed

- Removed redundant CSS clipping while preserving accessible field labels.
- Moved group-header color mixing into a feature query, keeping the fallback for older browsers without duplicate background declarations.

### Changed

- Added a production `build` command for Obsidian's automated build verification.
- Added GitHub artifact attestations for all three release assets.
- Plugin behavior and settings layouts are unchanged.

## 0.2.0 — release candidate

### Added

- Separate button labels and wiki-link targets, configurable groups, and movement within or between groups.
- Drag-and-drop and group arrow controls.
- A color popover with 12 presets and custom HEX colors.
- Compact settings and a collapsible mobile group overview.
- Current-note mention counts that allow repeated links, selected-text aliases, and insertion options.
- Deletion confirmation, undo, and migration of older settings.
- MIT licensing, automated checks, and reproducible release packaging.

### Fixed

- Settings scroll and focus restoration after reordering.
- Color-picker clipping and alignment across responsive settings layouts.
- Link insertion and counting around selections, Markdown tables, and code.
- Quadratic work when counting links in long indented blocks; unchanged note content now reuses its counts.
- Counting inside Obsidian comments and matching distinct case-sensitive file paths.
- Overlapping deletion undo losing buttons.
- Accidental saving after settings-read failures, popup cleanup, and sidebar layout preservation on unload.
- Deletion notifications showing `[object DocumentFragment]` in separate settings windows; undo notifications now sit at the bottom with safe-area/keyboard spacing and a right-aligned action.

### Changed

- Button rows now show a delete button at every width without an additional action menu. Label and Page layouts are unchanged.
- Removed redundant settings CSS and added keyboard focus indicators.
- Shortened the internal open-panel command ID to `open-sidebar`; development-build hotkeys need reassignment.
