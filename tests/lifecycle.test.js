const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function eventSource() {
  const listeners = new Map();
  return {
    on(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
      return { source: this, name, callback };
    },
    offref(ref) { listeners.get(ref.name).delete(ref.callback); },
    emit(name) { for (const callback of listeners.get(name) || []) callback(); },
    listenerCount() { return [...listeners.values()].reduce((total, callbacks) => total + callbacks.size, 0); },
  };
}

async function loadPlugin() {
  const sourcePath = path.join(__dirname, '..', 'main.js');
  const debouncers = [];
  const writes = [];
  const resolutions = [];
  const layoutCallbacks = [];
  const leaves = [{ view: {} }];
  let detachCalls = 0;
  const app = {
    workspace: {
      ...eventSource(),
      onLayoutReady(callback) { layoutCallbacks.push(callback); },
      getLeavesOfType() { return leaves; },
      detachLeavesOfType() { detachCalls += 1; leaves.length = 0; },
    },
    metadataCache: {
      ...eventSource(),
      destination: 'Folder/Page.md',
      getFirstLinkpathDest(target, sourcePath) {
        resolutions.push({ target, sourcePath });
        return { path: this.destination };
      },
    },
  };
  class Base {
    constructor(app) { this.app = app; }
  }
  class PluginBase extends Base {
    constructor(app) { super(app); this.cleanups = []; this.tabs = []; }
    register(callback) { this.cleanups.push(callback); }
    registerEvent(ref) { this.register(() => ref.source.offref(ref)); }
    registerView() {}
    addRibbonIcon() {}
    addCommand() {}
    addSettingTab(tab) { this.tabs.push(tab); }
    async loadData() {
      return { settingsVersion: 3, insertSpaceAfterLink: true, newParagraphAfterLink: false, useSelectionAsAlias: true, openOnStartup: false, groups: [] };
    }
    async saveData(value) { writes.push(value); }
    unload() {
      this.onunload();
      for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
    }
  }
  const context = {
    module: { exports: {} },
    require(id) {
      assert.equal(id, 'obsidian');
      return {
        Plugin: PluginBase, ItemView: Base, MarkdownView: Base, PluginSettingTab: Base, Modal: Base, Notice: Base,
        moment: { locale: () => 'en' },
        parseLinktext(value) {
          const match = value.match(/^([^#^]*)([\s\S]*)$/);
          return { path: match[1], subpath: match[2] };
        },
        debounce() {
          const debounced = () => { debounced.pending = true; };
          debounced.cancel = () => { debounced.pending = false; };
          debounced.pending = false;
          debouncers.push(debounced);
          return debounced;
        },
      };
    },
    console,
  };
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  const plugin = new context.module.exports(app);
  await plugin.onload();
  return { plugin, app, debouncers, writes, resolutions, layoutCallbacks, leaves, detachCalls: () => detachCalls };
}

test('reuses counts only while both note content and source path are unchanged', async () => {
  const { plugin, resolutions } = await loadPlugin();
  const first = plugin.getLinkCounts('[[Page]]', 'Source.md');
  assert.equal(first.get('Folder/Page.md\u0000'), 1);
  assert.equal(plugin.getLinkCounts('[[Page]]', 'Source.md'), first);
  assert.equal(resolutions.length, 1);

  const edited = plugin.getLinkCounts('[[Page]] [[Page]]', 'Source.md');
  assert.notEqual(edited, first);
  assert.equal(edited.get('Folder/Page.md\u0000'), 2);
  const moved = plugin.getLinkCounts('[[Page]] [[Page]]', 'Other/Source.md');
  assert.notEqual(moved, edited);
  assert.equal(resolutions.length, 3);
  assert.equal(resolutions[2].sourcePath, 'Other/Source.md');
  plugin.unload();
});

test('metadata resolution events invalidate counts even when note text is unchanged', async () => {
  const { plugin, app, debouncers } = await loadPlugin();
  const first = plugin.getLinkCounts('[[Page]]', 'Source.md');
  app.metadataCache.destination = 'Moved/Page.md';
  app.metadataCache.emit('resolved');
  assert.equal(debouncers[0].pending, true);
  const updated = plugin.getLinkCounts('[[Page]]', 'Source.md');
  assert.notEqual(updated, first);
  assert.equal(updated.get('Moved/Page.md\u0000'), 1);
  assert.equal(updated.has('Folder/Page.md\u0000'), false);
  plugin.unload();
});

test('unload preserves workspace leaves, closes popovers, removes listeners, and flushes pending settings', async () => {
  const harness = await loadPlugin();
  const { plugin, app, debouncers, writes, leaves, layoutCallbacks } = harness;
  const originalLeaf = leaves[0];
  let removedPopovers = 0;
  let removedPopoverListeners = 0;
  const tab = plugin.tabs[0];
  tab.colorPopoverEl = { remove() { removedPopovers += 1; } };
  tab.colorPopoverCleanup = () => { removedPopoverListeners += 1; };
  plugin.settings.openOnStartup = true;
  plugin.settingsChanged(false);
  app.workspace.emit('editor-change');
  assert.equal(writes.length, 0);
  assert.equal(plugin.hasPendingSettingsSave, true);
  assert.equal(debouncers.every((debounced) => debounced.pending), true);

  plugin.unload();
  await plugin.saveQueue;
  assert.equal(harness.detachCalls(), 0);
  assert.equal(leaves.length, 1);
  assert.equal(leaves[0], originalLeaf);
  assert.equal(removedPopovers, 1);
  assert.equal(removedPopoverListeners, 1);
  assert.equal(app.workspace.listenerCount(), 0);
  assert.equal(app.metadataCache.listenerCount(), 0);
  assert.equal(debouncers.every((debounced) => !debounced.pending), true);
  assert.equal(plugin.hasPendingSettingsSave, false);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].openOnStartup, true);
  assert.equal(plugin.linkCountsCache, null);

  let reopened = false;
  plugin.activateView = () => { reopened = true; };
  for (const callback of layoutCallbacks) callback();
  assert.equal(reopened, false);
});
