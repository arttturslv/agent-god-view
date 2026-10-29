/** @format */
export function toLegacyCrewState(state) {
    const personas = {};
    let activePersona = null;
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
            status: 'pending',
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
