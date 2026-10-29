/** @format */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readProject } from '../src/reader';

describe('adapter-opencode reader', () => {
  it('reads project basic fixture with 3 agents', () => {
    const fixtureDir = resolve(process.cwd(), '../../fixtures/project-basic');
    const result = readProject(fixtureDir);

    expect(result.name).toBe('project-basic');
    expect(result.projectId).toHaveLength(12);
    expect(result.agents).toHaveLength(3);

    const ids = result.agents.map((a) => a.id).sort();
    expect(ids).toEqual(['architect', 'coder', 'tester']);

    const architect = result.agents.find((a) => a.id === 'architect');
    expect(architect).toMatchObject({
      id: 'architect',
      name: 'Architect',
      description: 'System architect designing structure.',
      model: 'claude-3-5-sonnet',
    });
  });

  it('finds .opencode in a parent directory (walk-up discovery)', () => {
    const nestedDir = resolve(process.cwd(), '../../fixtures/project-basic/.opencode/agent');
    const nested = readProject(nestedDir);
    const root = readProject(resolve(process.cwd(), '../../fixtures/project-basic'));

    expect(nested.name).toBe('project-basic');
    expect(nested.path).toBe(root.path);
    expect(nested.projectId).toBe(root.projectId);
    expect(nested.agents).toHaveLength(3);
  });

  it('handles a non-existent start directory gracefully without error', () => {
    const nonExistentDir = resolve(process.cwd(), '../../fixtures/non-existent');
    const result = readProject(nonExistentDir);

    expect(result.projectId).toHaveLength(12);
    expect(Array.isArray(result.agents)).toBe(true);
  });
});
