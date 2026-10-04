const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHarness() {
  const notices = [];
  class Base {}
  const sourcePath = path.join(__dirname, '..', 'main.js');
  const context = {
    module: { exports: {} },
    console: { error() {} },
    require(id) {
      assert.equal(id, 'obsidian');
      return {
        Plugin: Base, ItemView: Base, MarkdownView: Base, PluginSettingTab: Base, Modal: Base,
        Notice: class { constructor(message) { notices.push(message); } },
        moment: { locale: () => 'en' },
      };
    },
  };
  vm.runInNewContext(`${fs.readFileSync(sourcePath, 'utf8')}\nmodule.exports.testApi = { normalizeSettings };`, context);
  const Plugin = context.module.exports;
  const plugin = new Plugin();
  plugin.settings = Plugin.testApi.normalizeSettings(null).settings;
  plugin.getTargetMarkdownView = () => null;
  plugin.refreshViewsDebounced = () => {};
  return { plugin, notices, ...Plugin.testApi };
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

test('newline preference defaults off and survives settings normalization', () => {
  const { normalizeSettings } = loadHarness();
  assert.equal(normalizeSettings(null).settings.newParagraphAfterLink, false);
  assert.equal(normalizeSettings({ groups: [] }).settings.newParagraphAfterLink, false);
  assert.equal(normalizeSettings({ groups: [], newParagraphAfterLink: 'true' }).settings.newParagraphAfterLink, false);
  const settings = normalizeSettings({ groups: [], newParagraphAfterLink: true }).settings;
  assert.equal(settings.newParagraphAfterLink, true);
  assert.equal(normalizeSettings(settings).changed, false);
  assert.equal(normalizeSettings({ ...settings, settingsVersion: 999 }).settings.newParagraphAfterLink, true);
});

test('line insertion moves the cursor down exactly once and overrides spaces', async () => {
  const { plugin } = loadHarness();
  plugin.settings.newParagraphAfterLink = true;
  for (const trailingSpace of [true, false]) {
    plugin.settings.insertSpaceAfterLink = trailingSpace;
    const editor = editorFor('Text');
    useEditor(plugin, editor);
    await plugin.insertLink('Page');
    assert.equal(editor.getValue(), 'Text [[Page]]\n');
    assert.equal(editor.cursorOffset(), editor.getValue().length);
    assert.equal(editor.focused, true);
  }
});

test('newline insertion reuses existing newlines and preserves following text', async () => {
  const { plugin } = loadHarness();
  plugin.settings.newParagraphAfterLink = true;
  for (const following of ['Next', '\nNext', '\n\nNext', '\n\n\nNext']) {
    const editor = editorFor(following, 0);
    useEditor(plugin, editor);
    await plugin.insertLink('Page');
    assert.equal(editor.getValue(), `[[Page]]\n${following.replace(/^\n?/, '')}`);
    assert.equal(editor.cursorOffset(), '[[Page]]\n'.length);
  }
});

test('newline insertion handles aliases and preserves selections not used as aliases', async () => {
  const { plugin } = loadHarness();
  plugin.settings.newParagraphAfterLink = true;
  let editor = editorFor('Alias\n\nNext', 0, 5);
  useEditor(plugin, editor);
  await plugin.insertLink('Page');
  assert.equal(editor.getValue(), '[[Page|Alias]]\n\nNext');
  assert.equal(editor.cursorOffset(), '[[Page|Alias]]\n'.length);
  for (const selection of ['First\nSecond', 'Single']) {
    plugin.settings.useSelectionAsAlias = false;
    editor = editorFor(selection, 0, selection.length);
    useEditor(plugin, editor);
    await plugin.insertLink('Page');
    assert.equal(editor.getValue(), `[[Page]]\n${selection}`);
    assert.equal(editor.cursorOffset(), '[[Page]]\n'.length);
  }
});

test('newline option preserves Markdown tables and escaped alias separators', async () => {
  const { plugin } = loadHarness();
  plugin.settings.newParagraphAfterLink = true;
  const content = '| A | B |\n| --- | --- |\n| Alias | B |';
  const start = content.indexOf('Alias');
  const editor = editorFor(content, start, start + 5);
  useEditor(plugin, editor);
  await plugin.insertLink('Page');
  assert.equal(editor.getValue(), content.replace('Alias', '[[Page\\|Alias]]'));
});

test('default insertion keeps the existing trailing-space behavior', async () => {
  const { plugin } = loadHarness();
  const editor = editorFor('');
  useEditor(plugin, editor);
  await plugin.insertLink('Page');
  assert.equal(editor.getValue(), '[[Page]] ');
});

for (const [label, content, offset, expected] of [
  ['empty note', '', 0, '[[Page]]\n'],
  ['empty line', 'Before\n\nAfter', 7, 'Before\n[[Page]]\nAfter'],
  ['nonempty line', 'BeforeAfter', 6, 'Before [[Page]]\nAfter'],
  ['existing newline', 'Before\nAfter', 6, 'Before [[Page]]\nAfter'],
]) {
  test(`single newline: ${label}`, async () => {
    const { plugin } = loadHarness();
    plugin.settings.newParagraphAfterLink = true;
    const editor = editorFor(content, offset);
    useEditor(plugin, editor);
    await plugin.insertLink('Page');
    assert.equal(editor.getValue(), expected);
    assert.equal(editor.cursorOffset(), expected.indexOf('[[Page]]') + '[[Page]]\n'.length);
  });
}

test('consecutive insertions use the updated cursor without blank lines', async () => {
  const { plugin } = loadHarness();
  plugin.settings.newParagraphAfterLink = true;
  const editor = editorFor('');
  useEditor(plugin, editor);
  for (const page of ['One', 'Two', 'Three']) await plugin.insertLink(page);
  assert.equal(editor.getValue(), '[[One]]\n[[Two]]\n[[Three]]\n');
  assert.equal(editor.cursorOffset(), editor.getValue().length);
});

test('disabled newline option preserves inline insertion with either spacing setting', async () => {
  const { plugin } = loadHarness();
  for (const spaces of [false, true]) {
    plugin.settings.insertSpaceAfterLink = spaces;
    const editor = editorFor('BeforeAfter', 6);
    useEditor(plugin, editor);
    await plugin.insertLink('Page');
    assert.equal(editor.getValue(), `Before [[Page]]${spaces ? ' ' : ''}After`);
  }
});
