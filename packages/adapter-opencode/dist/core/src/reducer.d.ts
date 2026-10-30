/** @format */
import type { AgentEvent, CrewState } from "./types.js";
export declare const emptyState: () => CrewState;
export declare function reduce(s: CrewState, e: AgentEvent): CrewState;
export declare function applyTimeouts(s: CrewState, now: number, maxMs: number): CrewState;
