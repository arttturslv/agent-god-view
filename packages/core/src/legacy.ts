/** @format */

import type { CrewState } from './types.js';

export interface LegacyCrewState {
  active_persona: string | null;
  personas: Record<string, { status: string; task?: string }>;
  permission_request: {
    status: 'pending' | 'resolved';
    requested_by: string;
    action: string;
  } | null;
  handoff: {
    from: string;
    to: string;
    status: string;
    message?: string;
  } | null;
  updatedAt: number;
}

export function toLegacyCrewState(state: CrewState): LegacyCrewState {
  const personas: Record<string, { status: string; task?: string }> = {};
  let activePersona: string | null = null;

  for (const [id, agent] of Object.entries(state.agents)) {
    personas[id] = {
      status: agent.status,
      ...(agent.task ? { task: agent.task } : {}),
    };
    if (agent.status === 'working' || agent.status === 'waiting_permission') {
      activePersona = id;
    }
  }

  let permissionRequest = null;
  if (state.pendingPermissions.length > 0) {
    const p = state.pendingPermissions[0];
    permissionRequest = {
      status: 'pending' as const,
      requested_by: p.agentId,
      action: p.what,
    };
  }

  let handoff = null;
  if (state.lastHandoff) {
    handoff = {
      from: state.lastHandoff.from,
      to: state.lastHandoff.to,
      status: 'passed',
      message: 'Handoff',
    };
  }

  return {
    active_persona: activePersona,
    personas,
    permission_request: permissionRequest,
    handoff,
    updatedAt: state.updatedAt,
  };
}
