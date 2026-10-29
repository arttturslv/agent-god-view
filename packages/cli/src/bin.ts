/** @format */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import open from 'open';
import {
  readProject,
  watchProject,
  tail,
  createMapper,
  type Mapper,
  type ProjectInfo,
} from '@agent-god-view/adapter-opencode';
import { emptyState, reduce, type CrewState } from '@agent-god-view/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

interface ReplayItem {
  raw: unknown;
  ts?: number;
}

function spoolDirectory(): string {
  if (process.env.APPDATA) {
    return join(process.env.APPDATA, 'agent-god-view', 'spool');
  }
  return join(homedir(), '.agent-god-view', 'spool');
}

function spoolFile(projectId: string): string {
  return join(spoolDirectory(), `${projectId}.ndjson`);
}

function rawTimestamp(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null || !('ts' in raw)) return undefined;
  const ts = (raw as { ts?: unknown }).ts;
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : undefined;
}

async function loadSpool(
  file: string,
  initialState: CrewState,
  mapper: Mapper
): Promise<{ state: CrewState; offset: number }> {
  let content: string;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    return { state: initialState, offset: 0 };
  }

  const lines = content.split('\n');
  const partial = lines.pop() ?? '';
  let state = initialState;

  for (const line of lines) {
    const trimmed = line.replace(/\r$/, '');
    if (!trimmed) continue;
    for (const event of mapper.mapEvent(trimmed)) {
      state = reduce(state, event);
    }
  }

  // Leave a trailing partial line for tail() so it can complete it with the
  // next appended chunk.
  const offset =
    Buffer.byteLength(content, 'utf8') - Buffer.byteLength(partial, 'utf8');

  return { state, offset };
}

async function loadFixture(file: string): Promise<ReplayItem[]> {
  const content = await readFile(file, 'utf8');
  const items: ReplayItem[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const raw: unknown = JSON.parse(trimmed);
      items.push({ raw, ts: rawTimestamp(raw) });
    } catch {
      // A malformed fixture line is skipped, never fatal.
    }
  }

  return items;
}

function resolveUiDist(projectDir: string): string {
  let uiDistDir = resolve(__dirname, '../../ui/dist');
  if (!existsSync(uiDistDir)) {
    uiDistDir = resolve(__dirname, '../node_modules/@agent-god-view/ui/dist');
  }
  if (!existsSync(uiDistDir)) {
    uiDistDir = resolve(projectDir, 'packages/ui/dist');
  }
  return uiDistDir;
}

async function main() {
  const args = process.argv.slice(2);
  const replay = args[0] === 'replay';
  const fixtureArg = replay ? args[1] : undefined;

  if (replay && !fixtureArg) {
    console.error('[agent-god-view] Usage: agent-god-view replay <fixture>');
    process.exit(1);
  }

  const projectDir = process.cwd();
  const project = readProject(projectDir);
  const projectId = project.projectId;

  let replayItems: ReplayItem[] | undefined;
  if (fixtureArg) {
    try {
      replayItems = await loadFixture(resolve(fixtureArg));
    } catch (err) {
      console.error(`[agent-god-view] Could not read fixture "${fixtureArg}":`, err);
      process.exit(1);
    }
  }

  let currentState: CrewState = reduce(emptyState(), {
    type: 'agents_defined',
    ts: Date.now(),
    agents: project.agents,
  });
  currentState.projectId = projectId;

  const clients = new Set<ServerResponse>();
  const mapper = createMapper();

  const sendState = (res: ServerResponse) => {
    res.write('data: ' + JSON.stringify(currentState) + '\n\n');
  };

  const broadcast = () => {
    const payload = 'data: ' + JSON.stringify(currentState) + '\n\n';
    for (const client of clients) {
      try {
        client.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  };

  const applyRaw = (raw: unknown) => {
    for (const event of mapper.mapEvent(raw)) {
      currentState = reduce(currentState, event);
    }
    currentState.projectId = projectId;
  };

  const applyLine = (line: string) => {
    applyRaw(line);
    broadcast();
  };

  let closeSpoolTail: (() => void) | undefined;

  if (!replayItems) {
    const file = spoolFile(projectId);
    const loaded = await loadSpool(file, currentState, mapper);
    currentState = loaded.state;
    currentState.projectId = projectId;

    const handle = tail(
      file,
      (line) => {
        try {
          applyLine(line);
        } catch (err) {
          console.error('[agent-god-view] Error processing spool line:', err);
        }
      },
      { startOffset: loaded.offset }
    );
    closeSpoolTail = () => handle.close();

    watchProject(projectDir, (updatedProject: ProjectInfo) => {
      project.agents = updatedProject.agents;
      currentState = reduce(currentState, {
        type: 'agents_defined',
        ts: Date.now(),
        agents: updatedProject.agents,
      });
      currentState.projectId = updatedProject.projectId;

      broadcast();
      console.log(
        `[agent-god-view] .opencode/ changed. Updated ${updatedProject.agents.length} agents. Broadcasted to ${clients.size} clients.`
      );
    });
  }

  const uiDistDir = resolveUiDist(projectDir);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/project') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          projectId: project.projectId,
          name: project.name,
          path: project.path,
          agents: project.agents,
        })
      );
      return;
    }

    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      sendState(res);
      clients.add(res);

      req.on('close', () => {
        clients.delete(res);
      });
      return;
    }

    let filePath = join(uiDistDir, url.pathname === '/' ? 'index.html' : url.pathname);
    try {
      if (existsSync(filePath) && !(await stat(filePath)).isDirectory()) {
        const fileContent = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(fileContent);
        return;
      }
    } catch {}

    const indexPath = join(uiDistDir, 'index.html');
    if (existsSync(indexPath)) {
      try {
        const fileContent = await readFile(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fileContent);
        return;
      } catch {}
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const startReplay = (items: ReplayItem[]) => {
    if (items.length === 0) return;

    const firstTs = items.find((item) => item.ts !== undefined)?.ts;
    let lastDelay = 0;

    for (const item of items) {
      const delay =
        firstTs !== undefined && item.ts !== undefined
          ? Math.max(0, item.ts - firstTs)
          : 0;
      lastDelay = Math.max(lastDelay, delay);

      setTimeout(() => {
        try {
          applyRaw(item.raw);
          broadcast();
        } catch (err) {
          console.error('[agent-god-view] Replay error:', err);
        }
      }, delay);
    }

    setTimeout(() => {
      console.log('[agent-god-view] Replay finished.');
    }, lastDelay + 50);
  };

  server.listen(0, '127.0.0.1', () => {
    const address = server.address() as any;
    const port = address.port;
    const url = `http://127.0.0.1:${port}`;
    console.log(
      `[agent-god-view] Server running at ${url} for project "${project.name}" (${project.projectId})`
    );
    if (replayItems) {
      console.log(`[agent-god-view] Replaying ${replayItems.length} fixture events.`);
    } else {
      console.log(`[agent-god-view] Found ${project.agents.length} agents in .opencode/`);
      console.log(`[agent-god-view] Tailing spool ${spoolFile(project.projectId)}`);
    }
    open(url).catch(() => {});

    if (replayItems) startReplay(replayItems);
  });

  const shutdown = () => {
    closeSpoolTail?.();
    server.close(() => process.exit(0));
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[agent-god-view] CLI error:', err);
  process.exit(1);
});
