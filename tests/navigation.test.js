const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHarness() {
  const menus = [];
  const notices = [];
  const opened = [];
  class Base { constructor(leaf) { this.leaf = leaf; } }
  class Menu {
    constructor() { this.items = []; menus.push(this); }
    addItem(callback) {
      const item = {
        setTitle(value) { this.title = value; return this; },
        setIcon(value) { this.icon = value; return this; },
        onClick(callback) { this.click = callback; return this; },
      };
      callback(item);
      this.items.push(item);
    }
    showAtMouseEvent(event) { this.event = event; }
  }
  const sourcePath = path.join(__dirname, '..', 'main.js');
  const context = {
    module: { exports: {} },
    console: { error() {} },
    require(id) {
      assert.equal(id, 'obsidian');
      return {
        Plugin: Base, ItemView: Base, MarkdownView: Base, PluginSettingTab: Base, Modal: Base,
        Menu, Notice: class { constructor(message) { notices.push(message); } },
        moment: { locale: () => 'en' },
      };
    },
  };
  vm.runInNewContext(`${fs.readFileSync(sourcePath, 'utf8')}\nmodule.exports.testApi = { normalizeSettings, LinkButtonSidebarView };`, context);
  const Plugin = context.module.exports;
  const plugin = new Plugin();
  plugin.settings = Plugin.testApi.normalizeSettings(null).settings;
  plugin.getTargetMarkdownView = () => null;
  plugin.refreshViewsDebounced = () => {};
  const container = {};
  const anchor = { view: { file: null }, container };
  const activations = [];
  plugin.app = { workspace: {
    getMostRecentLeaf(root) { assert.equal(root, container); return anchor; },
    setActiveLeaf(leaf, options) { activations.push({ leaf, options }); },
    async openLinkText(...args) { opened.push(args); },
  } };
  return { plugin, menus, notices, opened, container, anchor, activations, ...Plugin.testApi };
}

function editorFor(text, start = text.length, end = start) {
  let content = text;
  let cursor = start;
  const toPosition = (offset) => {
    const lines = content.slice(0, offset).split('\n');
    return { line: lines.length - 1, ch: lines.at(-1).length };
  };
  const toOffset = (position) => content.split('\n').slice(0, position.line).reduce((n, line) => n + line.length + 1, 0) + position.ch;
  const replace = (value, from, to = from) => {
    content = content.slice(0, from) + value + content.slice(to);
    cursor = from + value.length;
    start = end = cursor;
  };
  return {
    getCursor: (which) => toPosition(which === 'to' ? end : start),
    getSelection: () => content.slice(start, end),
    getLine: (line) => content.split('\n')[line],
    lastLine: () => content.split('\n').length - 1,
    getRange: (from, to) => content.slice(toOffset(from), toOffset(to)),
    posToOffset: toOffset,
    offsetToPos: toPosition,
    setCursor(position) { cursor = toOffset(position); start = end = cursor; },
    replaceSelection(value) { replace(value, start, end); },
    replaceRange(value, position) { replace(value, toOffset(position)); },
    focus() { this.focused = true; },
    getValue: () => content,
    cursorOffset: () => cursor,
  };
}

function useEditor(plugin, editor) {
  plugin.getTargetMarkdownView = () => ({ editor, file: { path: 'Folder/Source.md' } });
}

test('context menu opens the Page target relative to the source note without insertion', async () => {
  const { plugin, menus, opened, container, anchor, activations } = loadHarness();
  const editor = editorFor('Unchanged');
  useEditor(plugin, editor);
  anchor.view.file = { path: 'Folder/Source.md' };
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  plugin.showButtonContextMenu(event, '[[../Destination#Section]]', container);
  assert.equal(prevented, true);
  assert.equal(menus[0].event, event);
  assert.equal(menus[0].items[0].title, 'Open page in new tab');
  // Preserve the source path even if focus changes while the menu is open.
  plugin.getTargetMarkdownView = () => null;
  anchor.view.file = { path: 'Changed/Source.md' };
  await menus[0].items[0].click();
  assert.deepEqual(JSON.parse(JSON.stringify(opened)), [['../Destination#Section', 'Folder/Source.md', 'tab', { active: true }]]);
  assert.equal(activations[0].leaf, anchor);
  assert.equal(activations[0].options.focus, false);
  assert.equal(editor.getValue(), 'Unchanged');
});

test('navigation works without an open note and invalid targets do not show a menu', async () => {
  const { plugin, menus, opened, container } = loadHarness();
  const event = { preventDefault() {} };
  plugin.showButtonContextMenu(event, '', container);
  assert.equal(menus.length, 0);
  plugin.showButtonContextMenu(event, 'Projects/Work#^block', container);
  await menus[0].items[0].click();
  assert.deepEqual(JSON.parse(JSON.stringify(opened)), [['Projects/Work#^block', '', 'tab', { active: true }]]);
});

test('navigation failures show a notice instead of an unhandled rejection', async () => {
  const { plugin, notices, container } = loadHarness();
  plugin.app.workspace.openLinkText = async () => { throw new Error('Unavailable'); };
  await plugin.openButtonPage('Page', '', container);
  assert.deepEqual(notices, ['Could not open the linked page.']);
});

test('sidebar binds right click and keeps navigation available without an insertion note', () => {
  const { plugin, LinkButtonSidebarView } = loadHarness();
  function element() {
    return {
      children: [], listeners: {}, style: { setProperty() {} },
      empty() { this.children = []; }, addClass() {}, toggleClass() {}, setText() {}, setAttribute() {},
      createEl() { const child = element(); this.children.push(child); return child; },
      createDiv() { return this.createEl(); }, createSpan() { return this.createEl(); },
      addEventListener(event, callback) { this.listeners[event] = callback; },
    };
  }
  plugin.settings.groups = [{ name: 'Group', buttons: [{ label: 'Different label', page: 'Actual page', colorId: 'blue' }] }];
  const view = new LinkButtonSidebarView({ getContainer: () => ({}) }, plugin);
  view.contentEl = element();
  view.app = plugin.app;
  const calls = [];
  plugin.showButtonContextMenu = (event, page) => calls.push(page);
  plugin.insertLink = (page) => calls.push(page);
  view.render();
  const button = view.buttonEntries[0].button;
  assert.equal(button.disabled, false);
  button.listeners.contextmenu({});
  button.listeners.click();
  assert.deepEqual(calls, ['Actual page', 'Actual page']);
});

for (const windowName of ['main', 'additional']) {
  test(`new tabs stay in the ${windowName} window and preserve existing tabs`, async () => {
    const { plugin, menus, container, anchor } = loadHarness();
    container.name = windowName;
    anchor.view.file = { path: 'Folder/Source.md' };
    const tabs = [anchor];
    const otherWindowTab = { view: { file: { path: 'Other.md' } } };
    let active = otherWindowTab;
    plugin.app.workspace.setActiveLeaf = (leaf) => { active = leaf; };
    plugin.app.workspace.openLinkText = async (target, source, mode, options) => {
      assert.equal(active.container, container);
      assert.equal(mode, 'tab');
      assert.equal(source, 'Folder/Source.md');
      assert.equal(options.active, true);
      tabs.push({ target, container });
    };
    plugin.showButtonContextMenu({ preventDefault() {} }, 'Missing/Page#Heading', container);
    // A different window can take focus while the menu is open.
    for (let i = 0; i < 2; i++) {
      active = otherWindowTab;
      await menus[0].items[0].click();
    }
    assert.equal(tabs.length, 3);
    assert.equal(tabs[0], anchor);
    assert.equal(anchor.view.file.path, 'Folder/Source.md');
    assert.equal(otherWindowTab.view.file.path, 'Other.md');
    assert.notEqual(tabs[1], tabs[2]);
    assert.equal(tabs[1].target, 'Missing/Page#Heading');
  });
}

test('a closed originating window reports failure without opening in another window', async () => {
  const { plugin, menus, container, opened, notices } = loadHarness();
  plugin.showButtonContextMenu({ preventDefault() {} }, 'Page', container);
  plugin.app.workspace.getMostRecentLeaf = () => null;
  await menus[0].items[0].click();
  assert.equal(opened.length, 0);
  assert.deepEqual(notices, ['Could not open the linked page.']);
});

test('missing targets delegate to native link handling in a new tab', async () => {
  const { plugin, menus, container, anchor, opened } = loadHarness();
  anchor.view.file = { path: 'Folder/Source.md' };
  plugin.showButtonContextMenu({ preventDefault() {} }, 'Not created yet', container);
  await menus[0].items[0].click();
  assert.deepEqual(JSON.parse(JSON.stringify(opened)), [
    ['Not created yet', 'Folder/Source.md', 'tab', { active: true }],
  ]);
  assert.equal(anchor.view.file.path, 'Folder/Source.md');
});
