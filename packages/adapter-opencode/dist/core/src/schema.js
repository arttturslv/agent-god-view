/** @format */
import { z } from 'zod';
const AgentDefSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    model: z.string().optional(),
});
const AgentEventSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('agents_defined'),
        ts: z.number(),
        agents: z.array(AgentDefSchema),
    }),
    z.object({
        type: z.literal('agent_active'),
        ts: z.number(),
        agentId: z.string(),
        task: z.string().optional(),
    }),
    z.object({
        type: z.literal('permission_request'),
        ts: z.number(),
        agentId: z.string(),
        id: z.string(),
        what: z.string(),
    }),
    z.object({
        type: z.literal('permission_resolved'),
        ts: z.number(),
        id: z.string(),
        granted: z.boolean(),
    }),
    z.object({
        type: z.literal('handoff'),
        ts: z.number(),
        from: z.string(),
        to: z.string(),
    }),
    z.object({
        type: z.literal('idle'),
        ts: z.number(),
        agentId: z.string(),
    }),
    z.object({
        type: z.literal('error'),
        ts: z.number(),
        agentId: z.string().optional(),
        message: z.string(),
    }),
]);
export function parseEvent(line) {
    try {
        const raw = typeof line === 'string' ? JSON.parse(line) : line;
        const result = AgentEventSchema.safeParse(raw);
        if (result.success) {
            return result.data;
        }
        return null;
    }
    catch {
        return null;
    }
}
