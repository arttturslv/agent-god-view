#!/usr/bin/env node
/** @format */

import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get as httpGet } from 'node:https';
import { pipeline } from 'node:stream/promises';

const __filename = fileURLToPath(import.meta.url);
const packageDir = resolve(__filename, '..', '..');
const binDir = resolve(packageDir, 'bin');

function nativeBinaryName() {
  return process.platform === 'win32'
    ? 'agent-god-view-shell.exe'
    : 'agent-god-view-shell';
}

const targetPath = resolve(binDir, nativeBinaryName());

async function main() {
  if (existsSync(targetPath)) {
    console.log(`[agent-god-view] Native binary already present at ${targetPath}`);
    return;
  }

  console.log(`[agent-god-view] Native binary not found at ${targetPath}. Attempting optional download...`);

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  const version = 'v0.1.0';
  const binName = nativeBinaryName();
  const downloadUrl = `https://github.com/arttturslv/agent-god-view/releases/download/${version}/${binName}`;

  try {
    await downloadFile(downloadUrl, targetPath);
    console.log(`[agent-god-view] Successfully downloaded native binary to ${targetPath}`);
  } catch (err) {
    console.log(`[agent-god-view] Could not download native binary from GitHub releases (${err.message}). Falling back to localhost server mode without failing installation.`);
  }
}

function downloadFile(url, dest) {
  return new Promise((resolveDownload, rejectDownload) => {
    const request = httpGet(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, dest).then(resolveDownload).catch(rejectDownload);
        return;
      }
      if (response.statusCode !== 200) {
        rejectDownload(new Error(`Status code ${response.statusCode}`));
        return;
      }
      const fileStream = createWriteStream(dest, { mode: 0o755 });
      pipeline(response, fileStream)
        .then(() => resolveDownload())
        .catch(rejectDownload);
    });
    request.on('error', rejectDownload);
    request.setTimeout(15000, () => {
      request.destroy(new Error('Download timeout'));
    });
  });
}

main().catch(() => {
  process.exit(0);
});
