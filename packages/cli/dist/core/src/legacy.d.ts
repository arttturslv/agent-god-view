/** @format */
import type { CrewState } from './types.js';
export interface LegacyCrewState {
    active_persona: string | null;
    personas: Record<string, {
        status: string;
        task?: string;
    }>;
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
export declare function toLegacyCrewState(state: CrewState): LegacyCrewState;
