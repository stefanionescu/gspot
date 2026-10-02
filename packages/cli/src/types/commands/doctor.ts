// The types of commands/doctor in this package.
import type { ToolInspection } from '#cli/types/tools/tools.ts';

export type ChangeReport = {
    detectedNotSelected: { kit: string; evidence: string; command: string }[];
    recommendedNotSelected: { kit: string; evidence: string; command: string }[];
    configurationNotOwned: { path: string; note: string; command: string }[];
    changedOutsideGspot: { path: string; note: string; command: string }[];
    pinnedTwice: { tool: string; version: string; places: string[]; command: string }[];
};
export type DoctorReport = {
    submodules: string[];
    tools: ToolInspection[];
    changes: ChangeReport;
    hooks: string;
    ci: string;
    rules: { files: number };
    version: { running: string; pinned?: string };
    exitCode: number;
};

export type ChangeRow = { path: string; note: string; command: string };
export type DoctorOptions = { cwd: string };
