#!/usr/bin/env node
/** @format */

import { cp, copyFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '..', '..');
const required = process.argv.includes('--required');

const uiDist = resolve(repoRoot, 'packages', 'ui', 'dist');
const uiTarget = resolve(packageDir, 'ui-dist');

const assets = [
  { source: resolve(repoRoot, 'README.md'), target: resolve(packageDir, 'README.md') },
  { source: resolve(repoRoot, 'LICENSE'), target: resolve(packageDir, 'LICENSE') },
];

let failed = false;

for (const asset of assets) {
  if (!existsSync(asset.source)) {
    console.error(`[agent-god-view] Missing ${asset.source}`);
    failed = true;
    continue;
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

if (failed && required) {
  process.exit(1);
}
