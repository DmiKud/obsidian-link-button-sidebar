const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const packaging = import('../scripts/package.mjs');

function createFixture(t) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'link-button-sidebar-package-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  for (const file of ['manifest.json', 'package.json', 'versions.json']) {
    fs.copyFileSync(path.join(root, file), path.join(fixture, file));
  }
  fs.writeFileSync(path.join(fixture, 'main.js'), 'module.exports = class Plugin {};\n');
  fs.writeFileSync(path.join(fixture, 'styles.css'), '.example { color: red; }\n');
  return fixture;
}

test('release metadata is internally consistent', async () => {
  const manifest = readJson('manifest.json');
  const packageJson = readJson('package.json');
  const versions = readJson('versions.json');

  const { validateMetadata } = await packaging;
  assert.equal(validateMetadata(manifest, packageJson, versions), manifest.version);
  assert.equal(manifest.isDesktopOnly, false);
  assert.match(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'), /^MIT License\r?\n/);
});

test('invalid release metadata is rejected', async () => {
  const { validateMetadata } = await packaging;
  const manifest = readJson('manifest.json');
  const packageJson = readJson('package.json');
  const versions = readJson('versions.json');
  const invalidManifests = [
    { ...manifest, id: '../outside' },
    { ...manifest, id: 'obsidian-example' },
    { ...manifest, version: 'v0.2.0' },
    { ...manifest, version: '0.2.0-beta.1' },
    { ...manifest, minAppVersion: 'invalid' },
    { ...manifest, author: '' },
    { ...manifest, isDesktopOnly: 'false' },
  ];
  for (const invalid of invalidManifests) {
    assert.throws(() => validateMetadata(invalid, packageJson, versions));
  }
  assert.throws(() => validateMetadata(manifest, { ...packageJson, version: '9.9.9' }, versions), /must match/);
  assert.throws(() => validateMetadata(manifest, { ...packageJson, license: '' }, versions), /MIT/);
  assert.throws(() => validateMetadata(manifest, packageJson, {}), /current version/);
  assert.throws(() => validateMetadata(manifest, packageJson, { ...versions, bad: '1.4.0' }), /must map/);
  assert.throws(() => validateMetadata(null, packageJson, versions), /JSON objects/);
});

test('packaging copies exactly the three installable assets without modifying sources', async (t) => {
  const { packagePlugin, RELEASE_FILES } = await packaging;
  const fixture = createFixture(t);
  const originals = new Map(RELEASE_FILES.map((file) => [file, fs.readFileSync(path.join(fixture, file))]));
  const result = await packagePlugin(fixture);
  assert.equal(result.directory, path.join(fixture, 'release', readJson('manifest.json').version));
  assert.deepEqual(fs.readdirSync(result.directory).sort(), [...RELEASE_FILES].sort());
  for (const file of RELEASE_FILES) {
    assert.deepEqual(fs.readFileSync(path.join(result.directory, file)), originals.get(file));
    assert.deepEqual(fs.readFileSync(path.join(fixture, file)), originals.get(file));
  }
  await packagePlugin(fixture);
  assert.deepEqual(fs.readdirSync(result.directory).sort(), [...RELEASE_FILES].sort());
});

test('packaging fails before creating output when metadata or a source is invalid', async (t) => {
  const { packagePlugin } = await packaging;
  const fixture = createFixture(t);
  fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ ...readJson('package.json'), version: '9.9.9' }));
  await assert.rejects(packagePlugin(fixture), /must match/);
  assert.equal(fs.existsSync(path.join(fixture, 'release')), false);
  fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
  fs.writeFileSync(path.join(fixture, 'main.js'), '');
  await assert.rejects(packagePlugin(fixture), /non-empty regular file/);
  assert.equal(fs.existsSync(path.join(fixture, 'release')), false);
});

test('packaging preserves unexpected files instead of deleting them', async (t) => {
  const { packagePlugin } = await packaging;
  const fixture = createFixture(t);
  const { directory } = await packagePlugin(fixture);
  const extra = path.join(directory, 'notes.txt');
  fs.writeFileSync(extra, 'Keep this file.');
  await assert.rejects(packagePlugin(fixture), /Unexpected release output/);
  assert.equal(fs.readFileSync(extra, 'utf8'), 'Keep this file.');
});

test('all manual-install release files exist', () => {
  for (const file of ['manifest.json', 'main.js', 'styles.css']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
});

test('the old duplicate cross marker is not present in production assets', () => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.equal(main.includes('is-present-multiple'), false);
  assert.equal(styles.includes('is-present-multiple'), false);
  assert.equal(styles.includes("content: '×'"), false);
});
