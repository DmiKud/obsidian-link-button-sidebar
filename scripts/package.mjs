import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_FILES = Object.freeze(['main.js', 'manifest.json', 'styles.css']);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateMetadata(manifest, packageJson, versions) {
  if (![manifest, packageJson, versions].every(isRecord)) {
    throw new Error('manifest.json, package.json, and versions.json must contain JSON objects.');
  }
  for (const field of ['id', 'name', 'version', 'minAppVersion', 'description', 'author']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim() || manifest[field] !== manifest[field].trim()) {
      throw new Error(`manifest.json: ${field} must be a non-empty string without surrounding whitespace.`);
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || manifest.id.includes('obsidian')) {
    throw new Error('manifest.json: id must use lowercase letters, numbers, and hyphens, and cannot contain "obsidian".');
  }
  if (!versionPattern.test(manifest.version) || !versionPattern.test(manifest.minAppVersion)) {
    throw new Error('manifest.json: version and minAppVersion must use the format x.y.z.');
  }
  if (typeof manifest.isDesktopOnly !== 'boolean') {
    throw new Error('manifest.json: isDesktopOnly must be a boolean.');
  }
  if (packageJson.version !== manifest.version) {
    throw new Error('package.json version must match manifest.json version.');
  }
  if (packageJson.license !== 'MIT') {
    throw new Error('package.json license must remain MIT.');
  }
  for (const [version, minAppVersion] of Object.entries(versions)) {
    if (!versionPattern.test(version) || typeof minAppVersion !== 'string' || !versionPattern.test(minAppVersion)) {
      throw new Error('versions.json must map x.y.z plugin versions to x.y.z minimum app versions.');
    }
  }
  if (versions[manifest.version] !== manifest.minAppVersion) {
    throw new Error('versions.json must include the current version and matching minAppVersion.');
  }
  return manifest.version;
}

async function ensureDirectory(directory) {
  await mkdir(directory).catch((error) => {
    if (error.code !== 'EEXIST') throw error;
  });
  if (!(await lstat(directory)).isDirectory()) {
    throw new Error(`Release output must be a directory, not a file or symbolic link: ${directory}`);
  }
}

export async function packagePlugin(root = projectRoot) {
  const [manifest, packageJson, versions] = await Promise.all(
    ['manifest.json', 'package.json', 'versions.json'].map(async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'))),
  );
  const version = validateMetadata(manifest, packageJson, versions);
  for (const file of RELEASE_FILES) {
    const source = await lstat(path.join(root, file));
    if (!source.isFile() || !source.size) throw new Error(`Release source must be a non-empty regular file: ${file}`);
  }

  const releaseRoot = path.join(root, 'release');
  const directory = path.join(releaseRoot, version);
  await ensureDirectory(releaseRoot);
  await ensureDirectory(directory);
  for (const file of await readdir(directory)) {
    if (!RELEASE_FILES.includes(file) || !(await lstat(path.join(directory, file))).isFile()) {
      throw new Error(`Unexpected release output; move it out before packaging: ${path.join(directory, file)}`);
    }
  }
  for (const file of RELEASE_FILES) {
    await copyFile(path.join(root, file), path.join(directory, file));
  }
  return { version, directory, files: [...RELEASE_FILES] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packagePlugin().then(({ version, directory, files }) => {
    console.log(`Packaged ${version} in ${directory}: ${files.join(', ')}`);
  }).catch((error) => {
    console.error(`Packaging failed: ${error.message}`);
    process.exitCode = 1;
  });
}
