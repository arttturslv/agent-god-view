/** @format */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyState, reduce, type CrewState } from '@agent-god-view/core';
import { createMapper } from '../src/index';

function replayFixture(name: string) {
  const fixturePath = resolve(process.cwd(), '../../fixtures', name);
  const lines = readFileSync(fixturePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const mapper = createMapper();
  let state: CrewState = emptyState();

  for (const line of lines) {
    for (const event of mapper.mapEvent(line)) {
      state = reduce(state, event);
    }
  }

  return state;
}

describe('adapter-opencode mapper', () => {
  it('maps an approved session to the expected final state', () => {
    const state = replayFixture('opencode-session-01.ndjson');

    expect(state.updatedAt).toBe(1793232010500);
    expect(state.pendingPermissions).toEqual([]);
    expect(state.lastHandoff).toBeUndefined();

    expect(state.agents['architect']).toMatchObject({
      id: 'architect',
      name: 'Architect',
      status: 'working',
      task: 'tool:read',
      lastActivity: 1793232002400,
    });
    expect(state.agents['coder']).toMatchObject({
      id: 'coder',
      name: 'Coder',
      status: 'working',
      task: 'tool:edit',
      lastActivity: 1793232008100,
    });
    expect(state.agents['tester']).toMatchObject({
      id: 'tester',
      name: 'Tester',
      status: 'idle',
      lastActivity: 1793232010500,
    });
    expect(state.agents['tester'].task).toBeUndefined();
  });

  it('clears a denied permission and applies the session error', () => {
    const state = replayFixture('opencode-session-02.ndjson');

    expect(state.updatedAt).toBe(1793233004200);
    expect(state.pendingPermissions).toEqual([]);
    expect(state.agents['coder']).toMatchObject({
      id: 'coder',
      status: 'error',
      task: 'Permission denied: bash command was not executed.',
      lastActivity: 1793233004200,
    });
    expect(state.agents['architect'].status).toBe('idle');
    expect(state.agents['tester'].status).toBe('idle');
  });

  it('ignores invalid or unknown rows without throwing', () => {
    const mapper = createMapper();

    expect(mapper.mapEvent('not-json')).toEqual([]);
    expect(mapper.mapEvent('')).toEqual([]);
    expect(mapper.mapEvent(null)).toEqual([]);
    expect(mapper.mapEvent({ type: 'unknown.event', ts: 1 })).toEqual([]);
    expect(mapper.mapEvent({ type: 'message.updated', ts: 1 })).toEqual([]);
    expect(mapper.mapEvent({ ts: 1, data: {} })).toEqual([]);
  });

  it('resolves a subagent handoff once per parent/child session', () => {
    const mapper = createMapper();

    expect(
      mapper.mapEvent({
        ts: 1,
        type: 'agents_defined',
        data: {
          agents: [
            { id: 'architect', name: 'Architect' },
            { id: 'coder', name: 'Coder' },
          ],
        },
      })
    ).toHaveLength(1);

    mapper.mapEvent({
      ts: 2,
      type: 'message.updated',
      data: {
        sessionID: 'parent',
        messageID: 'msg-parent',
        agentId: 'architect',
        task: 'Planning',
      },
    });

    const created = {
      ts: 3,
      type: 'session.created',
      data: {
        sessionID: 'child',
        parentID: 'parent',
        agentId: 'coder',
      },
    };

    expect(mapper.mapEvent(created)).toEqual([
      { type: 'handoff', ts: 3, from: 'architect', to: 'coder' },
    ]);
    expect(mapper.mapEvent(created)).toEqual([]);
  });
});
