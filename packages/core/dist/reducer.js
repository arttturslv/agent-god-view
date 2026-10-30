/** @format */
export const emptyState = () => ({
    agents: {},
    pendingPermissions: [],
    updatedAt: 0,
});
export function reduce(s, e) {
    const next = {
        ...s,
        agents: { ...s.agents },
        pendingPermissions: [...s.pendingPermissions],
        updatedAt: e.ts,
    };
    const ensure = (id) => {
        if (!next.agents[id]) {
            next.agents[id] = { id, name: id, status: "idle", lastActivity: e.ts };
        }
    };
    const touch = (id, patch) => {
        ensure(id);
        next.agents[id] = { ...next.agents[id], ...patch, lastActivity: e.ts };
    };
    switch (e.type) {
        case "agents_defined":
            for (const d of e.agents) {
                next.agents[d.id] = next.agents[d.id]
                    ? { ...next.agents[d.id], ...d }
                    : { ...d, status: "idle", lastActivity: e.ts };
            }
            break;
        case "agent_active":
            touch(e.agentId, { status: "working", task: e.task });
            break;
        case "permission_request":
            touch(e.agentId, { status: "waiting_permission", task: e.what });
            next.pendingPermissions = [
                ...s.pendingPermissions,
                { id: e.id, agentId: e.agentId, what: e.what },
            ];
            break;
        case "permission_resolved": {
            const p = s.pendingPermissions.find((x) => x.id === e.id);
            next.pendingPermissions = s.pendingPermissions.filter((x) => x.id !== e.id);
            if (p) {
                touch(p.agentId, { status: "working" });
            }
            break;
        }
        case "handoff":
            next.lastHandoff = { from: e.from, to: e.to, ts: e.ts };
            touch(e.from, { status: "idle", task: undefined });
            touch(e.to, { status: "working" });
            break;
        case "idle":
            touch(e.agentId, { status: "idle", task: undefined });
            break;
        case "error":
            if (e.agentId) {
                touch(e.agentId, { status: "error", task: e.message });
            }
            break;
    }
    return next;
}
export function applyTimeouts(s, now, maxMs) {
    let changed = false;
    const nextAgents = {};
    for (const [id, agent] of Object.entries(s.agents)) {
        if (agent.status === "working" && now - agent.lastActivity > maxMs) {
            changed = true;
            nextAgents[id] = {
                ...agent,
                status: "idle",
                task: undefined,
                lastActivity: now,
            };
        }
        else {
            nextAgents[id] = agent;
        }
    }
    if (!changed)
        return s;
    return {
        ...s,
        agents: nextAgents,
        updatedAt: Math.max(s.updatedAt, now),
    };
}
