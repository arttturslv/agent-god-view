/** @format */
import type { AgentEvent } from "../../core/src/index.js";
interface SessionInfo {
    agentId?: string;
    parentId?: string;
}
export interface MapperState {
    sessions: Map<string, SessionInfo>;
    seenHandoffs: Set<string>;
}
export interface Mapper {
    mapEvent(raw: unknown): AgentEvent[];
}
export declare function createMapperState(): MapperState;
export declare function createMapper(): Mapper;
export declare function mapEvent(raw: unknown): AgentEvent[];
export {};
