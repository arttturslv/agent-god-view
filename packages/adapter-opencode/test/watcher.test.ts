/** @format */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { watchProject } from '../src/watcher.js';

describe('adapter-opencode watcher', () => {
  it('creates and closes watcher without throwing', async () => {
    const fixtureDir = resolve(process.cwd(), '../../fixtures/project-basic');
    const watcher = watchProject(fixtureDir, (project) => {
      // callback
    });

    expect(watcher).toBeDefined();
    expect(typeof watcher.close).toBe('function');

    await watcher.close();
  });
});
