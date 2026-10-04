const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHarness() {
  const menus = [];
  const notices = [];
  const opened = [];
  class Base {}
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
  plugin.app = { workspace: {
    getActiveFile: () => null,
    async openLinkText(...args) { opened.push(args); },
  } };
  return { plugin, menus, notices, opened, ...Plugin.testApi };
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
  const { plugin, menus, opened } = loadHarness();
  const editor = editorFor('Unchanged');
  useEditor(plugin, editor);
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  plugin.showButtonContextMenu(event, '[[../Destination#Section]]');
  assert.equal(prevented, true);
  assert.equal(menus[0].event, event);
  assert.equal(menus[0].items[0].title, 'Open page');
  // Preserve the source path even if focus changes while the menu is open.
  plugin.getTargetMarkdownView = () => null;
  await menus[0].items[0].click();
  assert.deepEqual(opened, [['../Destination#Section', 'Folder/Source.md', false]]);
  assert.equal(editor.getValue(), 'Unchanged');
});

test('navigation works without an open note and invalid targets do not show a menu', async () => {
  const { plugin, menus, opened } = loadHarness();
  const event = { preventDefault() {} };
  plugin.showButtonContextMenu(event, '');
  assert.equal(menus.length, 0);
  plugin.showButtonContextMenu(event, 'Projects/Work#^block');
  await menus[0].items[0].click();
  assert.deepEqual(opened, [['Projects/Work#^block', '', false]]);
});

test('navigation failures show a notice instead of an unhandled rejection', async () => {
  const { plugin, notices } = loadHarness();
  plugin.app.workspace.openLinkText = async () => { throw new Error('Unavailable'); };
  await plugin.openButtonPage('Page', '');
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
  const view = new LinkButtonSidebarView(null, plugin);
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
