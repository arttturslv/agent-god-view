/** @format */
import type { AgentDef } from '@agent-god-view/core';
export interface ProjectInfo {
    projectId: string;
    name: string;
    path: string;
    agents: AgentDef[];
}
export declare function readProject(dir?: string): ProjectInfo;
