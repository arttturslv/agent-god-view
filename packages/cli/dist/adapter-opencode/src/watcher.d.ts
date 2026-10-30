/** @format */
import { ProjectInfo } from './reader.js';
export declare function watchProject(dir: string, onChange: (project: ProjectInfo) => void): {
    close: () => Promise<void>;
};
