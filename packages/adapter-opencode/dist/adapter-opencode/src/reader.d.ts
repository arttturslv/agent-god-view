/** @format */
import type { AgentDef } from '../../core/src/index.js';
export interface ProjectInfo {
    projectId: string;
    name: string;
    path: string;
    agents: AgentDef[];
}
export declare function readProject(dir?: string): ProjectInfo;
