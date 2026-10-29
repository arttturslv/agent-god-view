/** @format */

import chokidar from 'chokidar';
import { resolve, join } from 'node:path';
import { readProject, ProjectInfo } from './reader.js';

export function watchProject(dir: string, onChange: (project: ProjectInfo) => void) {
  const absDir = resolve(dir);
  const targets = [
    join(absDir, '.opencode'),
    join(absDir, 'opencode.json'),
  ];

  let timeout: NodeJS.Timeout | null = null;

  const watcher = chokidar.watch(targets, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  const handleChange = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      try {
        const project = readProject(absDir);
        onChange(project);
      } catch (err) {
        console.error('[adapter-opencode] Error in watchProject:', err);
      }
    }, 200);
  };

  watcher.on('add', handleChange);
  watcher.on('change', handleChange);
  watcher.on('unlink', handleChange);

  return {
    close: async () => {
      if (timeout) clearTimeout(timeout);
      await watcher.close();
    },
  };
}
