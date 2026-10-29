/** @format */
export function createMapperState() {
    return { sessions: new Map(), seenHandoffs: new Set() };
}
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const asString = (v) => typeof v === "string" && v.trim() !== "" ? v : undefined;
const asNumber = (v) => typeof v === "number" && Number.isFinite(v) ? v : undefined;
function firstString(...values) {
    for (const v of values) {
        const s = asString(v);
        if (s !== undefined)
            return s;
    }
    return undefined;
}
const rec = (v) => (isRecord(v) ? v : {});
function normalizeAgents(value) {
    const agents = [];
    const push = (idValue, item) => {
        const id = firstString(idValue, item.id, item.name);
        if (!id)
            return;
        const agent = { id, name: firstString(item.name, item.id) ?? id };
        const description = asString(item.description);
        const model = asString(item.model);
        if (description)
            agent.description = description;
        if (model)
            agent.model = model;
        agents.push(agent);
    };
    if (Array.isArray(value)) {
        for (const item of value)
            if (isRecord(item))
                push(item.id, item);
    }
    else if (isRecord(value)) {
        for (const [id, item] of Object.entries(value))
            if (isRecord(item))
                push(id, item);
    }
    return agents;
}
function resolveGranted(value, reply) {
    if (typeof value === "boolean")
        return value;
    if (typeof reply === "boolean")
        return reply;
    const a = asString(reply)?.toLowerCase();
    return !(a === "reject" ||
        a === "rejected" ||
        a === "deny" ||
        a === "denied" ||
        a === "no");
}
function recordSession(state, id, patch) {
    if (!id)
        return;
    const prev = state.sessions.get(id) ?? {};
    state.sessions.set(id, {
        agentId: patch.agentId ?? prev.agentId,
        parentId: patch.parentId ?? prev.parentId,
    });
}
// Emite handoff para toda sessão filha cujo agente e cujo agente do pai já são conhecidos.
// É chamada depois de qualquer evento que possa ter completado essa informação.
function flushHandoffs(state, ts, out) {
    for (const [childId, child] of state.sessions) {
        if (!child.parentId || !child.agentId)
            continue;
        const from = state.sessions.get(child.parentId)?.agentId;
        if (!from || from === child.agentId)
            continue;
        const key = `${child.parentId}->${childId}`;
        if (state.seenHandoffs.has(key))
            continue;
        state.seenHandoffs.add(key);
        out.push({ type: "handoff", ts, from, to: child.agentId });
    }
}
function mapRaw(raw, state) {
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    if (!isRecord(raw))
        return [];
    const type = asString(raw.type);
    if (!type)
        return [];
    const ts = asNumber(raw.ts) ?? asNumber(raw.time) ?? Date.now();
    const data = rec(raw.data ?? raw.properties ?? raw);
    const info = rec(data.info);
    const part = rec(data.part);
    const out = [];
    const agentOf = (sessionId) => sessionId ? state.sessions.get(sessionId)?.agentId : undefined;
    switch (type) {
        case "agents_defined": {
            // Não limpa o mapa de sessões: o leitor do .opencode reemite isso a cada edição de arquivo.
            const agents = normalizeAgents(data.agents ?? raw.agents);
            return agents.length ? [{ type: "agents_defined", ts, agents }] : [];
        }
        case "session.created":
        case "session.updated": {
            const id = firstString(info.id, data.sessionID, data.sessionId);
            const parentId = firstString(info.parentID, info.parentId, data.parentID, data.parentId);
            // Reserva: o título do subagente tem o formato "... (@nome subagent)".
            const fromTitle = /@([\w-]+) subagent/.exec(asString(info.title) ?? "")?.[1];
            const known = agentOf(id);
            recordSession(state, id, {
                parentId,
                agentId: known ? undefined : fromTitle,
            });
            flushHandoffs(state, ts, out);
            return out;
        }
        case "message.updated": {
            const sid = firstString(info.sessionID, info.sessionId, data.sessionID);
            const agent = firstString(info.agent, info.mode);
            if (sid && agent)
                recordSession(state, sid, { agentId: agent });
            flushHandoffs(state, ts, out);
            return out; // só aprende quem é o agente; quem está ocupado vem de session.status
        }
        case "session.status": {
            const agentId = agentOf(firstString(data.sessionID, data.sessionId));
            const status = firstString(rec(data.status).type, data.status);
            if (!agentId)
                return [];
            if (status === "busy")
                return [{ type: "agent_active", ts, agentId }];
            if (status === "retry")
                return [
                    { type: "agent_active", ts, agentId, task: "tentando novamente" },
                ];
            if (status === "idle")
                return [{ type: "idle", ts, agentId }];
            return [];
        }
        case "session.idle": {
            const agentId = agentOf(firstString(data.sessionID, data.sessionId));
            return agentId ? [{ type: "idle", ts, agentId }] : [];
        }
        case "message.part.updated": {
            if (part.type !== "tool")
                return [];
            const agentId = agentOf(firstString(part.sessionID, data.sessionID));
            if (!agentId)
                return [];
            const status = firstString(rec(part.state).status);
            const tool = asString(part.tool);
            if (status === "running") {
                return [
                    {
                        type: "agent_active",
                        ts,
                        agentId,
                        ...(tool ? { task: `tool:${tool}` } : {}),
                    },
                ];
            }
            if (status === "completed")
                return [{ type: "agent_active", ts, agentId }];
            return [];
        }
        case "tool.execute.before": {
            const agentId = agentOf(firstString(data.sessionID, data.sessionId));
            if (!agentId)
                return [];
            const tool = asString(data.tool);
            return [
                {
                    type: "agent_active",
                    ts,
                    agentId,
                    ...(tool ? { task: `tool:${tool}` } : {}),
                },
            ];
        }
        // Formato ainda não confirmado: aceita as variações conhecidas.
        case "permission.asked":
        case "permission.updated": {
            const id = firstString(data.id, data.requestID, data.permissionID, info.id);
            const agentId = agentOf(firstString(data.sessionID, info.sessionID));
            if (!id || !agentId)
                return [];
            const what = firstString(data.title, info.title, data.permission, data.type, info.type) ?? `permission:${id}`;
            return [{ type: "permission_request", ts, agentId, id, what }];
        }
        case "permission.replied": {
            const id = firstString(data.requestID, data.permissionID, data.id);
            if (!id)
                return [];
            return [
                {
                    type: "permission_resolved",
                    ts,
                    id,
                    granted: resolveGranted(data.granted, data.reply ?? data.response),
                },
            ];
        }
        case "session.error": {
            const agentId = agentOf(firstString(data.sessionID, data.sessionId));
            const err = rec(data.error);
            const message = firstString(err.message, rec(err.data).message, data.message) ??
                "Erro desconhecido";
            return [{ type: "error", ts, ...(agentId ? { agentId } : {}), message }];
        }
        case "handoff": {
            const from = firstString(data.from, data.fromAgentId);
            const to = firstString(data.to, data.toAgentId, data.agentId);
            if (!from || !to || from === to)
                return [];
            const key = `${from}->${to}`;
            if (state.seenHandoffs.has(key))
                return [];
            state.seenHandoffs.add(key);
            return [{ type: "handoff", ts, from, to }];
        }
    }
    return [];
}
function mapEventWithState(raw, state) {
    try {
        return mapRaw(raw, state);
    }
    catch {
        return [];
    }
}
const defaultState = createMapperState();
export function createMapper() {
    const state = createMapperState();
    return { mapEvent: (raw) => mapEventWithState(raw, state) };
}
export function mapEvent(raw) {
    return mapEventWithState(raw, defaultState);
}
