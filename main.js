const {
  Plugin,
  ItemView,
  MarkdownView,
  PluginSettingTab,
  Setting,
  Notice,
  Modal,
  debounce,
  moment,
  parseLinktext,
  setIcon,
} = require('obsidian');

const VIEW_TYPE_LINK_BUTTON_SIDEBAR = 'link-button-sidebar-view';
const SETTINGS_VERSION = 3;
const SETTINGS_SAVE_DELAY = 300;
const VIEW_REFRESH_DELAY = 200;
const DEFAULT_CUSTOM_COLOR = '#7C3AED';

const UI_STRINGS = Object.freeze({
  en: {
    colorAccent: 'Accent', colorRed: 'Red', colorOrange: 'Orange', colorAmber: 'Amber', colorGreen: 'Green', colorCyan: 'Cyan',
    colorBlue: 'Blue', colorViolet: 'Violet', colorPink: 'Pink', colorGray: 'Gray', colorCharcoal: 'Charcoal', colorBlack: 'Black',
    enterPage: 'Enter a page name.', pageLineBreaks: 'Page names cannot contain line breaks.',
    nestedBrackets: 'Remove nested wiki-link brackets.', aliasInPage: 'Use Label for display text instead of an alias in Page.',
    cancel: 'Cancel', continue: 'Continue', sidebarTitle: 'Link buttons',
    sidebarHint: 'Insert a wiki link into the last active Markdown note.',
    sidebarEmpty: 'No buttons yet. Add a group and button in Settings → Link Button Sidebar.', untitled: 'Untitled',
    insertInto: 'Insert into: {path}', chooseTarget: 'Open or focus a Markdown note to choose the insertion target.',
    noTargetAria: '{label}: open a Markdown note before inserting {link}.',
    presentAria: 'Insert {link}. Already appears {count} {occurrence} in {file}.',
    insertAria: 'Insert {link} into {file}.',
    futureWarning: 'These settings were created by a newer plugin version. Update the plugin before editing them.',
    openStartup: 'Open sidebar on startup', openStartupDesc: 'Automatically reveal the button panel when Obsidian starts.',
    trailingSpace: 'Add a trailing space when needed', trailingSpaceDesc: 'Adds a space only when the character after the inserted link requires one.',
    newParagraph: 'Start a new line after a link', newParagraphDesc: 'Moves the cursor to the next line after the inserted link. Overrides trailing spaces; does not apply inside Markdown tables.',
    selectionAlias: 'Use selected text as link alias', selectionAliasDesc: 'A single-line selection becomes [[Page|selected text]]. Multi-line selections are preserved.',
    groupsAndButtons: 'Groups and buttons',
    settingsDescription: 'Create and organize button groups to quickly insert links into your notes.',
    behavior: 'Behavior',
    settingsTip: 'Tip: Drag groups or buttons to reorder them. Select a color dot to choose its color.', settingsTipShort: 'Tip: Drag to reorder.',
    noGroups: 'No groups yet. Add a group to start building the sidebar.', addGroup: 'Add group', addButton: 'Add button', resetExamples: 'Reset examples', resetExamplesShort: 'Reset',
    group: 'Group', groupNumber: 'Group {number}', ungrouped: 'Ungrouped', dragGroup: 'Drag group {name}',
    addButtonToGroup: 'Add button to this group', moveGroupUp: 'Move group up', moveGroupDown: 'Move group down', deleteGroup: 'Delete group',
    emptyGroup: 'Drop a button here or use Add button.', label: 'Label', page: 'Page',
    inserts: 'Inserts {link}', dragButton: 'Drag button {name}', deleteButton: 'Delete button',
    dotColor: 'Dot color', chooseColor: 'Choose color', chooseColorFor: 'Choose color for {name}; drag to reorder', customColor: 'Custom color',
    customColorHint: 'Hex color, for example #7C3AED', invalidColor: 'Enter a color as #RRGGBB.',
    expandGroup: 'Expand group {name}', collapseGroup: 'Collapse group {name}',
    openGroup: 'Open group {name}', groupButtonCount: '{count} buttons', newButton: 'New button', newPage: 'New page', buttonDeleted: 'Button deleted.',
    deleteGroupTitle: 'Delete group?', deleteGroupMessage: 'Delete “{name}” and its {count} {button}?',
    deleteEmptyGroup: 'Delete the empty group “{name}”?', deleteGroupConfirm: 'Delete group', groupDeleted: 'Group deleted.',
    resetTitle: 'Reset example groups?', resetMessage: 'Replace all current groups and buttons with the example configuration?',
    resetConfirm: 'Reset examples', examplesRestored: 'Examples restored.', undo: 'Undo',
    openPlugin: 'Open Link Button Sidebar', openSidebar: 'Open sidebar', rightSidebarError: 'Could not open the right sidebar.',
    pluginOpenError: 'Could not open Link Button Sidebar.', openMarkdownFirst: 'Open or focus a Markdown note first.',
    invalidLink: 'Could not build a valid wiki link.', loadError: 'Link Button Sidebar could not read its settings. Editing and saving are disabled. Restore data.json from a backup, then reload the plugin.',
    futureNotice: 'Link Button Sidebar settings were created by a newer plugin version. Changes will not be saved automatically.',
    saveError: 'Link Button Sidebar could not save its settings.', undoError: 'Could not undo the action.',
    buttonAccusativeForms: ['button', 'buttons', 'buttons'],
    occurrenceForms: ['time', 'times', 'times'],
  },
  ru: {
    colorAccent: 'Акцент', colorRed: 'Красный', colorOrange: 'Оранжевый', colorAmber: 'Янтарный', colorGreen: 'Зелёный', colorCyan: 'Бирюзовый',
    colorBlue: 'Синий', colorViolet: 'Фиолетовый', colorPink: 'Розовый', colorGray: 'Серый', colorCharcoal: 'Графитовый', colorBlack: 'Чёрный',
    enterPage: 'Укажите название страницы.', pageLineBreaks: 'Название страницы не может содержать переносы строк.',
    nestedBrackets: 'Удалите вложенные скобки вики-ссылки.', aliasInPage: 'Текст кнопки задаётся в Label, а не через алиас в Page.',
    cancel: 'Отмена', continue: 'Продолжить', sidebarTitle: 'Кнопки-ссылки',
    sidebarHint: 'Вставляет вики-ссылку в последнюю активную Markdown-заметку.',
    sidebarEmpty: 'Кнопок пока нет. Добавьте группу и кнопку в настройках Link Button Sidebar.', untitled: 'Без названия',
    insertInto: 'Вставка в: {path}', chooseTarget: 'Откройте или выберите Markdown-заметку, чтобы задать место вставки.',
    noTargetAria: '{label}: откройте Markdown-заметку перед вставкой {link}.',
    presentAria: 'Вставить {link}. Уже встречается {count} {occurrence} в заметке «{file}».',
    insertAria: 'Вставить {link} в заметку «{file}».',
    futureWarning: 'Эти настройки созданы более новой версией плагина. Обновите плагин, прежде чем их редактировать.',
    openStartup: 'Открывать боковую панель при запуске', openStartupDesc: 'Автоматически показывает панель кнопок после запуска Obsidian.',
    trailingSpace: 'Добавлять пробел после ссылки при необходимости', trailingSpaceDesc: 'Добавляет пробел, только если следующий символ этого требует.',
    newParagraph: 'Переносить строку после ссылки', newParagraphDesc: 'Переносит курсор на следующую строку после вставленной ссылки. Заменяет пробел после ссылки; не применяется внутри Markdown-таблиц.',
    selectionAlias: 'Использовать выделенный текст как алиас', selectionAliasDesc: 'Однострочное выделение превращается в [[Страница|выделенный текст]]. Многострочное выделение сохраняется.',
    groupsAndButtons: 'Группы и кнопки',
    settingsDescription: 'Создавайте группы кнопок и быстро вставляйте ссылки в заметки.',
    behavior: 'Поведение',
    settingsTip: 'Совет: перетаскивайте группы и кнопки, чтобы менять их порядок. Нажмите на цветную точку, чтобы выбрать цвет.', settingsTipShort: 'Совет: перетаскивайте для сортировки.',
    noGroups: 'Групп пока нет. Добавьте группу, чтобы настроить боковую панель.', addGroup: 'Добавить группу', addButton: 'Добавить кнопку', resetExamples: 'Вернуть примеры', resetExamplesShort: 'Сбросить',
    group: 'Группа', groupNumber: 'Группа {number}', ungrouped: 'Без группы', dragGroup: 'Перетащить группу {name}',
    addButtonToGroup: 'Добавить кнопку в эту группу', moveGroupUp: 'Переместить группу вверх', moveGroupDown: 'Переместить группу вниз', deleteGroup: 'Удалить группу',
    emptyGroup: 'Перетащите сюда кнопку или нажмите кнопку добавления.', label: 'Label', page: 'Page',
    inserts: 'Вставит {link}', dragButton: 'Перетащить кнопку «{name}»', deleteButton: 'Удалить кнопку',
    dotColor: 'Цвет точки', chooseColor: 'Выберите цвет', chooseColorFor: 'Выбрать цвет для «{name}»; перетащить, чтобы изменить порядок', customColor: 'Свой цвет',
    customColorHint: 'Цвет в формате HEX, например #7C3AED', invalidColor: 'Введите цвет в формате #RRGGBB.',
    expandGroup: 'Развернуть группу «{name}»', collapseGroup: 'Свернуть группу «{name}»',
    openGroup: 'Открыть группу «{name}»', groupButtonCount: 'Кнопок: {count}', newButton: 'Новая кнопка', newPage: 'Новая страница', buttonDeleted: 'Кнопка удалена.',
    deleteGroupTitle: 'Удалить группу?', deleteGroupMessage: 'Удалить группу «{name}» и {count} {button}?',
    deleteEmptyGroup: 'Удалить пустую группу «{name}»?', deleteGroupConfirm: 'Удалить группу', groupDeleted: 'Группа удалена.',
    resetTitle: 'Вернуть группы-примеры?', resetMessage: 'Заменить все текущие группы и кнопки примерами?',
    resetConfirm: 'Вернуть примеры', examplesRestored: 'Примеры восстановлены.', undo: 'Отменить',
    openPlugin: 'Открыть Link Button Sidebar', openSidebar: 'Открыть боковую панель', rightSidebarError: 'Не удалось открыть правую боковую панель.',
    pluginOpenError: 'Не удалось открыть Link Button Sidebar.', openMarkdownFirst: 'Сначала откройте или выберите Markdown-заметку.',
    invalidLink: 'Не удалось создать корректную вики-ссылку.', loadError: 'Не удалось прочитать настройки Link Button Sidebar. Редактирование и сохранение отключены. Восстановите data.json из резервной копии и перезагрузите плагин.',
    futureNotice: 'Настройки Link Button Sidebar созданы более новой версией. Изменения не будут сохраняться автоматически.',
    saveError: 'Не удалось сохранить настройки Link Button Sidebar.', undoError: 'Не удалось отменить действие.',
    buttonAccusativeForms: ['кнопку', 'кнопки', 'кнопок'],
    occurrenceForms: ['раз', 'раза', 'раз'],
  },
});

function getUiLanguage() {
  try {
    const locale = moment && typeof moment.locale === 'function' ? moment.locale() : 'en';
    return asString(locale).toLowerCase().startsWith('ru') ? 'ru' : 'en';
  } catch {
    return 'en';
  }
}

function t(key, variables = {}) {
  const language = getUiLanguage();
  const template = UI_STRINGS[language][key] ?? UI_STRINGS.en[key] ?? key;
  if (Array.isArray(template)) return template[0];
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, variable) => Object.prototype.hasOwnProperty.call(variables, variable) ? String(variables[variable]) : match);
}

function plural(key, count) {
  const forms = UI_STRINGS[getUiLanguage()][key] || UI_STRINGS.en[key];
  if (getUiLanguage() !== 'ru') return count === 1 ? forms[0] : forms[1];
  const absolute = Math.abs(count) % 100;
  const lastDigit = absolute % 10;
  if (absolute > 10 && absolute < 20) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
}

const COLOR_PALETTE = Object.freeze([
  { id: 'red', labelKey: 'colorRed', css: '#ef4444' },
  { id: 'orange', labelKey: 'colorOrange', css: '#f97316' },
  { id: 'amber', labelKey: 'colorAmber', css: '#f59e0b' },
  { id: 'green', labelKey: 'colorGreen', css: '#22c55e' },
  { id: 'cyan', labelKey: 'colorCyan', css: '#06b6d4' },
  { id: 'blue', labelKey: 'colorBlue', css: '#3b82f6' },
  { id: 'violet', labelKey: 'colorViolet', css: '#8b5cf6' },
  { id: 'pink', labelKey: 'colorPink', css: '#d946ef' },
  { id: 'accent', labelKey: 'colorAccent', css: 'var(--interactive-accent)' },
  { id: 'gray', labelKey: 'colorGray', css: '#94a3b8' },
  { id: 'charcoal', labelKey: 'colorCharcoal', css: '#3f3f46' },
  { id: 'black', labelKey: 'colorBlack', css: '#18181b' },
]);

const COLOR_BY_ID = new Map(COLOR_PALETTE.map((color) => [color.id, color]));
const LEGACY_COLOR_IDS = new Map([
  ['var(--color-accent)', 'accent'],
  ['var(--interactive-accent)', 'accent'],
  ['var(--color-red)', 'red'],
  ['var(--color-orange)', 'orange'],
  ['var(--color-yellow)', 'amber'],
  ['var(--color-green)', 'green'],
  ['var(--color-cyan)', 'cyan'],
  ['var(--color-blue)', 'blue'],
  ['var(--color-purple)', 'violet'],
  ['var(--color-pink)', 'pink'],
  ['purple', 'violet'],
  ['#ef4444', 'red'],
  ['#f97316', 'orange'],
  ['#f59e0b', 'amber'],
  ['#22c55e', 'green'],
  ['#06b6d4', 'cyan'],
  ['#3b82f6', 'blue'],
  ['#a855f7', 'violet'],
  ['#8b5cf6', 'violet'],
  ['#ec4899', 'pink'],
  ['#d946ef', 'pink'],
  ['#94a3b8', 'gray'],
  ['#3f3f46', 'charcoal'],
  ['#18181b', 'black'],
  ['#000000', 'black'],
  ['#000', 'black'],
]);

let generatedIdCounter = 0;

function createDefaultSettings() {
  return {
    settingsVersion: SETTINGS_VERSION,
    insertSpaceAfterLink: true,
    newParagraphAfterLink: false,
    useSelectionAsAlias: true,
    openOnStartup: false,
    groups: [
      {
        id: 'group-areas',
        name: 'Areas',
        buttons: [
          { id: 'button-work', label: 'Work', page: 'Work', colorId: 'blue', customColor: DEFAULT_CUSTOM_COLOR },
          { id: 'button-health', label: 'Health', page: 'Health', colorId: 'green', customColor: DEFAULT_CUSTOM_COLOR },
          { id: 'button-finance', label: 'Finance', page: 'Finance', colorId: 'amber', customColor: DEFAULT_CUSTOM_COLOR },
        ],
      },
      {
        id: 'group-activities',
        name: 'Activities',
        buttons: [
          { id: 'button-reading', label: 'Reading', page: 'Reading', colorId: 'violet', customColor: DEFAULT_CUSTOM_COLOR },
        ],
      },
    ],
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function cleanText(value) {
  return asString(value).trim();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createUniqueId(prefix, usedIds = new Set()) {
  let candidate = '';
  do {
    generatedIdCounter += 1;
    const randomPart = typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${generatedIdCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    candidate = `${prefix}-${randomPart}`;
  } while (usedIds.has(candidate));
  usedIds.add(candidate);
  return candidate;
}

function ensureUniqueId(candidate, prefix, usedIds) {
  const value = cleanText(candidate);
  if (value && !usedIds.has(value)) {
    usedIds.add(value);
    return value;
  }
  return createUniqueId(prefix, usedIds);
}

function findUnescapedPipe(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '|') continue;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1;
    if (slashCount % 2 === 0) return index;
  }
  return -1;
}

function findEscapedPipe(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '|') continue;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1;
    if (slashCount % 2 === 1) return { pipeIndex: index, targetEnd: index - 1 };
  }
  return null;
}

function findAliasSeparator(value) {
  const unescapedPipe = findUnescapedPipe(value);
  if (unescapedPipe >= 0) return { pipeIndex: unescapedPipe, targetEnd: unescapedPipe };
  return findEscapedPipe(value);
}

function normalizeLinkTarget(value) {
  let normalized = cleanText(value);
  if (!normalized) return '';
  const wrappedMatch = normalized.match(/^!?\[\[([\s\S]*)\]\]$/);
  if (wrappedMatch) normalized = wrappedMatch[1].trim();
  const aliasSeparator = findAliasSeparator(normalized);
  if (aliasSeparator) normalized = normalized.slice(0, aliasSeparator.targetEnd).trim();
  return normalized;
}

function validateLinkTarget(value) {
  let rawTarget = cleanText(value);
  const wrappedMatch = rawTarget.match(/^!?\[\[([\s\S]*)\]\]$/);
  if (wrappedMatch) rawTarget = wrappedMatch[1].trim();
  const aliasSeparator = findAliasSeparator(rawTarget);
  const target = (aliasSeparator ? rawTarget.slice(0, aliasSeparator.targetEnd) : rawTarget).trim();
  if (!target) return { target: '', error: t('enterPage') };
  if (/[\r\n]/.test(rawTarget)) return { target, error: t('pageLineBreaks') };
  if (rawTarget.includes('[[') || rawTarget.includes(']]')) {
    return { target, error: t('nestedBrackets') };
  }
  if (aliasSeparator) {
    return { target, error: t('aliasInPage') };
  }
  return { target, error: null };
}

function escapeWikiAlias(value) {
  return asString(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\]/g, '\\]');
}

function makeWikiLink(page, alias = '', escapeAliasSeparator = false) {
  const validation = validateLinkTarget(page);
  if (validation.error) return '';
  const aliasText = asString(alias);
  const aliasSeparator = escapeAliasSeparator ? '\\|' : '|';
  return aliasText
    ? `[[${validation.target}${aliasSeparator}${escapeWikiAlias(aliasText)}]]`
    : `[[${validation.target}]]`;
}

function migrateLegacyColor(value) {
  const normalized = cleanText(value).toLowerCase();
  if (COLOR_BY_ID.has(normalized)) return normalized;
  return LEGACY_COLOR_IDS.get(normalized) || 'accent';
}

function normalizeColorId(value) {
  const colorId = cleanText(value).toLowerCase();
  if (colorId === 'custom') return 'custom';
  return COLOR_BY_ID.has(colorId) ? colorId : migrateLegacyColor(value);
}

function getPaletteColor(colorId) {
  return (COLOR_BY_ID.get(normalizeColorId(colorId)) || COLOR_BY_ID.get('accent')).css;
}

function normalizeHexColor(value) {
  const match = cleanText(value).match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const digits = match[1].length === 3
    ? match[1].split('').map((character) => character + character).join('')
    : match[1];
  return `#${digits.toUpperCase()}`;
}

function getButtonColor(button) {
  const colorId = normalizeColorId(button.colorId);
  if (colorId === 'custom') {
    return normalizeHexColor(button.customColor) || DEFAULT_CUSTOM_COLOR;
  }
  return getPaletteColor(colorId);
}

function getPaletteTextColor(colorId, customColor = DEFAULT_CUSTOM_COLOR) {
  const normalizedId = normalizeColorId(colorId);
  if (normalizedId === 'accent') return 'var(--text-on-accent)';
  const color = normalizedId === 'custom'
    ? normalizeHexColor(customColor) || DEFAULT_CUSTOM_COLOR
    : getPaletteColor(normalizedId);
  const channels = color.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? '#000' : '#fff';
}

function getButtonTextColor(button) {
  return getPaletteTextColor(button.colorId, button.customColor);
}

function normalizeButton(rawButton, usedButtonIds, isLegacy = false) {
  if (!isRecord(rawButton)) return null;
  const normalizedLabel = cleanText(rawButton.label);
  const explicitPage = isLegacy ? normalizeLinkTarget(rawButton.page) : cleanText(rawButton.page);
  const page = isLegacy ? explicitPage || normalizeLinkTarget(rawButton.label) : explicitPage;
  const label = isLegacy ? normalizedLabel || page : normalizedLabel;
  const rawColor = cleanText(rawButton.color);
  const rawColorKey = rawColor.toLowerCase();
  const legacyCustomColor = normalizeHexColor(rawColor);
  const requestedColorId = cleanText(rawButton.colorId).toLowerCase();
  const colorId = requestedColorId === 'custom' || (!requestedColorId && legacyCustomColor && !LEGACY_COLOR_IDS.has(rawColorKey))
    ? 'custom'
    : normalizeColorId(rawButton.colorId || rawColor);
  return {
    id: ensureUniqueId(rawButton.id, 'button', usedButtonIds),
    label,
    page,
    colorId,
    customColor: normalizeHexColor(rawButton.customColor) || (colorId === 'custom' ? legacyCustomColor : null) || DEFAULT_CUSTOM_COLOR,
  };
}

function normalizeCurrentGroups(rawGroups) {
  const usedGroupIds = new Set();
  const usedButtonIds = new Set();
  const groups = [];
  for (const rawGroup of Array.isArray(rawGroups) ? rawGroups : []) {
    if (!isRecord(rawGroup)) continue;
    const buttons = [];
    for (const rawButton of Array.isArray(rawGroup.buttons) ? rawGroup.buttons : []) {
      const button = normalizeButton(rawButton, usedButtonIds, false);
      if (button) buttons.push(button);
    }
    groups.push({
      id: ensureUniqueId(rawGroup.id, 'group', usedGroupIds),
      name: cleanText(rawGroup.name) || t('groupNumber', { number: groups.length + 1 }),
      buttons,
    });
  }
  return groups;
}

function migrateLegacyGroups(rawButtons) {
  const usedGroupIds = new Set();
  const usedButtonIds = new Set();
  const groups = [];
  const groupByName = new Map();
  for (const rawButton of Array.isArray(rawButtons) ? rawButtons : []) {
    if (!isRecord(rawButton)) continue;
    const groupName = cleanText(rawButton.group) || t('ungrouped');
    let group = groupByName.get(groupName);
    if (!group) {
      group = { id: createUniqueId('group', usedGroupIds), name: groupName, buttons: [] };
      groupByName.set(groupName, group);
      groups.push(group);
    }
    const button = normalizeButton(rawButton, usedButtonIds, true);
    if (button) group.buttons.push(button);
  }
  if (!groups.length) {
    groups.push({ id: createUniqueId('group', usedGroupIds), name: t('ungrouped'), buttons: [] });
  }
  return groups;
}

function normalizeSettings(rawData) {
  if (!isRecord(rawData)) return { settings: createDefaultSettings(), changed: true };
  const versionText = cleanText(rawData.settingsVersion);
  const parsedSettingsVersion = /^\d+$/.test(versionText) ? Number(versionText) : Number.NaN;
  if (Number.isFinite(parsedSettingsVersion) && parsedSettingsVersion > SETTINGS_VERSION) {
    const defaults = createDefaultSettings();
    return {
      settings: {
        ...defaults,
        insertSpaceAfterLink: typeof rawData.insertSpaceAfterLink === 'boolean' ? rawData.insertSpaceAfterLink : defaults.insertSpaceAfterLink,
        newParagraphAfterLink: typeof rawData.newParagraphAfterLink === 'boolean' ? rawData.newParagraphAfterLink : false,
        useSelectionAsAlias: typeof rawData.useSelectionAsAlias === 'boolean' ? rawData.useSelectionAsAlias : defaults.useSelectionAsAlias,
        openOnStartup: typeof rawData.openOnStartup === 'boolean' ? rawData.openOnStartup : defaults.openOnStartup,
        groups: normalizeCurrentGroups(rawData.groups),
      },
      changed: false,
      futureVersion: true,
    };
  }
  const usesCurrentSchema = Array.isArray(rawData.groups);
  const settings = {
    settingsVersion: SETTINGS_VERSION,
    insertSpaceAfterLink: typeof rawData.insertSpaceAfterLink === 'boolean' ? rawData.insertSpaceAfterLink : true,
    newParagraphAfterLink: typeof rawData.newParagraphAfterLink === 'boolean' ? rawData.newParagraphAfterLink : false,
    useSelectionAsAlias: typeof rawData.useSelectionAsAlias === 'boolean' ? rawData.useSelectionAsAlias : true,
    openOnStartup: typeof rawData.openOnStartup === 'boolean' ? rawData.openOnStartup : false,
    groups: usesCurrentSchema ? normalizeCurrentGroups(rawData.groups) : migrateLegacyGroups(rawData.buttons),
  };
  let changed = true;
  try {
    changed = JSON.stringify(rawData) !== JSON.stringify(settings);
  } catch {
    changed = true;
  }
  return { settings, changed, futureVersion: false };
}

function getAllButtons(settings) {
  return settings.groups.flatMap((group) => group.buttons);
}

function findGroup(settings, groupId) {
  return settings.groups.find((group) => group.id === groupId) || null;
}

function findButtonLocation(settings, buttonId) {
  for (const group of settings.groups) {
    const index = group.buttons.findIndex((button) => button.id === buttonId);
    if (index >= 0) return { group, index, button: group.buttons[index] };
  }
  return null;
}

function moveGroup(settings, sourceGroupId, targetGroupId, insertAfter = false) {
  if (!sourceGroupId || !targetGroupId || sourceGroupId === targetGroupId) return false;
  const sourceIndex = settings.groups.findIndex((group) => group.id === sourceGroupId);
  if (sourceIndex < 0) return false;
  const [sourceGroup] = settings.groups.splice(sourceIndex, 1);
  const targetIndex = settings.groups.findIndex((group) => group.id === targetGroupId);
  if (targetIndex < 0) {
    settings.groups.splice(sourceIndex, 0, sourceGroup);
    return false;
  }
  settings.groups.splice(targetIndex + (insertAfter ? 1 : 0), 0, sourceGroup);
  return true;
}

function moveButton(settings, buttonId, targetGroupId, targetButtonId = null, insertAfter = false) {
  const sourceLocation = findButtonLocation(settings, buttonId);
  const targetGroup = findGroup(settings, targetGroupId);
  if (!sourceLocation || !targetGroup || targetButtonId === buttonId) return false;
  if (!targetButtonId && sourceLocation.group === targetGroup && sourceLocation.index === targetGroup.buttons.length - 1) return false;
  const [button] = sourceLocation.group.buttons.splice(sourceLocation.index, 1);
  if (!targetButtonId) {
    targetGroup.buttons.push(button);
    return true;
  }
  const targetIndex = targetGroup.buttons.findIndex((item) => item.id === targetButtonId);
  if (targetIndex < 0) {
    sourceLocation.group.buttons.splice(sourceLocation.index, 0, button);
    return false;
  }
  targetGroup.buttons.splice(targetIndex + (insertAfter ? 1 : 0), 0, button);
  return true;
}

function renderPreservingScroll(containerEl, render) {
  const scrollPositions = [];
  for (let element = containerEl; element; element = element.parentElement) {
    if (typeof element.scrollTop !== 'number' || typeof element.scrollLeft !== 'number') continue;
    scrollPositions.push({ element, top: element.scrollTop, left: element.scrollLeft });
  }
  const restore = () => {
    for (const position of scrollPositions) {
      position.element.scrollTop = position.top;
      position.element.scrollLeft = position.left;
    }
  };
  try {
    return render();
  } finally {
    restore();
    const ownerWindow = containerEl && containerEl.ownerDocument && containerEl.ownerDocument.defaultView;
    if (ownerWindow && typeof ownerWindow.requestAnimationFrame === 'function') ownerWindow.requestAnimationFrame(restore);
  }
}

function hasOddEscapePrefix(value, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function maskRange(characters, start, end) {
  for (let index = start; index < end; index += 1) characters[index] = ' ';
}

function getBacktickRunLength(line, index) {
  let runLength = 0;
  while (line[index + runLength] === '`') runLength += 1;
  return runLength;
}

function findClosingBacktickRun(line, start, expectedLength) {
  for (let candidate = start; candidate < line.length; candidate += 1) {
    if (line[candidate] !== '`') continue;
    const runLength = getBacktickRunLength(line, candidate);
    if (runLength === expectedLength) return candidate;
    candidate += runLength - 1;
  }
  return -1;
}

function findUnescapedMarkup(line, marker, start) {
  let index = line.indexOf(marker, start);
  while (index >= 0 && hasOddEscapePrefix(line, index)) {
    index = line.indexOf(marker, index + marker.length);
  }
  return index;
}

function maskInlineMarkup(line, state, hasFutureClosingRun) {
  const characters = line.split('');
  let cursor = 0;
  while (cursor < line.length) {
    if (state.inHtmlComment) {
      const commentEnd = line.indexOf('-->', cursor);
      const end = commentEnd < 0 ? line.length : commentEnd + 3;
      maskRange(characters, cursor, end);
      cursor = end;
      if (commentEnd < 0) break;
      state.inHtmlComment = false;
      continue;
    }
    if (state.inObsidianComment) {
      const commentEnd = line.indexOf('%%', cursor);
      const end = commentEnd < 0 ? line.length : commentEnd + 2;
      maskRange(characters, cursor, end);
      cursor = end;
      if (commentEnd < 0) break;
      state.inObsidianComment = false;
      continue;
    }
    if (state.inlineCodeLength) {
      const closingIndex = findClosingBacktickRun(line, cursor, state.inlineCodeLength);
      const end = closingIndex < 0 ? line.length : closingIndex + state.inlineCodeLength;
      maskRange(characters, cursor, end);
      cursor = end;
      if (closingIndex < 0) break;
      state.inlineCodeLength = 0;
      continue;
    }
    const htmlCommentStart = findUnescapedMarkup(line, '<!--', cursor);
    const obsidianCommentStart = findUnescapedMarkup(line, '%%', cursor);
    const codeStart = findUnescapedMarkup(line, '`', cursor);
    const nextStart = Math.min(...[htmlCommentStart, obsidianCommentStart, codeStart].filter((index) => index >= 0));
    if (!Number.isFinite(nextStart)) break;
    if (nextStart === htmlCommentStart || nextStart === obsidianCommentStart) {
      const isHtmlComment = nextStart === htmlCommentStart;
      state.inHtmlComment = isHtmlComment;
      state.inObsidianComment = !isHtmlComment;
      const markerLength = isHtmlComment ? 4 : 2;
      maskRange(characters, nextStart, nextStart + markerLength);
      cursor = nextStart + markerLength;
      continue;
    }
    const runLength = getBacktickRunLength(line, codeStart);
    const closingIndex = findClosingBacktickRun(line, codeStart + runLength, runLength);
    if (closingIndex < 0) {
      if (!hasFutureClosingRun(runLength)) {
        cursor = codeStart + runLength;
        continue;
      }
      maskRange(characters, codeStart, line.length);
      state.inlineCodeLength = runLength;
      break;
    }
    const end = closingIndex + runLength;
    maskRange(characters, codeStart, end);
    cursor = end;
  }
  return characters;
}

function hasClosingBacktickRun(lines, startLine, expectedLength) {
  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    if (!cleanText(lines[lineIndex])) return false;
    if (findClosingBacktickRun(lines[lineIndex], 0, expectedLength) >= 0) return true;
  }
  return false;
}

function getIndentWidth(line) {
  let width = 0;
  for (const character of asString(line)) {
    if (character === ' ') width += 1;
    else if (character === '\t') width += 4 - (width % 4);
    else break;
  }
  return width;
}

function isListMarkerLine(line) {
  return /^(?:[-+*]|\d+[.)])\s+/.test(asString(line).trimStart());
}

function isIndentedCodeLine(line, indentationStack) {
  if (!cleanText(line)) return false;
  const indentWidth = getIndentWidth(line);
  while (indentationStack.length && indentationStack[indentationStack.length - 1].width >= indentWidth) {
    indentationStack.pop();
  }
  const parent = indentationStack[indentationStack.length - 1];
  const isListContinuation = Boolean(parent && parent.isListMarker);
  indentationStack.push({ width: indentWidth, isListMarker: isListMarkerLine(line) });
  const indentMatch = line.match(/^(?: {4}|\t)(.*)$/);
  if (!indentMatch) return false;
  if (/^(?:[-+*]|\d+[.)])\s+/.test(indentMatch[1])) return false;
  return !isListContinuation;
}

function extractWikiLinkTargets(content) {
  const targets = [];
  const state = { fenceCharacter: '', fenceLength: 0, inHtmlComment: false, inObsidianComment: false, inlineCodeLength: 0 };
  const indentationStack = [];
  const lines = asString(content).split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const isIndentedCode = isIndentedCodeLine(line, indentationStack);
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (state.fenceCharacter) {
      if (fenceMatch
        && fenceMatch[1][0] === state.fenceCharacter
        && fenceMatch[1].length >= state.fenceLength
        && /^[ \t]*$/.test(fenceMatch[2])) {
        state.fenceCharacter = '';
        state.fenceLength = 0;
      }
      continue;
    }
    if (!state.inHtmlComment && !state.inObsidianComment && !state.inlineCodeLength && fenceMatch) {
      state.fenceCharacter = fenceMatch[1][0];
      state.fenceLength = fenceMatch[1].length;
      continue;
    }
    if (!state.inHtmlComment && !state.inObsidianComment && !state.inlineCodeLength && isIndentedCode) continue;
    const visibleLine = maskInlineMarkup(
      line,
      state,
      (runLength) => hasClosingBacktickRun(lines, lineIndex + 1, runLength),
    ).join('');
    for (let start = 0; start < visibleLine.length - 1; start += 1) {
      if (visibleLine[start] !== '[' || visibleLine[start + 1] !== '[' || hasOddEscapePrefix(visibleLine, start)) continue;
      let end = start + 2;
      while (end < visibleLine.length - 1) {
        if (visibleLine[end] === ']' && visibleLine[end + 1] === ']' && !hasOddEscapePrefix(visibleLine, end)) break;
        end += 1;
      }
      if (end >= visibleLine.length - 1) break;
      const target = normalizeLinkTarget(visibleLine.slice(start + 2, end));
      if (target) targets.push(target);
      start = end + 1;
    }
  }
  return targets;
}

function getTargetIdentity(app, target, sourcePath) {
  const validation = validateLinkTarget(target);
  if (validation.error) return '';
  let parsed;
  try {
    parsed = parseLinktext(validation.target);
  } catch {
    return validation.target.toLowerCase();
  }
  const linkPath = cleanText(parsed.path);
  const subpath = asString(parsed.subpath);
  let resolvedPath = linkPath || sourcePath;
  let hasResolvedPath = !linkPath;
  if (linkPath && app && app.metadataCache) {
    const destination = app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
    if (destination) {
      resolvedPath = destination.path;
      hasResolvedPath = true;
    }
  }
  const normalizedPath = asString(resolvedPath).replace(/\\/g, '/');
  return `${hasResolvedPath ? normalizedPath : normalizedPath.toLowerCase()}\u0000${subpath.toLowerCase()}`;
}

function buildLinkCounts(app, content, sourcePath) {
  const counts = new Map();
  const identities = new Map();
  for (const target of extractWikiLinkTargets(content)) {
    if (!identities.has(target)) identities.set(target, getTargetIdentity(app, target, sourcePath));
    const identity = identities.get(target);
    if (!identity) continue;
    counts.set(identity, (counts.get(identity) || 0) + 1);
    const separatorIndex = identity.indexOf('\u0000');
    const baseIdentity = separatorIndex >= 0 ? `${identity.slice(0, separatorIndex)}\u0000` : identity;
    if (baseIdentity !== identity) counts.set(baseIdentity, (counts.get(baseIdentity) || 0) + 1);
  }
  return counts;
}

function shouldAddLeadingSpace(character) {
  if (!character || /\s/.test(character)) return false;
  return !/[([{\u201c\u2018"']/.test(character);
}

function shouldAddTrailingSpace(character, enabled) {
  if (!enabled) return false;
  if (!character) return true;
  if (/\s/.test(character)) return false;
  return !/[.,;:!?…\u2014\u2013)\]}\u201d\u2019"']/.test(character);
}

function buildInsertionPlan({
  page,
  selection = '',
  leftCharacter = '',
  rightCharacter = '',
  insertSpaceAfterLink = true,
  newParagraphAfterLink = false,
  followingText = '',
  useSelectionAsAlias = true,
  escapeAliasSeparator = false,
}) {
  const hasSelection = selection.length > 0;
  const canUseAlias = hasSelection && Boolean(cleanText(selection)) && useSelectionAsAlias && !/[\r\n]/.test(selection);
  const link = makeWikiLink(page, canUseAlias ? selection : '', escapeAliasSeparator && canUseAlias);
  if (!link) return { text: '', replaceSelection: false };
  const leadingSpace = shouldAddLeadingSpace(leftCharacter) ? ' ' : '';
  if (newParagraphAfterLink) {
    const existingBreaks = followingText.match(/^\n?/)[0].length;
    return {
      text: `${leadingSpace}${link}${'\n'.repeat(1 - existingBreaks)}`,
      replaceSelection: !hasSelection || canUseAlias,
      cursorAdvance: existingBreaks,
    };
  }
  const trailingSpace = shouldAddTrailingSpace(rightCharacter, insertSpaceAfterLink) ? ' ' : '';
  return { text: `${leadingSpace}${link}${trailingSpace}`, replaceSelection: !hasSelection || canUseAlias };
}

function getCharacterBefore(editor, position) {
  if (position.ch > 0) return editor.getLine(position.line).charAt(position.ch - 1);
  return position.line > 0 ? '\n' : '';
}

function getCharacterAfter(editor, position) {
  const line = editor.getLine(position.line);
  if (position.ch < line.length) return line.charAt(position.ch);
  return position.line < editor.lastLine() ? '\n' : '';
}

function hasTablePipe(line) {
  return findUnescapedPipe(asString(line)) >= 0;
}

function isMarkdownTableDelimiter(line) {
  let normalized = cleanText(line);
  if (normalized.startsWith('|')) normalized = normalized.slice(1);
  if (normalized.endsWith('|')) normalized = normalized.slice(0, -1);
  const cells = normalized.split('|');
  return cells.length >= 2 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function isMarkdownTableRow(editor, lineNumber) {
  if (!editor || !hasTablePipe(editor.getLine(lineNumber))) return false;
  const lastLine = editor.lastLine();
  for (let cursor = lineNumber; cursor >= 0; cursor -= 1) {
    const line = editor.getLine(cursor);
    if (!hasTablePipe(line)) break;
    if (isMarkdownTableDelimiter(line)) return true;
  }
  for (let cursor = lineNumber + 1; cursor <= lastLine; cursor += 1) {
    const line = editor.getLine(cursor);
    if (!hasTablePipe(line)) break;
    if (isMarkdownTableDelimiter(line)) return true;
  }
  return false;
}

class ConfirmActionModal extends Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.finished = false;
  }
  onOpen() {
    this.titleEl.setText(this.options.title);
    this.contentEl.createEl('p', { text: this.options.message });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t('cancel')).onClick(() => this.finish(false)))
      .addButton((button) => button.setButtonText(this.options.confirmText || t('continue')).setWarning().onClick(() => this.finish(true)));
  }
  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.options.resolve(result);
    this.close();
  }
  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.options.resolve(false);
    }
  }
}

function confirmAction(app, options) {
  return new Promise((resolve) => new ConfirmActionModal(app, { ...options, resolve }).open());
}

class LinkButtonSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.buttonEntries = [];
    this.targetEl = null;
  }
  getViewType() { return VIEW_TYPE_LINK_BUTTON_SIDEBAR; }
  getDisplayText() { return t('sidebarTitle'); }
  getIcon() { return 'links-coming-in'; }
  async onOpen() { this.render(); }

  render() {
    const container = this.contentEl;
    container.empty();
    container.addClass('link-button-sidebar');
    this.buttonEntries = [];
    const header = container.createDiv({ cls: 'link-button-sidebar__header' });
    header.createEl('h2', { text: t('sidebarTitle') });
    header.createDiv({ cls: 'link-button-sidebar__hint', text: t('sidebarHint') });
    this.targetEl = header.createDiv({ cls: 'link-button-sidebar__target', attr: { role: 'status', 'aria-live': 'polite' } });
    const groups = this.plugin.settings.groups || [];
    const buttonCount = groups.reduce((total, group) => total + group.buttons.length, 0);
    if (!buttonCount) {
      container.createDiv({ cls: 'link-button-sidebar__empty', text: t('sidebarEmpty') });
      this.updateState();
      return;
    }
    for (const group of groups) {
      if (!group.buttons.length) continue;
      const groupEl = container.createDiv({ cls: 'link-button-sidebar__group' });
      groupEl.createEl('h3', { text: group.name });
      const grid = groupEl.createDiv({ cls: 'link-button-sidebar__grid' });
      for (const item of group.buttons) {
        const validation = validateLinkTarget(item.page);
        const label = cleanText(item.label) || validation.target || t('untitled');
        const button = grid.createEl('button', { cls: 'link-button-sidebar__button', attr: { type: 'button' } });
        button.style.setProperty('--link-button-sidebar-color', getButtonColor(item));
        button.style.setProperty('--link-button-sidebar-count-text', getButtonTextColor(item));
        button.createSpan({ cls: 'link-button-sidebar__button-label', text: label });
        const countEl = button.createSpan({ cls: 'link-button-sidebar__count', attr: { 'aria-hidden': 'true' } });
        button.addEventListener('click', () => void this.plugin.insertLink(item.page));
        this.buttonEntries.push({ button, countEl, item });
      }
    }
    this.updateState();
  }

  updateState() {
    const targetView = this.plugin.getTargetMarkdownView();
    const hasTarget = Boolean(targetView && targetView.editor && targetView.file);
    const sourcePath = hasTarget ? targetView.file.path : '';
    const content = hasTarget ? targetView.editor.getValue() : '';
    const counts = hasTarget ? this.plugin.getLinkCounts(content, sourcePath) : new Map();
    if (this.targetEl) {
      this.targetEl.setText(hasTarget ? t('insertInto', { path: targetView.file.path }) : t('chooseTarget'));
      this.targetEl.toggleClass('is-missing', !hasTarget);
    }
    for (const entry of this.buttonEntries) {
      const validation = validateLinkTarget(entry.item.page);
      const identity = validation.error || !hasTarget ? '' : getTargetIdentity(this.app, validation.target, sourcePath);
      const usageCount = identity ? counts.get(identity) || 0 : 0;
      const label = cleanText(entry.item.label) || validation.target || t('untitled');
      entry.button.disabled = !hasTarget || Boolean(validation.error);
      entry.button.toggleClass('is-present', usageCount > 0);
      entry.countEl.setText(usageCount > 0 ? String(usageCount) : '');
      entry.countEl.toggleClass('is-hidden', usageCount === 0);
      let accessibleText;
      if (validation.error) accessibleText = `${label}: ${validation.error}`;
      else if (!hasTarget) accessibleText = t('noTargetAria', { label, link: makeWikiLink(validation.target) });
      else if (usageCount > 0) accessibleText = t('presentAria', {
        link: makeWikiLink(validation.target), count: usageCount, occurrence: plural('occurrenceForms', usageCount), file: targetView.file.basename,
      });
      else accessibleText = t('insertAria', { link: makeWikiLink(validation.target), file: targetView.file.basename });
      entry.button.setAttribute('aria-label', accessibleText);
      entry.button.setAttribute('title', accessibleText);
    }
  }
}

// Keep the custom group editor on the supported imperative API (Obsidian 1.4+).
// eslint-disable-next-line obsidianmd/settings-tab/prefer-setting-definitions -- Adopting the 1.13-only renderer would replace this editor, not merely index it.
class LinkButtonSidebarSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.dragState = null;
    this.expandedMobileGroupId = null;
    this.colorPopoverEl = null;
    this.colorPopoverTrigger = null;
    this.colorPopoverCleanup = null;
    this.groupTints = new Map();
    this.undoNoticeCleanups = new Set();
    this.undoNoticeHost = null;
    this.undoNoticeHostCleanup = null;
  }
  hide() {
    this.closeAllPopovers();
    this.closeUndoNotices();
    this.plugin.flushScheduledSettingsSave();
    super.hide();
  }

  display() {
    const { containerEl } = this;
    this.closeAllPopovers();
    if (this.expandedMobileGroupId && !findGroup(this.plugin.settings, this.expandedMobileGroupId)) {
      this.expandedMobileGroupId = null;
    }
    containerEl.empty();
    containerEl.addClass('link-button-sidebar-settings');
    containerEl.toggleClass('has-mobile-expanded-group', Boolean(this.expandedMobileGroupId));
    this.dragState = null;

    const topbar = containerEl.createDiv({ cls: 'link-button-sidebar-settings__topbar' });
    const intro = topbar.createDiv({ cls: 'link-button-sidebar-settings__intro' });
    new Setting(intro).setName(t('groupsAndButtons')).setDesc(t('settingsDescription')).setHeading();
    if (this.plugin.readOnlyFutureSettings || this.plugin.settingsLoadFailed) {
      containerEl.createDiv({
        cls: 'link-button-sidebar-settings-warning',
        text: t(this.plugin.settingsLoadFailed ? 'loadError' : 'futureWarning'),
      });
      return;
    }

    const topActions = topbar.createDiv({ cls: 'link-button-sidebar-settings__top-actions' });
    const addGroupButton = topActions.createEl('button', {
      cls: 'link-button-sidebar-settings__top-action mod-cta',
      attr: { type: 'button' },
    });
    setIcon(addGroupButton, 'plus');
    addGroupButton.createSpan({ text: t('addGroup') });
    addGroupButton.setAttribute('data-focus-key', 'settings:add-group');
    addGroupButton.addEventListener('click', () => this.addGroup());
    const resetButton = topActions.createEl('button', {
      cls: 'link-button-sidebar-settings__top-action',
      attr: { type: 'button' },
    });
    setIcon(resetButton, 'rotate-ccw');
    resetButton.createSpan({ cls: 'link-button-sidebar-settings__label-long', text: t('resetExamples') });
    resetButton.createSpan({ cls: 'link-button-sidebar-settings__label-short', text: t('resetExamplesShort') });
    resetButton.setAttribute('data-focus-key', 'settings:reset-examples');
    resetButton.addEventListener('click', () => this.resetExamples());

    const groupsContainer = containerEl.createDiv({ cls: 'link-button-sidebar-settings-groups' });
    this.plugin.settings.groups.forEach((group, groupIndex) => this.renderGroup(groupsContainer, group, groupIndex));
    if (!this.plugin.settings.groups.length) {
      groupsContainer.createDiv({ cls: 'link-button-sidebar-settings-empty', text: t('noGroups') });
    }

    const settingsFooter = containerEl.createDiv({ cls: 'link-button-sidebar-settings__footer' });
    const tip = settingsFooter.createDiv({ cls: 'link-button-sidebar-settings-tip' });
    const tipIcon = tip.createSpan({ attr: { 'aria-hidden': 'true' } });
    setIcon(tipIcon, 'lightbulb');
    tip.createSpan({ cls: 'link-button-sidebar-settings__label-long', text: t('settingsTip') });
    tip.createSpan({ cls: 'link-button-sidebar-settings__label-short', text: t('settingsTipShort') });

    const behavior = settingsFooter.createEl('details', { cls: 'link-button-sidebar-settings-behavior' });
    const behaviorSummary = behavior.createEl('summary');
    const behaviorIcon = behaviorSummary.createSpan({ cls: 'link-button-sidebar-settings-behavior__icon', attr: { 'aria-hidden': 'true' } });
    setIcon(behaviorIcon, 'sliders-horizontal');
    behaviorSummary.createSpan({ text: t('behavior') });
    const behaviorBody = behavior.createDiv({ cls: 'link-button-sidebar-settings-behavior__body' });
    new Setting(behaviorBody)
      .setName(t('openStartup'))
      .setDesc(t('openStartupDesc'))
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.openOnStartup).onChange((value) => {
        this.plugin.settings.openOnStartup = value;
        this.plugin.settingsChanged();
      }));
    new Setting(behaviorBody)
      .setName(t('trailingSpace'))
      .setDesc(t('trailingSpaceDesc'))
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.insertSpaceAfterLink).onChange((value) => {
        this.plugin.settings.insertSpaceAfterLink = value;
        this.plugin.settingsChanged(false);
      }));
    new Setting(behaviorBody)
      .setName(t('newParagraph'))
      .setDesc(t('newParagraphDesc'))
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.newParagraphAfterLink).onChange((value) => {
        this.plugin.settings.newParagraphAfterLink = value;
        this.plugin.settingsChanged(false);
      }));
    new Setting(behaviorBody)
      .setName(t('selectionAlias'))
      .setDesc(t('selectionAliasDesc'))
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.useSelectionAsAlias).onChange((value) => {
        this.plugin.settings.useSelectionAsAlias = value;
        this.plugin.settingsChanged(false);
      }));

  }

  renderGroup(container, group, groupIndex) {
    const groupEl = container.createDiv({ cls: 'link-button-sidebar-settings-group', attr: { 'data-group-id': group.id } });
    const isMobileExpanded = this.expandedMobileGroupId === group.id;
    groupEl.toggleClass('is-mobile-expanded', isMobileExpanded);
    const groupDomKey = encodeURIComponent(group.id);
    const groupNameFocusKey = `group:${groupDomKey}:name`;
    const groupTintPalette = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];
    if (!this.groupTints.has(group.id)) {
      this.groupTints.set(group.id, groupTintPalette[this.groupTints.size % groupTintPalette.length]);
    }
    groupEl.style.setProperty('--link-button-sidebar-group-tint', this.groupTints.get(group.id));
    const groupHeader = groupEl.createDiv({ cls: 'link-button-sidebar-settings-group__header' });
    const mobileBack = this.createIconButton(groupHeader, 'chevron-left', t('collapseGroup', { name: group.name }), () => {
      this.setMobileExpandedGroup(null, group.id);
    });
    mobileBack.addClass('link-button-sidebar-settings-group__mobile-back');
    const dragHandle = this.createDragHandle(groupHeader, t('dragGroup', { name: group.name }), { type: 'group', groupId: group.id }, groupEl);
    dragHandle.addClass('link-button-sidebar-settings-group__drag');
    const folderIcon = groupHeader.createSpan({ cls: 'link-button-sidebar-settings-group__folder', attr: { 'aria-hidden': 'true' } });
    setIcon(folderIcon, 'folder');
    new Setting(groupHeader)
      .setClass('link-button-sidebar-settings-group__name')
      .setName(t('group'))
      .addText((text) => {
        text.setPlaceholder(t('groupNumber', { number: groupIndex + 1 })).setValue(group.name).onChange((value) => {
          group.name = value;
          this.plugin.settingsChanged();
        });
        text.inputEl.setAttribute('aria-label', t('group'));
        text.inputEl.setAttribute('data-focus-key', groupNameFocusKey);
        text.inputEl.addEventListener('blur', () => {
          const fallbackName = t('groupNumber', { number: groupIndex + 1 });
          const normalizedName = cleanText(group.name) || fallbackName;
          if (normalizedName !== group.name) {
            group.name = normalizedName;
            text.setValue(normalizedName);
            this.plugin.refreshViews(true);
          }
          this.plugin.flushScheduledSettingsSave();
        });
      });
    const actions = groupHeader.createDiv({ cls: 'link-button-sidebar-settings-group__actions' });
    this.createIconButton(
      actions, 'arrow-up', t('moveGroupUp'), () => this.moveGroupByOffset(group.id, -1), groupIndex === 0, false,
      `group:${groupDomKey}:up`, groupNameFocusKey,
    );
    this.createIconButton(
      actions, 'arrow-down', t('moveGroupDown'), () => this.moveGroupByOffset(group.id, 1), groupIndex === this.plugin.settings.groups.length - 1, false,
      `group:${groupDomKey}:down`, groupNameFocusKey,
    );
    this.createIconButton(actions, 'trash', t('deleteGroup'), () => this.deleteGroup(group.id), false, true);
    const mobileCount = groupHeader.createSpan({
      cls: 'link-button-sidebar-settings-group__count',
      text: String(group.buttons.length),
      attr: { title: t('groupButtonCount', { count: group.buttons.length }), 'aria-label': t('groupButtonCount', { count: group.buttons.length }) },
    });
    mobileCount.setAttribute('aria-hidden', 'true');
    const mobileToggle = this.createIconButton(
      groupHeader,
      'chevron-down',
      t('expandGroup', { name: group.name }),
      () => this.setMobileExpandedGroup(group.id, group.id),
    );
    mobileToggle.addClass('link-button-sidebar-settings-group__mobile-toggle');
    mobileToggle.setAttribute('aria-expanded', isMobileExpanded ? 'true' : 'false');
    this.registerGroupDropTarget(groupEl, group);
    const preview = groupEl.createEl('button', {
      cls: 'link-button-sidebar-settings-group__preview',
      attr: { type: 'button', 'aria-label': t('openGroup', { name: group.name }) },
    });
    const previewDots = preview.createSpan({ cls: 'link-button-sidebar-settings-group__preview-dots', attr: { 'aria-hidden': 'true' } });
    for (const button of group.buttons.slice(0, 8)) {
      const previewDot = previewDots.createSpan({
        cls: 'link-button-sidebar-settings-group__preview-dot',
        attr: { 'data-color-button-id': button.id },
      });
      previewDot.style.setProperty('--link-button-sidebar-swatch', getButtonColor(button));
    }
    const previewArrow = preview.createSpan({ cls: 'link-button-sidebar-settings-group__preview-arrow', attr: { 'aria-hidden': 'true' } });
    setIcon(previewArrow, 'chevron-right');
    preview.addEventListener('click', () => this.setMobileExpandedGroup(group.id, group.id));
    const buttonsEl = groupEl.createDiv({ cls: 'link-button-sidebar-settings-group__buttons' });
    group.buttons.forEach((button, buttonIndex) => this.renderButton(buttonsEl, group, button, buttonIndex));
    if (!group.buttons.length) buttonsEl.createDiv({ cls: 'link-button-sidebar-settings-group__empty', text: t('emptyGroup') });
    const addButton = groupEl.createEl('button', {
      cls: 'link-button-sidebar-settings-group__add',
      attr: { type: 'button', 'aria-label': t('addButtonToGroup') },
    });
    setIcon(addButton, 'plus');
    addButton.createSpan({ text: t('addButton') });
    addButton.setAttribute('data-focus-key', `group:${groupDomKey}:add-button`);
    addButton.addEventListener('click', () => this.addButton(group.id));
  }

  renderButton(container, group, button, buttonIndex) {
    const row = container.createDiv({ cls: 'link-button-sidebar-settings-row', attr: { 'data-button-id': button.id } });
    const buttonName = cleanText(button.label) || cleanText(button.page) || buttonIndex + 1;
    const buttonDomKey = encodeURIComponent(button.id);
    const mobileDrag = this.createDragHandle(row, t('dragButton', { name: buttonName }), { type: 'button', buttonId: button.id }, row);
    mobileDrag.addClass('link-button-sidebar-settings-row__mobile-drag');
    const dot = this.createDragHandle(row, t('chooseColorFor', { name: buttonName }), { type: 'button', buttonId: button.id }, row);
    dot.empty();
    dot.addClass('link-button-sidebar-settings-row__dot');
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('aria-haspopup', 'dialog');
    dot.setAttribute('aria-expanded', 'false');
    dot.setAttribute('data-color-button-id', button.id);
    dot.setAttribute('data-focus-key', `button:${buttonDomKey}:dot`);
    dot.style.setProperty('--link-button-sidebar-swatch', getButtonColor(button));
    new Setting(row)
      .setClass('link-button-sidebar-settings-compact-setting')
      .setClass('link-button-sidebar-settings-field--label')
      .setName(t('label'))
      .addText((text) => {
        text.setPlaceholder(t('label')).setValue(button.label).onChange((value) => {
          button.label = value;
          this.plugin.settingsChanged();
        });
        text.inputEl.setAttribute('aria-label', t('label'));
        text.inputEl.setAttribute('data-focus-key', `button:${buttonDomKey}:label`);
        text.inputEl.addEventListener('blur', () => this.plugin.flushScheduledSettingsSave());
      });
    const pageSetting = new Setting(row)
      .setClass('link-button-sidebar-settings-compact-setting')
      .setClass('link-button-sidebar-settings-field--page')
      .setName(t('page'));
    pageSetting.controlEl.addClass('link-button-sidebar-settings-wiki-input');
    pageSetting.controlEl.createSpan({ cls: 'link-button-sidebar-settings-wiki-input__bracket', text: '[[', attr: { 'aria-hidden': 'true' } });
    const pageValueEl = pageSetting.controlEl.createSpan({ cls: 'link-button-sidebar-settings-wiki-input__value' });
    let pageInputEl = null;
    let pageSizerEl = null;
    const updatePageInputSizer = (value) => {
      if (pageSizerEl) pageSizerEl.setText(asString(value));
    };
    const updatePageValidation = () => {
      const validation = validateLinkTarget(button.page);
      const description = validation.error || t('inserts', { link: makeWikiLink(validation.target) });
      pageSetting.setDesc(description);
      pageSetting.descEl.setAttribute('title', description);
      pageSetting.settingEl.toggleClass('has-error', Boolean(validation.error));
      if (pageInputEl) {
        pageInputEl.setAttribute('aria-invalid', validation.error ? 'true' : 'false');
        pageInputEl.setAttribute('title', description);
      }
      row.toggleClass('is-invalid', Boolean(validation.error));
    };
    pageSetting.addText((text) => {
      pageInputEl = text.inputEl;
      pageValueEl.appendChild(pageInputEl);
      pageSizerEl = pageValueEl.createSpan({
        cls: 'link-button-sidebar-settings-wiki-input__sizer',
        attr: { 'aria-hidden': 'true' },
      });
      pageSetting.descEl.id = `link-button-sidebar-page-desc-${buttonDomKey}`;
      pageInputEl.setAttribute('aria-describedby', pageSetting.descEl.id);
      pageInputEl.setAttribute('aria-label', t('page'));
      pageInputEl.setAttribute('data-focus-key', `button:${buttonDomKey}:page`);
      const initialValidation = validateLinkTarget(button.page);
      const displayedPage = initialValidation.error ? button.page : initialValidation.target;
      text.setPlaceholder(t('page')).setValue(displayedPage).onChange((value) => {
        const draftValidation = validateLinkTarget(value);
        button.page = draftValidation.error ? value : draftValidation.target;
        updatePageInputSizer(value);
        updatePageValidation();
        this.plugin.settingsChanged();
      });
      updatePageInputSizer(displayedPage);
      text.inputEl.addEventListener('blur', () => {
        const validation = validateLinkTarget(button.page);
        if (!validation.error) {
          button.page = validation.target;
          text.setValue(button.page);
          updatePageInputSizer(button.page);
          updatePageValidation();
        }
        this.plugin.settingsChanged();
        this.plugin.flushScheduledSettingsSave();
      });
    });
    pageSetting.controlEl.createSpan({ cls: 'link-button-sidebar-settings-wiki-input__bracket', text: ']]', attr: { 'aria-hidden': 'true' } });
    pageSetting.controlEl.addEventListener('click', (event) => {
      if (event.target === pageSetting.controlEl && pageInputEl) pageInputEl.focus();
    });
    updatePageValidation();

    const deleteButton = this.createIconButton(row, 'trash', t('deleteButton'), () => {
      this.closeAllPopovers();
      void this.deleteButton(group.id, button.id, `group:${encodeURIComponent(group.id)}:add-button`);
    }, false, true);
    deleteButton.addClass('link-button-sidebar-settings-row__delete');
    this.addClickAfterDrag(dot, () => this.openColorPopover(dot, button));
    this.registerButtonDropTarget(row, group, button);
  }

  addClickAfterDrag(handle, onClick) {
    let suppressClick = false;
    handle.addEventListener('dragstart', () => { suppressClick = true; });
    handle.addEventListener('dragend', () => {
      handle.ownerDocument.defaultView.setTimeout(() => { suppressClick = false; }, 0);
    });
    handle.addEventListener('click', (event) => {
      if (suppressClick) {
        event.preventDefault();
        return;
      }
      onClick();
    });
  }

  openColorPopover(trigger, button) {
    if (this.colorPopoverTrigger === trigger) {
      this.closeColorPopover({ restoreFocus: true });
      return;
    }
    this.closeAllPopovers();
    const documentRef = this.containerEl.ownerDocument;
    const buttonDomKey = encodeURIComponent(button.id);
    const popover = documentRef.createElement('div');
    popover.className = 'link-button-sidebar-settings-color-popover';
    popover.id = `link-button-sidebar-color-popover-${buttonDomKey}`;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    const popoverContent = popover.createDiv({ cls: 'link-button-sidebar-settings-popover__content' });
    const title = popoverContent.createDiv({ cls: 'link-button-sidebar-settings-popover__title', text: t('chooseColor') });
    title.id = `${popover.id}-title`;
    popover.setAttribute('aria-labelledby', title.id);
    const paletteEl = popoverContent.createDiv({
      cls: 'link-button-sidebar-settings-palette',
      attr: { role: 'radiogroup', 'aria-label': t('dotColor') },
    });
    const swatches = [];
    for (const color of COLOR_PALETTE) {
      const colorLabel = t(color.labelKey);
      const swatch = paletteEl.createEl('button', {
        cls: 'link-button-sidebar-settings-swatch',
        attr: { type: 'button', title: colorLabel, 'aria-label': colorLabel, role: 'radio', 'aria-checked': button.colorId === color.id ? 'true' : 'false' },
      });
      swatch.style.setProperty('--link-button-sidebar-swatch', color.css);
      swatch.toggleClass('is-selected', button.colorId === color.id);
      swatch.addEventListener('click', () => {
        button.colorId = color.id;
        this.updateButtonColorElements(button);
        this.plugin.settingsChanged();
        this.closeColorPopover({ restoreFocus: true });
      });
      swatches.push(swatch);
    }
    paletteEl.addEventListener('keydown', (event) => {
      const currentIndex = swatches.indexOf(documentRef.activeElement);
      if (currentIndex < 0) return;
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % swatches.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + swatches.length) % swatches.length;
      else if (event.key === 'ArrowDown') nextIndex = (currentIndex + 6) % swatches.length;
      else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 6 + swatches.length) % swatches.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = swatches.length - 1;
      else return;
      event.preventDefault();
      swatches[nextIndex].focus();
    });

    popoverContent.createDiv({ cls: 'link-button-sidebar-settings-popover__label', text: t('customColor') });
    const customRow = popoverContent.createDiv({ cls: 'link-button-sidebar-settings-color-popover__custom' });
    const customPicker = customRow.createEl('input', {
      cls: 'link-button-sidebar-settings-color-popover__picker',
      attr: { type: 'color', 'aria-label': t('customColor'), value: button.customColor || DEFAULT_CUSTOM_COLOR },
    });
    customPicker.value = normalizeHexColor(button.customColor) || DEFAULT_CUSTOM_COLOR;
    const customText = customRow.createEl('input', {
      cls: 'link-button-sidebar-settings-color-popover__hex',
      attr: { type: 'text', spellcheck: 'false', 'aria-label': t('customColor'), placeholder: DEFAULT_CUSTOM_COLOR },
    });
    customText.value = normalizeHexColor(button.customColor) || DEFAULT_CUSTOM_COLOR;
    const errorEl = popoverContent.createDiv({ cls: 'link-button-sidebar-settings-color-popover__error', text: t('invalidColor') });
    errorEl.hidden = true;
    const applyCustomColor = (value) => {
      const normalized = normalizeHexColor(value);
      const valid = Boolean(normalized);
      customText.setAttribute('aria-invalid', valid ? 'false' : 'true');
      customText.setAttribute('title', valid ? t('customColorHint') : t('invalidColor'));
      errorEl.hidden = valid;
      this.positionPopover(popover, trigger);
      if (!valid) return false;
      button.colorId = 'custom';
      button.customColor = normalized;
      for (const swatch of swatches) {
        swatch.removeClass('is-selected');
        swatch.setAttribute('aria-checked', 'false');
      }
      customPicker.value = normalized;
      this.updateButtonColorElements(button);
      this.plugin.settingsChanged();
      return true;
    };
    customPicker.addEventListener('input', () => {
      const normalized = normalizeHexColor(customPicker.value) || DEFAULT_CUSTOM_COLOR;
      customText.value = normalized;
      applyCustomColor(normalized);
    });
    customPicker.addEventListener('change', () => this.plugin.flushScheduledSettingsSave());
    customText.addEventListener('input', () => applyCustomColor(customText.value));
    customText.addEventListener('change', () => {
      const normalized = normalizeHexColor(customText.value);
      if (normalized) customText.value = normalized;
      this.plugin.flushScheduledSettingsSave();
    });
    customText.addEventListener('blur', () => {
      if (!normalizeHexColor(customText.value)) {
        customText.value = normalizeHexColor(button.customColor) || DEFAULT_CUSTOM_COLOR;
        customText.setAttribute('aria-invalid', 'false');
        errorEl.hidden = true;
      }
    });
    customText.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !applyCustomColor(customText.value)) return;
      event.preventDefault();
      customText.value = normalizeHexColor(customText.value);
      this.closeColorPopover({ restoreFocus: true });
    });

    documentRef.body.appendChild(popover);
    this.colorPopoverEl = popover;
    this.colorPopoverTrigger = trigger;
    trigger.setAttribute('aria-controls', popover.id);
    trigger.setAttribute('aria-expanded', 'true');
    this.colorPopoverCleanup = this.attachPopover(popover, trigger, () => this.closeColorPopover());
    const selected = swatches.find((swatch) => swatch.classList.contains('is-selected'));
    (selected || (button.colorId === 'custom' ? customText : swatches[0])).focus({ preventScroll: true });
  }

  attachPopover(popover, trigger, close) {
    const documentRef = this.containerEl.ownerDocument;
    const windowRef = documentRef.defaultView;
    const position = () => this.positionPopover(popover, trigger);
    const handlePointerDown = (event) => {
      if (!popover.contains(event.target) && !trigger.contains(event.target)) close();
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.closeColorPopover({ restoreFocus: true });
    };
    documentRef.addEventListener('pointerdown', handlePointerDown, true);
    documentRef.addEventListener('keydown', handleKeyDown, true);
    if (windowRef) {
      windowRef.addEventListener('resize', position);
      windowRef.addEventListener('scroll', position, true);
      if (windowRef.visualViewport) {
        windowRef.visualViewport.addEventListener('resize', position);
        windowRef.visualViewport.addEventListener('scroll', position);
      }
    }
    position();
    return () => {
      documentRef.removeEventListener('pointerdown', handlePointerDown, true);
      documentRef.removeEventListener('keydown', handleKeyDown, true);
      if (windowRef) {
        windowRef.removeEventListener('resize', position);
        windowRef.removeEventListener('scroll', position, true);
        if (windowRef.visualViewport) {
          windowRef.visualViewport.removeEventListener('resize', position);
          windowRef.visualViewport.removeEventListener('scroll', position);
        }
      }
    };
  }

  positionPopover(popover, trigger) {
    if (!popover || !trigger || !popover.isConnected || !trigger.isConnected) return;
    const documentRef = this.containerEl.ownerDocument;
    const windowRef = documentRef.defaultView;
    const visualViewport = windowRef ? windowRef.visualViewport : null;
    const viewportLeft = visualViewport ? visualViewport.offsetLeft : 0;
    const viewportTop = visualViewport ? visualViewport.offsetTop : 0;
    const viewportWidth = visualViewport ? visualViewport.width : windowRef ? windowRef.innerWidth : documentRef.documentElement.clientWidth;
    const viewportHeight = visualViewport ? visualViewport.height : windowRef ? windowRef.innerHeight : documentRef.documentElement.clientHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const gutter = 8;
    const gap = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const triggerStyle = windowRef ? windowRef.getComputedStyle(trigger) : null;
    if (
      triggerRect.width === 0
      || triggerRect.height === 0
      || triggerRect.bottom <= viewportTop
      || triggerRect.top >= viewportBottom
      || (triggerStyle && (triggerStyle.display === 'none' || triggerStyle.visibility === 'hidden'))
    ) {
      this.closeColorPopover();
      return;
    }
    const popoverContent = popover.querySelector('.link-button-sidebar-settings-popover__content');
    if (popoverContent) popoverContent.style.maxHeight = `${Math.max(48, viewportHeight - gutter * 2 - 2)}px`;
    const popoverRect = popover.getBoundingClientRect();
    const preferredLeft = triggerRect.left - 14;
    const left = Math.min(
      Math.max(viewportLeft + gutter, preferredLeft),
      Math.max(viewportLeft + gutter, viewportRight - popoverRect.width - gutter),
    );
    const fitsBelow = triggerRect.bottom + gap + popoverRect.height <= viewportBottom - gutter;
    const placeAbove = !fitsBelow && triggerRect.top - gap - popoverRect.height >= viewportTop + gutter;
    const top = placeAbove
      ? triggerRect.top - gap - popoverRect.height
      : Math.min(triggerRect.bottom + gap, Math.max(viewportTop + gutter, viewportBottom - popoverRect.height - gutter));
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.setProperty('--link-button-sidebar-popover-arrow-left', `${Math.round(triggerRect.left + triggerRect.width / 2 - left)}px`);
    popover.toggleClass('is-above', placeAbove);
  }

  closeColorPopover({ restoreFocus = false } = {}) {
    const trigger = this.colorPopoverTrigger;
    if (this.colorPopoverCleanup) this.colorPopoverCleanup();
    if (this.colorPopoverEl) this.colorPopoverEl.remove();
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-controls');
    }
    this.colorPopoverEl = null;
    this.colorPopoverTrigger = null;
    this.colorPopoverCleanup = null;
    if (restoreFocus && trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  }

  closeAllPopovers() {
    this.closeColorPopover();
  }

  updateButtonColorElements(button) {
    const color = getButtonColor(button);
    for (const element of this.containerEl.querySelectorAll('[data-color-button-id]')) {
      if (element.getAttribute('data-color-button-id') === button.id) {
        element.style.setProperty('--link-button-sidebar-swatch', color);
      }
    }
    if (this.colorPopoverTrigger) this.colorPopoverTrigger.style.setProperty('--link-button-sidebar-swatch', color);
  }

  setMobileExpandedGroup(groupId, focusGroupId = '') {
    this.expandedMobileGroupId = groupId;
    this.containerEl.toggleClass('has-mobile-expanded-group', Boolean(groupId));
    let focusTarget = null;
    for (const groupEl of this.containerEl.querySelectorAll('.link-button-sidebar-settings-group')) {
      const isExpanded = groupEl.getAttribute('data-group-id') === groupId;
      groupEl.toggleClass('is-mobile-expanded', isExpanded);
      const toggle = groupEl.querySelector('.link-button-sidebar-settings-group__mobile-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      if (groupEl.getAttribute('data-group-id') === focusGroupId) {
        focusTarget = isExpanded
          ? groupEl.querySelector('.link-button-sidebar-settings-group__mobile-back')
          : toggle;
      }
    }
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  createIconButton(container, icon, label, onClick, disabled = false, danger = false, focusKey = '', focusFallback = '') {
    const button = container.createEl('button', {
      cls: danger ? 'link-button-sidebar-settings-icon-button is-danger' : 'link-button-sidebar-settings-icon-button',
      attr: { type: 'button', title: label, 'aria-label': label },
    });
    setIcon(button, icon);
    if (focusKey) button.setAttribute('data-focus-key', focusKey);
    if (focusFallback) button.setAttribute('data-focus-fallback', focusFallback);
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  }

  createDragHandle(container, label, state, visualElement) {
    const handle = container.createEl('button', {
      cls: 'link-button-sidebar-settings-drag-handle',
      attr: { type: 'button', title: label, 'aria-label': label, draggable: 'true', tabindex: '-1' },
    });
    setIcon(handle, 'grip-vertical');
    handle.addEventListener('dragstart', (event) => {
      this.dragState = state;
      visualElement.addClass('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(state));
      }
    });
    handle.addEventListener('dragend', () => {
      this.dragState = null;
      visualElement.removeClass('is-dragging');
      this.clearDropIndicators();
    });
    return handle;
  }

  registerGroupDropTarget(groupEl, group) {
    groupEl.addEventListener('dragover', (event) => {
      if (!this.dragState || (this.dragState.type === 'group' && this.dragState.groupId === group.id)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      if (this.dragState.type === 'group') this.showDropIndicator(groupEl, event);
      else {
        this.clearDropIndicators();
        groupEl.addClass('is-drop-inside');
      }
    });
    groupEl.addEventListener('dragleave', (event) => {
      if (!groupEl.contains(event.relatedTarget)) this.removeDropIndicator(groupEl);
    });
    groupEl.addEventListener('drop', (event) => {
      if (!this.dragState) return;
      event.preventDefault();
      this.removeDropIndicator(groupEl);
      let changed = false;
      if (this.dragState.type === 'group') changed = moveGroup(this.plugin.settings, this.dragState.groupId, group.id, this.isAfterMidpoint(groupEl, event));
      else if (this.dragState.type === 'button') changed = moveButton(this.plugin.settings, this.dragState.buttonId, group.id);
      if (changed) this.commitStructuralChange();
    });
  }

  registerButtonDropTarget(row, group, button) {
    row.addEventListener('dragover', (event) => {
      if (!this.dragState || this.dragState.type !== 'button' || this.dragState.buttonId === button.id) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.showDropIndicator(row, event);
    });
    row.addEventListener('dragleave', (event) => {
      if (!row.contains(event.relatedTarget)) this.removeDropIndicator(row);
    });
    row.addEventListener('drop', (event) => {
      if (!this.dragState || this.dragState.type !== 'button') return;
      event.preventDefault();
      event.stopPropagation();
      const changed = moveButton(this.plugin.settings, this.dragState.buttonId, group.id, button.id, this.isAfterMidpoint(row, event));
      if (changed) this.commitStructuralChange();
    });
  }

  isAfterMidpoint(element, event) {
    const rect = element.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2;
  }
  showDropIndicator(element, event) {
    this.clearDropIndicators();
    element.addClass(this.isAfterMidpoint(element, event) ? 'is-drop-after' : 'is-drop-before');
  }
  removeDropIndicator(element) { element.removeClass('is-drop-before', 'is-drop-after', 'is-drop-inside'); }
  clearDropIndicators() {
    for (const element of this.containerEl.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-inside')) {
      element.removeClass('is-drop-before', 'is-drop-after', 'is-drop-inside');
    }
  }

  addGroup() {
    const usedIds = new Set(this.plugin.settings.groups.map((group) => group.id));
    this.plugin.settings.groups.push({
      id: createUniqueId('group', usedIds),
      name: t('groupNumber', { number: this.plugin.settings.groups.length + 1 }),
      buttons: [],
    });
    this.commitStructuralChange();
  }
  addButton(groupId) {
    const group = findGroup(this.plugin.settings, groupId);
    if (!group) return;
    const usedIds = new Set(getAllButtons(this.plugin.settings).map((button) => button.id));
    group.buttons.push({
      id: createUniqueId('button', usedIds),
      label: t('newButton'),
      page: t('newPage'),
      colorId: 'accent',
      customColor: DEFAULT_CUSTOM_COLOR,
    });
    this.commitStructuralChange();
  }
  moveGroupByOffset(groupId, offset) {
    const groups = this.plugin.settings.groups;
    const sourceIndex = groups.findIndex((group) => group.id === groupId);
    const targetIndex = sourceIndex + offset;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= groups.length) return;
    [groups[sourceIndex], groups[targetIndex]] = [groups[targetIndex], groups[sourceIndex]];
    this.commitStructuralChange();
  }

  async deleteButton(groupId, buttonId, preferredFocusKey = '') {
    const group = findGroup(this.plugin.settings, groupId);
    if (!group) return;
    const index = group.buttons.findIndex((button) => button.id === buttonId);
    if (index < 0) return;
    const [removedButton] = group.buttons.splice(index, 1);
    const groupName = group.name;
    this.redisplayPreservingScroll(preferredFocusKey);
    await this.plugin.saveSettingsAndRefresh();
    this.showUndoNotice(t('buttonDeleted'), async () => {
      let destination = findGroup(this.plugin.settings, groupId);
      if (!destination) {
        destination = { id: groupId, name: groupName, buttons: [] };
        this.plugin.settings.groups.push(destination);
      }
      if (!findButtonLocation(this.plugin.settings, removedButton.id)) destination.buttons.splice(Math.min(index, destination.buttons.length), 0, removedButton);
      this.redisplayPreservingScroll();
      await this.plugin.saveSettingsAndRefresh();
    });
  }

  async deleteGroup(groupId) {
    let index = this.plugin.settings.groups.findIndex((group) => group.id === groupId);
    if (index < 0) return;
    const group = this.plugin.settings.groups[index];
    const confirmed = await confirmAction(this.app, {
      title: t('deleteGroupTitle'),
      message: group.buttons.length
        ? t('deleteGroupMessage', {
          name: group.name, count: group.buttons.length, button: plural('buttonAccusativeForms', group.buttons.length),
        })
        : t('deleteEmptyGroup', { name: group.name }),
      confirmText: t('deleteGroupConfirm'),
    });
    if (!confirmed) return;
    index = this.plugin.settings.groups.findIndex((group) => group.id === groupId);
    if (index < 0) return;
    const [removedGroup] = this.plugin.settings.groups.splice(index, 1);
    const nextGroup = this.plugin.settings.groups[index] || this.plugin.settings.groups[index - 1];
    this.redisplayPreservingScroll(nextGroup ? `group:${encodeURIComponent(nextGroup.id)}:name` : 'settings:add-group');
    await this.plugin.saveSettingsAndRefresh();
    this.showUndoNotice(t('groupDeleted'), async () => {
      let destination = findGroup(this.plugin.settings, removedGroup.id);
      if (!destination) {
        destination = { ...removedGroup, buttons: [] };
        this.plugin.settings.groups.splice(Math.min(index, this.plugin.settings.groups.length), 0, destination);
      }
      const existingIds = new Set(getAllButtons(this.plugin.settings).map((button) => button.id));
      removedGroup.buttons.forEach((button, buttonIndex) => {
        if (existingIds.has(button.id)) return;
        destination.buttons.splice(Math.min(buttonIndex, destination.buttons.length), 0, button);
        existingIds.add(button.id);
      });
      this.redisplayPreservingScroll();
      await this.plugin.saveSettingsAndRefresh();
    });
  }

  async resetExamples() {
    const confirmed = await confirmAction(this.app, {
      title: t('resetTitle'),
      message: t('resetMessage'),
      confirmText: t('resetConfirm'),
    });
    if (!confirmed) return;
    const previousGroups = cloneJson(this.plugin.settings.groups);
    this.plugin.settings.groups = createDefaultSettings().groups;
    this.redisplayPreservingScroll();
    await this.plugin.saveSettingsAndRefresh();
    this.showUndoNotice(t('examplesRestored'), async () => {
      this.plugin.settings.groups = previousGroups;
      this.redisplayPreservingScroll();
      await this.plugin.saveSettingsAndRefresh();
    });
  }

  commitStructuralChange(preferredFocusKey = '') {
    this.redisplayPreservingScroll(preferredFocusKey);
    void this.plugin.saveSettingsAndRefresh();
  }
  redisplayPreservingScroll(preferredFocusKey = '') {
    const activeElement = this.containerEl.ownerDocument.activeElement;
    const focusKey = preferredFocusKey || (
      activeElement && this.containerEl.contains(activeElement)
        ? activeElement.getAttribute('data-focus-key') || ''
        : ''
    );
    const capturedFallback = activeElement && this.containerEl.contains(activeElement)
      ? activeElement.getAttribute('data-focus-fallback') || ''
      : '';
    renderPreservingScroll(this.containerEl, () => {
      this.display();
      if (!focusKey) return;
      const focusableElements = Array.from(this.containerEl.querySelectorAll('[data-focus-key]'));
      let target = focusableElements.find((element) => element.getAttribute('data-focus-key') === focusKey);
      if (target && target.disabled) {
        const fallbackKey = capturedFallback || target.getAttribute('data-focus-fallback') || '';
        target = focusableElements.find((element) => element.getAttribute('data-focus-key') === fallbackKey);
      }
      if (target && !target.disabled) target.focus({ preventScroll: true });
    });
  }
  showUndoNotice(message, undo) {
    if (this.plugin.isUnloading) return;
    const documentRef = this.containerEl.ownerDocument;
    const windowRef = documentRef.defaultView;
    if (!this.undoNoticeHost) {
      const host = documentRef.body.createDiv({ cls: 'link-button-sidebar-undo-notices' });
      this.undoNoticeHost = host;
      const viewport = windowRef.visualViewport;
      const position = () => {
        const bottomInset = viewport ? Math.max(0, windowRef.innerHeight - viewport.offsetTop - viewport.height) : 0;
        host.style.setProperty('--link-button-sidebar-keyboard-inset', `${bottomInset}px`);
      };
      position();
      windowRef.addEventListener('resize', position);
      if (viewport) {
        viewport.addEventListener('resize', position);
        viewport.addEventListener('scroll', position);
      }
      this.undoNoticeHostCleanup = () => {
        windowRef.removeEventListener('resize', position);
        if (viewport) {
          viewport.removeEventListener('resize', position);
          viewport.removeEventListener('scroll', position);
        }
        host.remove();
        this.undoNoticeHost = null;
        this.undoNoticeHostCleanup = null;
      };
    }
    const notice = this.undoNoticeHost.createDiv({ cls: 'link-button-sidebar-undo-notice' });
    notice.createSpan({ text: message, attr: { role: 'status', 'aria-live': 'polite' } });
    const undoButton = notice.createEl('button', {
      cls: 'link-button-sidebar-undo-button', text: t('undo'), attr: { type: 'button' },
    });
    const close = () => {
      windowRef.clearTimeout(timer);
      notice.remove();
      this.undoNoticeCleanups.delete(close);
      if (!this.undoNoticeCleanups.size && this.undoNoticeHostCleanup) this.undoNoticeHostCleanup();
    };
    this.undoNoticeCleanups.add(close);
    const timer = windowRef.setTimeout(close, 8000);
    undoButton.addEventListener('click', () => {
      if (undoButton.disabled || this.plugin.isUnloading) return;
      undoButton.disabled = true;
      windowRef.clearTimeout(timer);
      Promise.resolve().then(undo).catch((error) => {
        console.error('Link Button Sidebar: undo failed.', error);
        new Notice(t('undoError'));
      }).finally(close);
    });
  }
  closeUndoNotices() {
    for (const close of this.undoNoticeCleanups) close();
  }
}

module.exports = class LinkButtonSidebarPlugin extends Plugin {
  async onload() {
    this.isUnloading = false;
    this.saveQueue = Promise.resolve();
    this.hasPendingSettingsSave = false;
    this.refreshViewsDebounced = debounce(() => this.refreshViews(false), VIEW_REFRESH_DELAY, true);
    this.saveSettingsDebounced = debounce(() => {
      this.hasPendingSettingsSave = false;
      void this.enqueueSettingsSave();
    }, SETTINGS_SAVE_DELAY, true);
    await this.loadSettings();
    this.register(() => {
      this.refreshViewsDebounced.cancel();
      this.flushScheduledSettingsSave();
    });
    this.registerView(VIEW_TYPE_LINK_BUTTON_SIDEBAR, (leaf) => new LinkButtonSidebarView(leaf, this));
    this.addRibbonIcon('links-coming-in', t('openPlugin'), () => void this.activateView());
    this.addCommand({ id: 'open-sidebar', name: t('openSidebar'), callback: () => this.activateView() });
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refreshViewsDebounced()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.refreshViewsDebounced()));
    this.registerEvent(this.app.workspace.on('editor-change', () => this.refreshViewsDebounced()));
    this.registerEvent(this.app.metadataCache.on('resolved', () => {
      this.linkCountsCache = null;
      this.refreshViewsDebounced();
    }));
    const settingsTab = new LinkButtonSidebarSettingTab(this.app, this);
    this.addSettingTab(settingsTab);
    this.register(() => {
      settingsTab.closeAllPopovers();
      settingsTab.closeUndoNotices();
    });
    this.app.workspace.onLayoutReady(() => {
      if (!this.isUnloading && this.settings.openOnStartup) void this.activateView();
    });
  }
  onunload() {
    this.isUnloading = true;
    this.linkCountsCache = null;
  }
  async activateView() {
    try {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_LINK_BUTTON_SIDEBAR);
      if (existing.length) {
        await Promise.resolve(this.app.workspace.revealLeaf(existing[0]));
        return;
      }
      const leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice(t('rightSidebarError'));
        return;
      }
      await leaf.setViewState({ type: VIEW_TYPE_LINK_BUTTON_SIDEBAR, active: true });
      await Promise.resolve(this.app.workspace.revealLeaf(leaf));
    } catch (error) {
      console.error('Link Button Sidebar: failed to open the sidebar.', error);
      new Notice(t('pluginOpenError'));
    }
  }
  getTargetMarkdownView() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file) return activeView;
    const recentLeaf = typeof this.app.workspace.getMostRecentLeaf === 'function' ? this.app.workspace.getMostRecentLeaf() : null;
    return recentLeaf && recentLeaf.view instanceof MarkdownView && recentLeaf.view.file ? recentLeaf.view : null;
  }
  async insertLink(page) {
    const validation = validateLinkTarget(page);
    if (validation.error) {
      new Notice(validation.error);
      return;
    }
    const view = this.getTargetMarkdownView();
    if (!view || !view.editor) {
      new Notice(t('openMarkdownFirst'));
      return;
    }
    const editor = view.editor;
    const from = editor.getCursor('from');
    const to = editor.getCursor('to');
    const selection = editor.getSelection();
    const canUseAlias = Boolean(cleanText(selection)) && this.settings.useSelectionAsAlias && !/[\r\n]/.test(selection);
    const inTable = isMarkdownTableRow(editor, from.line);
    const newParagraphAfterLink = this.settings.newParagraphAfterLink && !inTable;
    const insertionEnd = canUseAlias ? to : from;
    const followingEndLine = Math.min(editor.lastLine(), insertionEnd.line + 2);
    const startOffset = newParagraphAfterLink ? editor.posToOffset(from) : 0;
    const plan = buildInsertionPlan({
      page: validation.target,
      selection,
      leftCharacter: getCharacterBefore(editor, from),
      rightCharacter: canUseAlias ? getCharacterAfter(editor, to) : selection.length > 0 ? selection.charAt(0) : getCharacterAfter(editor, from),
      insertSpaceAfterLink: this.settings.insertSpaceAfterLink,
      newParagraphAfterLink,
      followingText: newParagraphAfterLink ? editor.getRange(insertionEnd, { line: followingEndLine, ch: editor.getLine(followingEndLine).length }) : '',
      useSelectionAsAlias: this.settings.useSelectionAsAlias,
      escapeAliasSeparator: canUseAlias && inTable,
    });
    if (!plan.text) {
      new Notice(t('invalidLink'));
      return;
    }
    if (plan.replaceSelection) editor.replaceSelection(plan.text);
    else editor.replaceRange(plan.text, from);
    if (newParagraphAfterLink) editor.setCursor(editor.offsetToPos(startOffset + plan.text.length + plan.cursorAdvance));
    editor.focus();
    this.refreshViewsDebounced();
  }
  async loadSettings() {
    let rawData = null;
    this.settingsLoadFailed = false;
    try {
      rawData = await this.loadData();
    } catch (error) {
      this.settingsLoadFailed = true;
      console.error('Link Button Sidebar: failed to load settings.', error);
      new Notice(t('loadError'));
    }
    const normalized = normalizeSettings(rawData);
    this.settings = normalized.settings;
    if (normalized.futureVersion) {
      new Notice(t('futureNotice'));
      this.readOnlyFutureSettings = true;
      return;
    }
    this.readOnlyFutureSettings = false;
    if (normalized.changed && !this.settingsLoadFailed) await this.enqueueSettingsSave();
  }
  settingsChanged(refreshViews = true) {
    if (this.readOnlyFutureSettings || this.settingsLoadFailed) return;
    if (refreshViews) this.refreshViews(true);
    this.hasPendingSettingsSave = true;
    this.saveSettingsDebounced();
  }
  flushScheduledSettingsSave() {
    if (!this.hasPendingSettingsSave) return;
    this.saveSettingsDebounced.cancel();
    this.hasPendingSettingsSave = false;
    void this.enqueueSettingsSave();
  }
  async saveSettingsAndRefresh() {
    this.saveSettingsDebounced.cancel();
    this.hasPendingSettingsSave = false;
    this.refreshViews(true);
    return this.enqueueSettingsSave();
  }
  enqueueSettingsSave() {
    if (this.readOnlyFutureSettings || this.settingsLoadFailed) return Promise.resolve(false);
    const snapshot = cloneJson(this.settings);
    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(() => this.saveData(snapshot))
      .then(() => true)
      .catch((error) => {
        console.error('Link Button Sidebar: failed to save settings.', error);
        new Notice(t('saveError'));
        return false;
      });
    return this.saveQueue;
  }
  refreshViews(rebuildStructure = false) {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_LINK_BUTTON_SIDEBAR)) {
      if (!(leaf.view instanceof LinkButtonSidebarView)) continue;
      if (rebuildStructure) leaf.view.render();
      else leaf.view.updateState();
    }
  }
  getLinkCounts(content, sourcePath) {
    const cached = this.linkCountsCache;
    if (cached && cached.content === content && cached.sourcePath === sourcePath) return cached.counts;
    const counts = buildLinkCounts(this.app, content, sourcePath);
    this.linkCountsCache = { content, sourcePath, counts };
    return counts;
  }
};
