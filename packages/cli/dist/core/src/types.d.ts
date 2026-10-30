/** @format */
export type AgentStatus = 'idle' | 'working' | 'waiting_permission' | 'error';
export interface AgentDef {
    id: string;
    name: string;
    description?: string;
    model?: string;
}
export interface Agent extends AgentDef {
    status: AgentStatus;
    task?: string;
    lastActivity: number;
}
export type AgentEvent = {
    type: 'agents_defined';
    ts: number;
    agents: AgentDef[];
} | {
    type: 'agent_active';
    ts: number;
    agentId: string;
    task?: string;
} | {
    type: 'permission_request';
    ts: number;
    agentId: string;
    id: string;
    what: string;
} | {
    type: 'permission_resolved';
    ts: number;
    id: string;
    granted: boolean;
} | {
    type: 'handoff';
    ts: number;
    from: string;
    to: string;
} | {
    type: 'idle';
    ts: number;
    agentId: string;
} | {
    type: 'error';
    ts: number;
    agentId?: string;
    message: string;
};
export interface CrewState {
    agents: Record<string, Agent>;
    pendingPermissions: {
        id: string;
        agentId: string;
        what: string;
    }[];
    lastHandoff?: {
        from: string;
        to: string;
        ts: number;
    };
    updatedAt: number;
    projectId?: string;
}
