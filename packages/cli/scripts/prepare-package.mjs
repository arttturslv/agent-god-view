#!/usr/bin/env node
/** @format */

import { cp, copyFile, rm, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '..', '..');
const required = process.argv.includes('--required');

const uiDist = resolve(repoRoot, 'packages', 'ui', 'dist');
const uiTarget = resolve(packageDir, 'ui-dist');

const rootPostinstall = resolve(repoRoot, 'scripts', 'postinstall.mjs');
const pkgPostinstall = resolve(packageDir, 'scripts', 'postinstall.mjs');
const postinstallSource = existsSync(rootPostinstall) ? rootPostinstall : pkgPostinstall;

const assets = [
  { source: resolve(packageDir, 'README.md'), target: resolve(packageDir, 'README.md') },
  { source: resolve(repoRoot, 'LICENSE'), target: resolve(packageDir, 'LICENSE') },
  { source: postinstallSource, target: pkgPostinstall },
];

let failed = false;

for (const asset of assets) {
  if (!existsSync(asset.source)) {
    console.error(`[agent-god-view] Missing ${asset.source}`);
    failed = true;
    continue;
  }
  const targetDir = dirname(asset.target);
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }
  await copyFile(asset.source, asset.target);
}

if (existsSync(uiDist) && (await stat(uiDist)).isDirectory()) {
  await rm(uiTarget, { recursive: true, force: true });
  await cp(uiDist, uiTarget, { recursive: true });
  console.log(`[agent-god-view] Copied UI build to ${uiTarget}`);
} else {
  console.error(`[agent-god-view] Missing UI build at ${uiDist}`);
  failed = true;
}

const nativeBinaryNames = ['agent-god-view-shell.exe', 'agent-god-view-shell', 'Agent God View.exe'];
let binaryFound = false;
for (const root of [repoRoot, resolve(packageDir, '..', '..')]) {
  for (const profile of ['release', 'debug']) {
    for (const name of nativeBinaryNames) {
      const srcBin = resolve(root, 'packages', 'shell', 'src-tauri', 'target', profile, name);
      if (existsSync(srcBin)) {
        const binDir = resolve(packageDir, 'bin');
        if (!existsSync(binDir)) {
          await mkdir(binDir, { recursive: true });
        }
        const targetBin = resolve(binDir, name);
        await copyFile(srcBin, targetBin);
        console.log(`[agent-god-view] Copied native binary ${name} to ${targetBin}`);
        binaryFound = true;
      }
    }
  }
}

if (!binaryFound) {
  console.log(`[agent-god-view] Notice: Precompiled native Tauri binary not found locally (will be downloaded on postinstall if needed).`);
}

if (failed && required) {
  process.exit(1);
}
