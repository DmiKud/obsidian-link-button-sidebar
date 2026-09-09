const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClasses() {
  const sourcePath = path.join(__dirname, '..', 'main.js');
  const source = `${fs.readFileSync(sourcePath, 'utf8')}\n
    confirmAction = async () => true;
    module.exports.SettingTab = LinkButtonSidebarSettingTab;
  `;
  class ObsidianBase {
    constructor(app) { this.app = app; }
  }
  const context = {
    module: { exports: {} },
    require(id) {
      assert.equal(id, 'obsidian');
      return {
        Plugin: ObsidianBase,
        ItemView: ObsidianBase,
        MarkdownView: ObsidianBase,
        PluginSettingTab: ObsidianBase,
        Modal: ObsidianBase,
        Notice: ObsidianBase,
        moment: { locale: () => 'en' },
      };
    },
    console: { error() {} },
  };
  vm.runInNewContext(source, context, { filename: sourcePath });
  return { Plugin: context.module.exports, SettingTab: context.module.exports.SettingTab };
}

function createTab(groups) {
  const { SettingTab } = loadClasses();
  const plugin = { settings: { groups }, saveSettingsAndRefresh: async () => true };
  const tab = new SettingTab({}, plugin);
  const undos = [];
  tab.redisplayPreservingScroll = () => {};
  tab.showUndoNotice = (_message, undo) => undos.push(undo);
  return { tab, settings: plugin.settings, undos };
}

test('overlapping button and group undo restores all removed buttons', async () => {
  const { tab, settings, undos } = createTab([
    { id: 'group', name: 'Group', buttons: [{ id: 'a' }, { id: 'b' }] },
  ]);
  await tab.deleteButton('group', 'a');
  await tab.deleteGroup('group');
  await undos[0]();
  await undos[1]();

  assert.equal(settings.groups.length, 1);
  assert.equal(settings.groups[0].id, 'group');
  assert.deepEqual(new Set(settings.groups[0].buttons.map((button) => button.id)), new Set(['a', 'b']));
});

test('group undo preserves current edits and does not duplicate buttons restored elsewhere', async () => {
  const { tab, settings, undos } = createTab([
    { id: 'group', name: 'Group', buttons: [{ id: 'a' }, { id: 'b' }] },
    { id: 'other', name: 'Other', buttons: [] },
  ]);
  await tab.deleteGroup('group');
  settings.groups.push({ id: 'group', name: 'Renamed', buttons: [{ id: 'new' }] });
  settings.groups[0].buttons.push({ id: 'a' });
  await undos[0]();

  const restored = settings.groups.find((group) => group.id === 'group');
  assert.equal(restored.name, 'Renamed');
  assert.deepEqual(new Set(restored.buttons.map((button) => button.id)), new Set(['new', 'b']));
  const allIds = settings.groups.flatMap((group) => group.buttons.map((button) => button.id));
  assert.equal(allIds.length, new Set(allIds).size);
  assert.deepEqual(settings.groups[0].buttons.map((button) => button.id), ['a']);
});

test('a failed settings read prevents later saves from replacing the unread data', async () => {
  const { Plugin } = loadClasses();
  const plugin = new Plugin({});
  plugin.saveQueue = Promise.resolve();
  plugin.loadData = async () => { throw new Error('Unreadable data.json'); };
  let writes = 0;
  plugin.saveData = async () => { writes += 1; };

  await plugin.loadSettings();
  await plugin.enqueueSettingsSave();
  assert.equal(writes, 0);
});

function createNoticeDocument() {
  const timers = new Map();
  const listeners = new Map();
  let nextTimer = 0;
  const eventTarget = (prefix) => ({
    addEventListener(name, callback) { listeners.set(`${prefix}:${name}`, callback); },
    removeEventListener(name) { listeners.delete(`${prefix}:${name}`); },
  });
  const document = {
    defaultView: {
      ...eventTarget('window'),
      innerHeight: 800,
      visualViewport: { ...eventTarget('viewport'), height: 500, offsetTop: 0 },
      setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  };
  const element = (tag, options = {}, parent = null) => {
    const node = {
      tag, parent, children: [], listeners: {},
      className: options.cls || '', textContent: options.text || '', attributes: options.attr || {},
      style: { values: {}, setProperty(name, value) { this.values[name] = value; } },
      createDiv(options) { return element('div', options, this); },
      createSpan(options) { return element('span', options, this); },
      createEl(tag, options) { return element(tag, options, this); },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      remove() { if (parent) parent.children = parent.children.filter((child) => child !== this); },
    };
    if (parent) parent.children.push(node);
    return node;
  };
  document.body = element('body');
  return { document, timers, listeners };
}

test('undo notifications use text in the settings document, not a cross-window fragment', () => {
  const { tab } = createTab([]);
  delete tab.showUndoNotice;
  const { document, timers, listeners } = createNoticeDocument();
  tab.containerEl = { ownerDocument: document };
  tab.showUndoNotice('Button deleted.', () => {});
  const host = document.body.children[0];
  const [message, action] = host.children[0].children;
  assert.equal(message.textContent, 'Button deleted.');
  assert.equal(message.attributes.role, 'status');
  assert.equal(action.textContent, 'Undo');
  assert.equal(host.style.values['--link-button-sidebar-keyboard-inset'], '300px');
  document.defaultView.visualViewport.height = 800;
  listeners.get('viewport:resize')();
  assert.equal(host.style.values['--link-button-sidebar-keyboard-inset'], '0px');
  assert.equal(timers.size, 1);
  tab.closeUndoNotices();
  assert.equal(document.body.children.length, 0);
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0);
});

test('separate undo notifications expire independently and remove the host after the last one', () => {
  const { tab } = createTab([]);
  delete tab.showUndoNotice;
  const { document, timers, listeners } = createNoticeDocument();
  tab.containerEl = { ownerDocument: document };
  tab.showUndoNotice('First', () => {});
  tab.showUndoNotice('Second', () => {});
  const host = document.body.children[0];
  assert.equal(host.children.length, 2);
  [...timers.values()][0]();
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0].children[0].textContent, 'Second');
  [...timers.values()][0]();
  assert.equal(tab.undoNoticeHost, null);
  assert.equal(tab.undoNoticeCleanups.size, 0);
  assert.equal(listeners.size, 0);
});

test('undo executes once and cleans up even if the action rejects', async () => {
  const { tab } = createTab([]);
  delete tab.showUndoNotice;
  const { document, timers } = createNoticeDocument();
  tab.containerEl = { ownerDocument: document };
  let calls = 0;
  tab.showUndoNotice('Deleted', async () => { calls += 1; throw new Error('Test failure'); });
  const action = document.body.children[0].children[0].children[1];
  action.listeners.click();
  action.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(document.body.children.length, 0);
  assert.equal(timers.size, 0);
  tab.plugin.isUnloading = true;
  tab.showUndoNotice('Too late', () => {});
  assert.equal(document.body.children.length, 0);
});
