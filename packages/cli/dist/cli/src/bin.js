#!/usr/bin/env node
/** @format */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import open from 'open';
import { readProject, watchProject, tail, createMapper, } from '../../adapter-opencode/src/index.js';
import { emptyState, reduce, } from '../../core/src/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
function parseArgs(argv) {
    const positional = [];
    let web = false;
    let headless = false;
    for (const arg of argv) {
        if (arg === '--') {
            continue;
        }
        else if (arg === '--web') {
            web = true;
        }
        else if (arg === '--headless') {
            headless = true;
        }
        else {
            positional.push(arg);
        }
    }
    const replay = positional[0] === 'replay';
    return {
        replay,
        fixture: replay ? positional[1] : undefined,
        web,
        headless,
    };
}
function nativeBinaryName() {
    return process.platform === 'win32'
        ? 'agent-god-view-shell.exe'
        : 'agent-god-view-shell';
}
function resolveNativeBinary(projectDir) {
    const names = [nativeBinaryName()];
    if (process.platform === 'win32')
        names.push('Agent God View.exe');
    const candidates = [];
    const override = process.env.AGENT_GOD_VIEW_APP_BIN;
    if (override)
        candidates.push(resolve(override));
    for (const root of [projectDir, resolve(__dirname, '../../../../..')]) {
        const targetDir = join(root, 'packages', 'shell', 'src-tauri', 'target');
        for (const name of names) {
            candidates.push(join(targetDir, 'release', name));
            candidates.push(join(targetDir, 'debug', name));
        }
    }
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
        for (const name of names) {
            candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'Agent God View', name));
            candidates.push(join(process.env.LOCALAPPDATA, 'agent-god-view', 'bin', name));
        }
    }
    return candidates.find((candidate) => existsSync(candidate));
}
function launchNativeApp(binary, projectDir) {
    let child;
    try {
        child = spawn(binary, ['--project', projectDir], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
        });
    }
    catch (err) {
        console.error(`[agent-god-view] Could not launch native app "${binary}":`, err);
        return Promise.resolve(false);
    }
    return new Promise((resolveLaunch) => {
        let launched = false;
        child.once('spawn', () => {
            launched = true;
            child.unref();
            console.log(`[agent-god-view] Native app launched from ${binary}`);
            resolveLaunch(true);
        });
        child.once('error', (err) => {
            if (launched)
                return;
            console.error(`[agent-god-view] Could not launch native app "${binary}":`, err);
            resolveLaunch(false);
        });
    });
}
function spoolDirectory() {
    if (process.env.APPDATA) {
        return join(process.env.APPDATA, 'agent-god-view', 'spool');
    }
    return join(homedir(), '.agent-god-view', 'spool');
}
function spoolFile(projectId) {
    return join(spoolDirectory(), `${projectId}.ndjson`);
}
function rawTimestamp(raw) {
    if (typeof raw !== 'object' || raw === null || !('ts' in raw))
        return undefined;
    const ts = raw.ts;
    return typeof ts === 'number' && Number.isFinite(ts) ? ts : undefined;
}
async function loadSpool(file, initialState, mapper) {
    let content;
    try {
        content = await readFile(file, 'utf8');
    }
    catch {
        return { state: initialState, offset: 0 };
    }
    const lines = content.split('\n');
    const partial = lines.pop() ?? '';
    let state = initialState;
    for (const line of lines) {
        const trimmed = line.replace(/\r$/, '');
        if (!trimmed)
            continue;
        for (const event of mapper.mapEvent(trimmed)) {
            state = reduce(state, event);
        }
    }
    // Leave a trailing partial line for tail() so it can complete it with the
    // next appended chunk.
    const offset = Buffer.byteLength(content, 'utf8') - Buffer.byteLength(partial, 'utf8');
    return { state, offset };
}
async function loadFixture(file) {
    const content = await readFile(file, 'utf8');
    const items = [];
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const raw = JSON.parse(trimmed);
            items.push({ raw, ts: rawTimestamp(raw) });
        }
        catch {
            // A malformed fixture line is skipped, never fatal.
        }
    }
    return items;
}
function resolveUiDist(projectDir) {
    const candidates = [
        resolve(__dirname, '../../../ui-dist'),
        resolve(__dirname, '../../../../ui/dist'),
        resolve(projectDir, 'packages/ui/dist'),
    ];
    return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}
async function main() {
    const options = parseArgs(process.argv.slice(2));
    const replay = options.replay;
    const fixtureArg = options.fixture;
    if (replay && !fixtureArg) {
        console.error('[agent-god-view] Usage: agent-god-view replay <fixture> [--web] [--headless]');
        process.exit(1);
    }
    const projectDir = process.cwd();
    const project = readProject(projectDir);
    const projectId = project.projectId;
    if (!replay && !options.web && !options.headless) {
        const nativeBinary = resolveNativeBinary(projectDir);
        if (nativeBinary) {
            if (await launchNativeApp(nativeBinary, projectDir))
                return;
        }
        else {
            console.log('[agent-god-view] Native Tauri app not found; using localhost fallback.');
        }
    }
    let replayItems;
    if (fixtureArg) {
        try {
            replayItems = await loadFixture(resolve(fixtureArg));
        }
        catch (err) {
            console.error(`[agent-god-view] Could not read fixture "${fixtureArg}":`, err);
            process.exit(1);
        }
    }
    let currentState = reduce(emptyState(), {
        type: 'agents_defined',
        ts: Date.now(),
        agents: project.agents,
    });
    currentState.projectId = projectId;
    const clients = new Set();
    const mapper = createMapper();
    const sendState = (res) => {
        res.write('data: ' + JSON.stringify(currentState) + '\n\n');
    };
    const broadcast = () => {
        const payload = 'data: ' + JSON.stringify(currentState) + '\n\n';
        for (const client of clients) {
            try {
                client.write(payload);
            }
            catch {
                clients.delete(client);
            }
        }
    };
    const applyRaw = (raw) => {
        for (const event of mapper.mapEvent(raw)) {
            currentState = reduce(currentState, event);
        }
        currentState.projectId = projectId;
    };
    const applyLine = (line) => {
        applyRaw(line);
        broadcast();
    };
    let closeSpoolTail;
    if (!replayItems) {
        const file = spoolFile(projectId);
        const loaded = await loadSpool(file, currentState, mapper);
        currentState = loaded.state;
        currentState.projectId = projectId;
        const handle = tail(file, (line) => {
            try {
                applyLine(line);
            }
            catch (err) {
                console.error('[agent-god-view] Error processing spool line:', err);
            }
        }, { startOffset: loaded.offset });
        closeSpoolTail = () => handle.close();
        watchProject(projectDir, (updatedProject) => {
            project.agents = updatedProject.agents;
            currentState = reduce(currentState, {
                type: 'agents_defined',
                ts: Date.now(),
                agents: updatedProject.agents,
            });
            currentState.projectId = updatedProject.projectId;
            broadcast();
            console.log(`[agent-god-view] .opencode/ changed. Updated ${updatedProject.agents.length} agents. Broadcasted to ${clients.size} clients.`);
        });
    }
    const uiDistDir = resolveUiDist(projectDir);
    const server = createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        if (url.pathname === '/project') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                projectId: project.projectId,
                name: project.name,
                path: project.path,
                agents: project.agents,
            }));
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
                const mimeTypes = {
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
        }
        catch { }
        const indexPath = join(uiDistDir, 'index.html');
        if (existsSync(indexPath)) {
            try {
                const fileContent = await readFile(indexPath);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(fileContent);
                return;
            }
            catch { }
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });
    const startReplay = (items) => {
        if (items.length === 0)
            return;
        const firstTs = items.find((item) => item.ts !== undefined)?.ts;
        let lastDelay = 0;
        for (const item of items) {
            const delay = firstTs !== undefined && item.ts !== undefined
                ? Math.max(0, item.ts - firstTs)
                : 0;
            lastDelay = Math.max(lastDelay, delay);
            setTimeout(() => {
                try {
                    applyRaw(item.raw);
                    broadcast();
                }
                catch (err) {
                    console.error('[agent-god-view] Replay error:', err);
                }
            }, delay);
        }
        setTimeout(() => {
            console.log('[agent-god-view] Replay finished.');
        }, lastDelay + 50);
    };
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = address.port;
        const url = `http://127.0.0.1:${port}`;
        console.log(`[agent-god-view] Server running at ${url} for project "${project.name}" (${project.projectId})`);
        if (replayItems) {
            console.log(`[agent-god-view] Replaying ${replayItems.length} fixture events.`);
        }
        else {
            console.log(`[agent-god-view] Found ${project.agents.length} agents in .opencode/`);
            console.log(`[agent-god-view] Tailing spool ${spoolFile(project.projectId)}`);
        }
        if (options.headless) {
            console.log('[agent-god-view] Headless mode: open the URL manually to view the office.');
        }
        else {
            open(url).catch((err) => {
                console.error('[agent-god-view] Could not open the browser:', err);
            });
        }
        if (replayItems)
            startReplay(replayItems);
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
