#!/usr/bin/env node
/** @format */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultFile = fileURLToPath(
  new URL('../fixtures/opencode-session-01.ndjson', import.meta.url)
);
const targetFile = resolve(process.argv[2] ?? defaultFile);

let content;
try {
  content = readFileSync(targetFile, 'utf8');
} catch (err) {
  console.error(`[analyze-spool] Cannot read ${targetFile}: ${err.message}`);
  process.exit(1);
}

const counts = new Map();
let total = 0;
let invalid = 0;

for (const line of content.split(/\r?\n/)) {
  if (!line.trim()) continue;
  total += 1;

  try {
    const event = JSON.parse(line);
    const type = typeof event?.type === 'string' ? event.type : '<missing-type>';
    counts.set(type, (counts.get(type) ?? 0) + 1);
  } catch {
    invalid += 1;
  }
}

const rows = [...counts.entries()].sort(
  (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
);

console.log(`File: ${targetFile}`);
console.log(`Events: ${total} (invalid lines: ${invalid})`);
console.log('');
console.log('Count   Share   Type');

for (const [type, count] of rows) {
  const share = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  console.log(`${String(count).padStart(5)}   ${share.padStart(5)}%  ${type}`);
}
