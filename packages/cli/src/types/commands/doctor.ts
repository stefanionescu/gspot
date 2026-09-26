// The types of commands/doctor in this package.
import type { ToolInspection } from '#cli/types/tools/tools.ts';
import type { CoverageReport } from '#cli/types/execution/execution.ts';

export type ChangeReport = {
    detectedNotSelected: { configuration: string; evidence: string; command: string }[];
    recommendedNotSelected: { configuration: string; evidence: string; command: string }[];
    configurationNotOwned: { path: string; note: string; command: string }[];
    changedOutsideGspot: { path: string; note: string; command: string }[];
    pinnedTwice: { tool: string; version: string; places: string[]; command: string }[];
};
export type DoctorReport = {
    submodules: string[];
    tools: ToolInspection[];
    coverage: CoverageReport;
    changes: ChangeReport;
    hooks: string;
    ci: string;
    rules: { files: number };
    version: { running: string; pinned?: string };
    exitCode: number;
};
export type ChangeKey =
    | 'detectedNotSelected'
    | 'recommendedNotSelected'
    | 'configurationNotOwned'
    | 'changedOutsideGspot';
export type ChangeRow = { path: string; note: string; command: string };
export type DoctorOptions = { cwd: string };
