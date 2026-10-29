/** @format */
import { createHash } from 'node:crypto';
import { resolve, basename, join, dirname, extname } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { parse as parseJsonc } from 'jsonc-parser';
function findOpencodeDir(startDir) {
    let currentDir = startDir;
    while (true) {
        const candidate = join(currentDir, '.opencode');
        if (existsSync(candidate) && statSync(candidate).isDirectory()) {
            return candidate;
        }
        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
    }
}
export function readProject(dir = process.cwd()) {
    const startDir = resolve(dir);
    const opencodeDir = findOpencodeDir(startDir);
    const absDir = opencodeDir ? dirname(opencodeDir) : startDir;
    const projectId = createHash('sha1').update(absDir).digest('hex').slice(0, 12);
    const name = basename(absDir);
    if (!opencodeDir) {
        console.log(`[adapter-opencode] .opencode/ not found in ${absDir} or any parent. Returning empty agents list.`);
        return {
            projectId,
            name,
            path: absDir,
            agents: [],
        };
    }
    const agentsMap = new Map();
    // 1. Read .opencode/agent/ and .opencode/agents/
    const agentSubdirs = ['agent', 'agents'];
    for (const sub of agentSubdirs) {
        const subDir = join(opencodeDir, sub);
        if (existsSync(subDir) && statSync(subDir).isDirectory()) {
            try {
                const files = readdirSync(subDir);
                for (const file of files) {
                    if (extname(file).toLowerCase() === '.md') {
                        const filePath = join(subDir, file);
                        if (statSync(filePath).isFile()) {
                            const id = basename(file, extname(file));
                            try {
                                const content = readFileSync(filePath, 'utf8');
                                const parsed = matter(content);
                                const frontmatter = parsed.data || {};
                                const agentName = frontmatter.name || id;
                                const description = frontmatter.description;
                                const model = frontmatter.model;
                                agentsMap.set(id, {
                                    id,
                                    name: agentName,
                                    ...(description ? { description } : {}),
                                    ...(model ? { model } : {}),
                                });
                            }
                            catch (err) {
                                console.error(`[adapter-opencode] Error parsing markdown agent file ${filePath}:`, err);
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.error(`[adapter-opencode] Error reading directory ${subDir}:`, err);
            }
        }
    }
    // 2. Read opencode.json (at root and in .opencode/)
    const jsonPaths = [
        join(absDir, 'opencode.json'),
        join(opencodeDir, 'opencode.json'),
    ];
    for (const jsonPath of jsonPaths) {
        if (existsSync(jsonPath) && statSync(jsonPath).isFile()) {
            try {
                const content = readFileSync(jsonPath, 'utf8');
                const parsed = parseJsonc(content);
                if (parsed && typeof parsed === 'object') {
                    const agentConfig = parsed.agent || parsed.agents;
                    if (agentConfig) {
                        if (Array.isArray(agentConfig)) {
                            for (const item of agentConfig) {
                                if (item && typeof item === 'object' && typeof item.id === 'string') {
                                    const id = item.id;
                                    agentsMap.set(id, {
                                        id,
                                        name: item.name || id,
                                        ...(item.description ? { description: item.description } : {}),
                                        ...(item.model ? { model: item.model } : {}),
                                    });
                                }
                            }
                        }
                        else if (typeof agentConfig === 'object') {
                            for (const [id, val] of Object.entries(agentConfig)) {
                                if (val && typeof val === 'object') {
                                    const item = val;
                                    agentsMap.set(id, {
                                        id,
                                        name: item.name || id,
                                        ...(item.description ? { description: item.description } : {}),
                                        ...(item.model ? { model: item.model } : {}),
                                    });
                                }
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.error(`[adapter-opencode] Error parsing opencode.json at ${jsonPath}:`, err);
            }
        }
    }
    return {
        projectId,
        name,
        path: absDir,
        agents: Array.from(agentsMap.values()),
    };
}
