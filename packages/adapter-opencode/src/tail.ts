/** @format */

import { watch, type FSWatcher } from 'node:fs';
import { mkdir, open, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

export interface TailOptions {
  /**
   * Byte offset to start reading from. Defaults to 0 so an existing spool is
   * replayed from the beginning.
   */
  startOffset?: number;
}

export interface TailHandle {
  close(): void;
}

export function tail(
  file: string,
  onLine: (line: string) => void,
  options: TailOptions = {}
): TailHandle {
  const absFile = resolve(file);
  const directory = dirname(absFile);
  const filename = basename(absFile);

  let offset = Math.max(0, options.startOffset ?? 0);
  let buffer = '';
  let reading = false;
  let again = false;
  let closed = false;
  let watcher: FSWatcher | undefined;

  const processLine = (line: string) => {
    const clean = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (!clean) return;
    try {
      onLine(clean);
    } catch {
      // A broken consumer line must not stop the tail loop.
    }
  };

  const read = async () => {
    let size: number;
    try {
      size = (await stat(absFile)).size;
    } catch {
      return;
    }

    // The spool was rotated or truncated: restart from the beginning.
    if (size < offset) {
      offset = 0;
      buffer = '';
    }
    if (size === offset) return;

    const handle = await open(absFile, 'r');
    try {
      const length = size - offset;
      const chunk = Buffer.alloc(length);
      const { bytesRead } = await handle.read(chunk, 0, length, offset);
      if (bytesRead === 0) return;

      offset += bytesRead;
      buffer += chunk.subarray(0, bytesRead).toString('utf8');

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line);
    } finally {
      await handle.close();
    }
  };

  const schedule = () => {
    if (closed) return;
    if (reading) {
      again = true;
      return;
    }

    reading = true;
    void read()
      .catch(() => {})
      .finally(() => {
        reading = false;
        if (again && !closed) {
          again = false;
          schedule();
        }
      });
  };

  void (async () => {
    try {
      await mkdir(directory, { recursive: true });
    } catch {
      // The read below will simply return no data if the folder is unavailable.
    }

    if (closed) return;

    try {
      watcher = watch(directory, { persistent: true }, (_event, changed) => {
        if (!changed || changed.toString() === filename) schedule();
      });
    } catch {
      try {
        watcher = watch(absFile, { persistent: true }, () => schedule());
      } catch {
        // Watching is best-effort; the initial read still delivers the spool.
      }
    }

    schedule();
  })();

  return {
    close() {
      closed = true;
      watcher?.close();
      watcher = undefined;
    },
  };
}
