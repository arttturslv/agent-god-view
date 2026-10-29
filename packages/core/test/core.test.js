/** @format */
import { describe, it, expect } from 'vitest';
import { emptyState, reduce, applyTimeouts, parseEvent, toLegacyCrewState, } from '../src/index';
describe('@agent-god-view/core', () => {
    it('should initialize empty state', () => {
        const state = emptyState();
        expect(state.agents).toEqual({});
        expect(state.pendingPermissions).toEqual([]);
        expect(state.updatedAt).toBe(0);
    });
    it('should define agents', () => {
        let state = emptyState();
        state = reduce(state, {
            type: 'agents_defined',
            ts: 1000,
            agents: [
                { id: 'dev', name: 'Developer', model: 'gpt-4' },
                { id: 'qa', name: 'QA Tester' },
            ],
        });
        expect(state.agents['dev']).toEqual({
            id: 'dev',
            name: 'Developer',
            model: 'gpt-4',
            status: 'idle',
            lastActivity: 1000,
        });
        expect(state.agents['qa'].status).toBe('idle');
        expect(state.updatedAt).toBe(1000);
    });
    it('should activate an agent', () => {
        let state = emptyState();
        state = reduce(state, {
            type: 'agents_defined',
            ts: 1000,
            agents: [{ id: 'dev', name: 'Developer' }],
        });
        state = reduce(state, {
            type: 'agent_active',
            ts: 1500,
            agentId: 'dev',
            task: 'Writing unit tests',
        });
        expect(state.agents['dev'].status).toBe('working');
        expect(state.agents['dev'].task).toBe('Writing unit tests');
        expect(state.agents['dev'].lastActivity).toBe(1500);
        expect(state.updatedAt).toBe(1500);
    });
    it('should handle permission request and resolution', () => {
        let state = emptyState();
        state = reduce(state, {
            type: 'agents_defined',
            ts: 1000,
            agents: [{ id: 'dev', name: 'Developer' }],
        });
        // Request permission
        state = reduce(state, {
            type: 'permission_request',
            ts: 2000,
            agentId: 'dev',
            id: 'perm-1',
            what: 'Delete file src/old.ts',
        });
        expect(state.agents['dev'].status).toBe('waiting_permission');
        expect(state.agents['dev'].task).toBe('Delete file src/old.ts');
        expect(state.pendingPermissions).toEqual([
            { id: 'perm-1', agentId: 'dev', what: 'Delete file src/old.ts' },
        ]);
        // Resolve permission
        state = reduce(state, {
            type: 'permission_resolved',
            ts: 2500,
            id: 'perm-1',
            granted: true,
        });
        expect(state.pendingPermissions).toEqual([]);
        expect(state.agents['dev'].status).toBe('working');
        expect(state.updatedAt).toBe(2500);
    });
    it('should handle handoff between agents', () => {
        let state = emptyState();
        state = reduce(state, {
            type: 'agents_defined',
            ts: 1000,
            agents: [
                { id: 'po', name: 'PO' },
                { id: 'dev', name: 'Dev' },
            ],
        });
        state = reduce(state, {
            type: 'agent_active',
            ts: 1200,
            agentId: 'po',
            task: 'Planning',
        });
        state = reduce(state, {
            type: 'handoff',
            ts: 3000,
            from: 'po',
            to: 'dev',
        });
        expect(state.lastHandoff).toEqual({ from: 'po', to: 'dev', ts: 3000 });
        expect(state.agents['po'].status).toBe('idle');
        expect(state.agents['po'].task).toBeUndefined();
        expect(state.agents['dev'].status).toBe('working');
    });
    it('should apply timeouts to working agents', () => {
        let state = emptyState();
        state = reduce(state, {
            type: 'agents_defined',
            ts: 1000,
            agents: [{ id: 'dev', name: 'Dev' }],
        });
        state = reduce(state, {
            type: 'agent_active',
            ts: 2000,
            agentId: 'dev',
            task: 'Stuck task',
        });
        // At 10000 ms, maxMs = 5000 (elapsed 8000 ms > 5000 ms) -> timeout
        const timedOutState = applyTimeouts(state, 10000, 5000);
        expect(timedOutState.agents['dev'].status).toBe('idle');
        expect(timedOutState.agents['dev'].task).toBeUndefined();
        // If elapsed is within maxMs (e.g. 5000 ms, elapsed 3000 ms <= 5000 ms) -> no timeout
        const activeState = applyTimeouts(state, 4000, 5000);
        expect(activeState.agents['dev'].status).toBe('working');
    });
    it('should validate events with parseEvent without throwing on invalid input', () => {
        const validJson = JSON.stringify({
            type: 'agent_active',
            ts: 1234,
            agentId: 'dev',
            task: 'Coding',
        });
        const parsed = parseEvent(validJson);
        expect(parsed).toEqual({
            type: 'agent_active',
            ts: 1234,
            agentId: 'dev',
            task: 'Coding',
        });
        // Invalid JSON string
        expect(parseEvent('invalid-json')).toBeNull();
        // Unknown event type
        expect(parseEvent(JSON.stringify({ type: 'unknown_event_type', ts: 123, data: {} }))).toBeNull();
        // Missing required fields
        expect(parseEvent(JSON.stringify({ type: 'agent_active', ts: 123 }))).toBeNull();
    });
    it('should convert to legacy crew state format', () => {
        let state = emptyState();
        state = reduce(state, {
            type: 'agents_defined',
            ts: 1000,
            agents: [
                { id: 'dev', name: 'Dev' },
                { id: 'qa', name: 'QA' },
            ],
        });
        state = reduce(state, {
            type: 'agent_active',
            ts: 1500,
            agentId: 'dev',
            task: 'Coding',
        });
        state = reduce(state, {
            type: 'permission_request',
            ts: 2000,
            agentId: 'dev',
            id: 'p1',
            what: 'Run npm test',
        });
        const legacy = toLegacyCrewState(state);
        expect(legacy.active_persona).toBe('dev');
        expect(legacy.personas['dev']).toEqual({
            status: 'waiting_permission',
            task: 'Run npm test',
        });
        expect(legacy.permission_request).toEqual({
            status: 'pending',
            requested_by: 'dev',
            action: 'Run npm test',
        });
        expect(legacy.updatedAt).toBe(2000);
    });
});
