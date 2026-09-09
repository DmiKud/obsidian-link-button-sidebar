import js from '@eslint/js';
import globals from 'globals';
import obsidian from 'eslint-plugin-obsidianmd';

export default [
  { ignores: ['node_modules/**', 'release/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2022 },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['main.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.browser, ...globals.commonjs } },
    plugins: { obsidianmd: obsidian },
    // Official rules for plain JavaScript; type-aware rules require a TS project.
    rules: { ...obsidian.ruleConfigs.recommended, 'obsidianmd/no-nodejs-modules': 'error' },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
];
