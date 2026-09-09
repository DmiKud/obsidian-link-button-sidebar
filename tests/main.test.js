const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadTestApi(locale = 'en') {
  const sourcePath = path.join(__dirname, '..', 'main.js');
  const source = `${fs.readFileSync(sourcePath, 'utf8')}\nmodule.exports.__test = {\n  COLOR_PALETTE,\n  normalizeSettings,\n  normalizeLinkTarget,\n  normalizeHexColor,\n  makeWikiLink,\n  getButtonColor,\n  getButtonTextColor,\n  getPaletteTextColor,\n  extractWikiLinkTargets,\n  getTargetIdentity,\n  buildLinkCounts,\n  buildInsertionPlan,\n  isMarkdownTableRow,\n  moveGroup,\n  moveButton,\n  renderPreservingScroll,\n  t,\n  plural,\n};`;
  class EmptyClass {}
  const obsidian = {
    Plugin: EmptyClass,
    ItemView: EmptyClass,
    MarkdownView: EmptyClass,
    PluginSettingTab: EmptyClass,
    Setting: EmptyClass,
    Notice: EmptyClass,
    Modal: EmptyClass,
    moment: { locale: () => locale },
    debounce(callback) {
      const debounced = (...args) => callback(...args);
      debounced.cancel = () => undefined;
      return debounced;
    },
    parseLinktext(value) {
      const match = String(value).match(/^([^#^]*)([\s\S]*)$/);
      return { path: match[1], subpath: match[2] };
    },
    setIcon() {},
  };
  const context = {
    module: { exports: {} },
    exports: {},
    require(id) {
      if (id === 'obsidian') return obsidian;
      throw new Error(`Unexpected import: ${id}`);
    },
    console,
    Date,
    Math,
    Map,
    Set,
    Promise,
    JSON,
  };
  vm.runInNewContext(source, context, { filename: sourcePath });
  return context.module.exports.__test;
}

const api = loadTestApi();
const plain = (value) => JSON.parse(JSON.stringify(value));

test('uses Russian UI strings and plural forms when Obsidian locale is Russian', () => {
  const ru = loadTestApi('ru');
  assert.equal(ru.t('addGroup'), 'Добавить группу');
  assert.equal(ru.plural('buttonAccusativeForms', 1), 'кнопку');
  assert.equal(ru.plural('buttonAccusativeForms', 2), 'кнопки');
  assert.equal(ru.plural('buttonAccusativeForms', 5), 'кнопок');
});

test('migrates flat settings without merging duplicates or losing label/page differences', () => {
  const { settings, changed, futureVersion } = api.normalizeSettings({
    insertSpaceAfterLink: false,
    buttons: [
      { label: 'Project', page: 'Projects/Current', group: 'Work', color: '#3b82f6' },
      { label: 'Project again', page: 'Projects/Current', group: 'Work', color: '#3b82f6' },
      { label: 'Fallback page', page: '   ', group: 'Other', color: 'not-a-color' },
      null,
    ],
  });

  assert.equal(changed, true);
  assert.equal(futureVersion, false);
  assert.equal(settings.insertSpaceAfterLink, false);
  assert.deepEqual(plain(settings.groups.map((group) => group.name)), ['Work', 'Other']);
  assert.equal(settings.groups[0].buttons.length, 2);
  assert.equal(settings.groups[0].buttons[0].label, 'Project');
  assert.equal(settings.groups[0].buttons[0].page, 'Projects/Current');
  assert.equal(settings.groups[0].buttons[0].colorId, 'blue');
  assert.equal(settings.groups[1].buttons[0].page, 'Fallback page');
  assert.equal(settings.groups[1].buttons[0].colorId, 'accent');
});

test('normalizes current settings, regenerates duplicate ids, and preserves future-version options', () => {
  const current = api.normalizeSettings({
    settingsVersion: 2,
    insertSpaceAfterLink: true,
    useSelectionAsAlias: false,
    openOnStartup: false,
    groups: [
      {
        id: 'same',
        name: '',
        buttons: [
          { id: 'duplicate', label: '', page: 'One', colorId: 'green' },
          { id: 'duplicate', label: 'Two', page: '', colorId: 'unknown' },
        ],
      },
      { id: 'same', name: 'Second', buttons: [] },
    ],
  }).settings;

  assert.equal(current.groups[0].name, 'Group 1');
  assert.notEqual(current.groups[0].id, current.groups[1].id);
  assert.notEqual(current.groups[0].buttons[0].id, current.groups[0].buttons[1].id);
  assert.equal(current.groups[0].buttons[0].label, '');
  assert.equal(current.groups[0].buttons[0].page, 'One');
  assert.equal(current.groups[0].buttons[1].label, 'Two');
  assert.equal(current.groups[0].buttons[1].page, '');
  assert.equal(current.groups[0].buttons[1].colorId, 'accent');

  const missingVersion = api.normalizeSettings({
    groups: [{ id: 'kept', name: 'Kept', buttons: [{ id: 'kept-button', label: 'Label', page: 'Page', colorId: 'red' }] }],
  }).settings;
  assert.equal(missingVersion.groups[0].id, 'kept');
  assert.equal(missingVersion.groups[0].buttons[0].id, 'kept-button');

  const future = api.normalizeSettings({
    settingsVersion: '99',
    insertSpaceAfterLink: false,
    useSelectionAsAlias: false,
    openOnStartup: true,
    groups: [],
  });
  assert.equal(future.futureVersion, true);
  assert.equal(future.settings.insertSpaceAfterLink, false);
  assert.equal(future.settings.useSelectionAsAlias, false);
  assert.equal(future.settings.openOnStartup, true);

  const futureCustom = api.normalizeSettings({
    settingsVersion: 99,
    groups: [{
      id: 'future-group',
      name: 'Future',
      buttons: [{ id: 'future-button', label: 'Custom', page: 'Custom', colorId: 'custom', customColor: '#abcdef' }],
    }],
  });
  assert.equal(futureCustom.futureVersion, true);
  assert.equal(futureCustom.changed, false);
  assert.equal(futureCustom.settings.groups[0].buttons[0].colorId, 'custom');
  assert.equal(futureCustom.settings.groups[0].buttons[0].customColor, '#ABCDEF');
});

test('normalizes pasted wiki-link wrappers and preserves an alias selection exactly', () => {
  assert.equal(api.normalizeLinkTarget(' ![[ Folder/Page | old alias ]] '), 'Folder/Page');
  assert.equal(api.makeWikiLink('Page', ' a|b]c\\ '), '[[Page| a\\|b\\]c\\\\ ]]');
  assert.equal(api.makeWikiLink('Page', 'Alias', true), '[[Page\\|Alias]]');
  assert.deepEqual(plain(api.extractWikiLinkTargets('[[Page\\|Alias]]')), ['Page']);
  assert.equal(api.makeWikiLink('Page|alias'), '');
  assert.deepEqual(plain(api.extractWikiLinkTargets(api.makeWikiLink('Page', 'a]b'))), ['Page']);
});

test('uses a readable counter foreground for fixed palette colors', () => {
  assert.equal(api.COLOR_PALETTE.length, 12);
  assert.equal(api.getPaletteTextColor('accent'), 'var(--text-on-accent)');
  assert.equal(api.getPaletteTextColor('purple'), '#000');
  assert.equal(api.getPaletteTextColor('charcoal'), '#fff');
  assert.equal(api.getPaletteTextColor('black'), '#fff');
  assert.equal(api.getPaletteTextColor('unknown'), 'var(--text-on-accent)');
});

test('normalizes custom colors and rejects values that could become CSS injection', () => {
  assert.equal(api.normalizeHexColor(' 7c3aed '), '#7C3AED');
  assert.equal(api.normalizeHexColor('#abc'), '#AABBCC');
  assert.equal(api.normalizeHexColor('#abcd'), null);
  assert.equal(api.normalizeHexColor('#11223344'), null);
  assert.equal(api.normalizeHexColor('var(--interactive-accent)'), null);
  assert.equal(api.normalizeHexColor('url(javascript:x)'), null);

  const settings = api.normalizeSettings({
    settingsVersion: 2,
    groups: [{
      id: 'colors',
      name: 'Colors',
      buttons: [
        { id: 'custom', label: 'Custom', page: 'Custom', colorId: 'custom', customColor: '7c3aed' },
        { id: 'short', label: 'Short', page: 'Short', colorId: 'custom', customColor: '#abc' },
        { id: 'unsafe', label: 'Unsafe', page: 'Unsafe', colorId: 'custom', customColor: 'url(javascript:x)' },
        { id: 'preset', label: 'Preset', page: 'Preset', colorId: 'red', customColor: '#010203' },
      ],
    }],
  }).settings;

  assert.equal(settings.settingsVersion, 3);
  assert.equal(settings.groups[0].buttons[0].customColor, '#7C3AED');
  assert.equal(settings.groups[0].buttons[1].customColor, '#AABBCC');
  assert.equal(settings.groups[0].buttons[2].customColor, '#7C3AED');
  assert.equal(api.getButtonColor(settings.groups[0].buttons[2]), '#7C3AED');
  assert.equal(settings.groups[0].buttons[3].customColor, '#010203');
  assert.equal(api.getButtonColor(settings.groups[0].buttons[3]), '#ef4444');
});

test('preserves arbitrary legacy hex colors as custom colors', () => {
  const { settings } = api.normalizeSettings({
    buttons: [
      { label: 'Custom', page: 'Custom', group: 'Colors', color: '#0ea5e9' },
      { label: 'Known', page: 'Known', group: 'Colors', color: '#3b82f6' },
    ],
  });
  assert.equal(settings.groups[0].buttons[0].colorId, 'custom');
  assert.equal(settings.groups[0].buttons[0].customColor, '#0EA5E9');
  assert.equal(settings.groups[0].buttons[1].colorId, 'blue');
  assert.equal(settings.groups[0].buttons[1].customColor, '#7C3AED');
});

test('chooses a readable foreground for custom colors', () => {
  assert.equal(api.getButtonTextColor({ colorId: 'custom', customColor: '#FFFFFF' }), '#000');
  assert.equal(api.getButtonTextColor({ colorId: 'custom', customColor: '#000000' }), '#fff');
  assert.equal(api.getButtonTextColor({ colorId: 'custom', customColor: '#7C3AED' }), '#fff');
  assert.equal(api.getButtonTextColor({ colorId: 'custom', customColor: '#3B82F6' }), '#000');
});

test('counts duplicate aliases, embeds, and heading links while ignoring code and comments', () => {
  const content = [
    '[[Page]] and [[Page|alias]] and ![[Page]]',
    '[[Page#Heading]]',
    '`[[Page]]`',
    '<!--',
    '[[Page]]',
    '-->',
    '    [[Page]]',
    '\\[[Page]]',
    '~~~md',
    '[[Page]]',
    '~~~',
  ].join('\n');
  const app = {
    metadataCache: {
      getFirstLinkpathDest(linkPath) {
        return linkPath === 'Page' ? { path: 'Folder/Page.md' } : null;
      },
    },
  };
  const targets = api.extractWikiLinkTargets(content);
  assert.deepEqual(plain(targets), ['Page', 'Page', 'Page', 'Page#Heading']);
  const counts = api.buildLinkCounts(app, content, 'Notes/Today.md');
  assert.equal(counts.get(api.getTargetIdentity(app, 'Page', 'Notes/Today.md')), 4);
  assert.equal(counts.get(api.getTargetIdentity(app, 'Page#Heading', 'Notes/Today.md')), 1);
  assert.equal(counts.get(api.getTargetIdentity(app, 'Page#heading', 'Notes/Today.md')), 1);
});

test('ignores multiline code spans and only closes fenced blocks with a valid closing line', () => {
  const content = [
    '`code starts',
    '[[Hidden]]',
    'code ends` [[Visible]]',
    '```md',
    '[[Hidden]]',
    '``` not a closing fence',
    '[[Hidden]]',
    '```',
    '[[Visible]]',
  ].join('\n');
  assert.deepEqual(plain(api.extractWikiLinkTargets(content)), ['Visible', 'Visible']);
});

test('ignores Obsidian comments without interpreting their code or HTML markup', () => {
  const content = [
    '[[Visible]] %% [[Hidden]] %% [[Visible]]',
    '%%',
    '```md',
    '<!-- [[Hidden]]',
    '%% [[Visible]]',
    '`%% [[HiddenInCode]] %%` [[Visible]]',
    '<!-- %% [[HiddenInHtml]] --> [[Visible]]',
  ].join('\n');
  assert.deepEqual(plain(api.extractWikiLinkTargets(content)), Array(5).fill('Visible'));
});

test('treats escaped Markdown opening markers as text', () => {
  assert.deepEqual(plain(api.extractWikiLinkTargets('\\` [[Visible]] ` literal')), ['Visible']);
  assert.deepEqual(plain(api.extractWikiLinkTargets('\\<!-- [[Visible]] -->')), ['Visible']);
  assert.deepEqual(plain(api.extractWikiLinkTargets('\\%% [[Visible]]')), ['Visible']);
  assert.deepEqual(plain(api.extractWikiLinkTargets('`code with \\` [[Visible]]')), ['Visible']);
});

test('treats unmatched backticks as text and still counts links in indented list items', () => {
  const content = [
    'unmatched ` marker [[Visible]]',
    '    - nested item with [[Visible]]',
    '- parent item',
    '    continuation with [[Visible]]',
    '',
    'plain paragraph',
    '    [[HiddenIndentedCode]]',
  ].join('\n');
  assert.deepEqual(plain(api.extractWikiLinkTargets(content)), ['Visible', 'Visible', 'Visible']);
});

test('handles long indented blocks and nested list continuations without rescanning earlier lines', () => {
  const content = [
    ...Array(6000).fill('    [[HiddenCode]]'),
    '[[Visible]]',
    '- parent',
    '    continuation [[Visible]]',
    '    - nested',
    '        continuation [[Visible]]',
    '',
    '    back to parent [[Visible]]',
    'paragraph',
    '    [[HiddenCode]]',
  ].join('\n');
  assert.deepEqual(plain(api.extractWikiLinkTargets(content)), Array(4).fill('Visible'));
});

test('does not pair unmatched backticks across a blank block boundary', () => {
  const content = ['unmatched ` marker', '[[Visible]]', '', 'another ` marker'].join('\n');
  assert.deepEqual(plain(api.extractWikiLinkTargets(content)), ['Visible']);
});

test('keeps distinct resolved file paths separate while matching aliases and heading case', () => {
  const destinations = { Foo: 'Folder/Foo.md', foo: 'Folder/foo.md', Alias: 'Folder/Foo.md' };
  const app = { metadataCache: { getFirstLinkpathDest: (target) => destinations[target] ? { path: destinations[target] } : null } };
  const counts = api.buildLinkCounts(app, '[[Foo]] [[foo]] [[Alias]] [[Foo#Heading]]', 'Source.md');
  assert.equal(counts.get(api.getTargetIdentity(app, 'Foo', 'Source.md')), 3);
  assert.equal(counts.get(api.getTargetIdentity(app, 'foo', 'Source.md')), 1);
  assert.equal(counts.get(api.getTargetIdentity(app, 'Foo#heading', 'Source.md')), 1);
  assert.equal(api.getTargetIdentity(app, '#Heading', 'Folder/Foo.md'), api.getTargetIdentity(app, 'Foo#heading', 'Source.md'));
});

test('resolves each repeated target only once per count refresh', () => {
  const calls = [];
  const app = { metadataCache: { getFirstLinkpathDest: (target) => {
    calls.push(target);
    return { path: `Folder/${target}.md` };
  } } };
  const counts = api.buildLinkCounts(app, '[[Page]] [[Page|alias]] ![[Page]] [[Other]] [[Other]]', 'Source.md');
  assert.deepEqual(calls, ['Page', 'Other']);
  assert.equal(counts.get('Folder/Page.md\u0000'), 3);
  assert.equal(counts.get('Folder/Other.md\u0000'), 2);
});

test('builds context-aware insertion text without duplicate spaces', () => {
  assert.deepEqual(plain(api.buildInsertionPlan({ page: 'Page', leftCharacter: 'a', rightCharacter: 'b' })), {
    text: ' [[Page]] ',
    replaceSelection: true,
  });
  assert.deepEqual(plain(api.buildInsertionPlan({ page: 'Page', leftCharacter: '(', rightCharacter: ',' })), {
    text: '[[Page]]',
    replaceSelection: true,
  });
  assert.equal(api.buildInsertionPlan({ page: 'Page', leftCharacter: ' ', rightCharacter: ' ' }).text, '[[Page]]');
  assert.equal(api.buildInsertionPlan({ page: 'Page', rightCharacter: '', insertSpaceAfterLink: false }).text, '[[Page]]');

  const selected = api.buildInsertionPlan({
    page: 'Page',
    selection: ' text ',
    leftCharacter: 'a',
    rightCharacter: 'b',
  });
  assert.equal(selected.text, ' [[Page| text ]] ');
  assert.equal(selected.replaceSelection, true);

  const tableSelection = api.buildInsertionPlan({ page: 'Page', selection: 'Alias', escapeAliasSeparator: true });
  assert.equal(tableSelection.text, '[[Page\\|Alias]] ');
  assert.equal(tableSelection.replaceSelection, true);

  const multiline = api.buildInsertionPlan({ page: 'Page', selection: 'first\nsecond', rightCharacter: 'f' });
  assert.equal(multiline.text, '[[Page]] ');
  assert.equal(multiline.replaceSelection, false);
  const whitespaceOnly = api.buildInsertionPlan({ page: 'Page', selection: '   ', rightCharacter: ' ' });
  assert.equal(whitespaceOnly.text, '[[Page]]');
  assert.equal(whitespaceOnly.replaceSelection, false);
  assert.equal(api.buildInsertionPlan({ page: '', selection: '' }).text, '');
});

test('detects rows belonging to a Markdown table before escaping an alias separator', () => {
  const lines = ['| Name | Status |', '| --- | --- |', '| Project | Active |', '', 'prose | only'];
  const editor = { getLine: (line) => lines[line], lastLine: () => lines.length - 1 };
  assert.equal(api.isMarkdownTableRow(editor, 0), true);
  assert.equal(api.isMarkdownTableRow(editor, 2), true);
  assert.equal(api.isMarkdownTableRow(editor, 4), false);
});

test('reorders groups and buttons by stable ids, including cross-group moves and rollback', () => {
  const settings = {
    groups: [
      { id: 'g1', name: 'One', buttons: [{ id: 'a', label: 'Same', page: 'Page' }, { id: 'b', label: 'Same', page: 'Page' }] },
      { id: 'g2', name: 'Two', buttons: [{ id: 'c', label: 'Three', page: 'Other' }] },
      { id: 'g3', name: 'Three', buttons: [] },
    ],
  };

  assert.equal(api.moveGroup(settings, 'g1', 'g3', true), true);
  assert.deepEqual(plain(settings.groups.map((group) => group.id)), ['g2', 'g3', 'g1']);
  assert.equal(api.moveButton(settings, 'a', 'g2', 'c', true), true);
  assert.deepEqual(plain(settings.groups[0].buttons.map((button) => button.id)), ['c', 'a']);
  assert.equal(api.moveButton(settings, 'b', 'g3'), true);
  assert.deepEqual(plain(settings.groups[1].buttons.map((button) => button.id)), ['b']);
  assert.equal(api.moveButton(settings, 'b', 'g3'), false);

  const beforeRollback = JSON.stringify(settings);
  assert.equal(api.moveButton(settings, 'b', 'g2', 'missing'), false);
  assert.equal(JSON.stringify(settings), beforeRollback);
  assert.equal(api.moveGroup(settings, 'missing', 'g1'), false);
});

test('restores settings scroll after structural rerenders and the following animation frame', () => {
  let deferredRestore = null;
  const parent = { scrollTop: 420, scrollLeft: 12, parentElement: null };
  const container = {
    scrollTop: 35,
    scrollLeft: 4,
    parentElement: parent,
    ownerDocument: {
      defaultView: {
        requestAnimationFrame(callback) { deferredRestore = callback; },
      },
    },
  };

  const result = api.renderPreservingScroll(container, () => {
    container.scrollTop = 0;
    container.scrollLeft = 0;
    parent.scrollTop = 0;
    parent.scrollLeft = 0;
    return 'rendered';
  });

  assert.equal(result, 'rendered');
  assert.equal(container.scrollTop, 35);
  assert.equal(container.scrollLeft, 4);
  assert.equal(parent.scrollTop, 420);
  assert.equal(parent.scrollLeft, 12);
  assert.equal(typeof deferredRestore, 'function');

  container.scrollTop = 0;
  parent.scrollTop = 0;
  deferredRestore();
  assert.equal(container.scrollTop, 35);
  assert.equal(parent.scrollTop, 420);
});
