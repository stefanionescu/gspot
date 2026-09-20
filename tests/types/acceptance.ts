import type { RunReport } from '#types/report.ts';

/** What a spawned command left behind, for tests. */
export type SpawnOutcome = { code: number; stdout: string; stderr: string };

/** One planted defect: the files that hold it, the check that finds it, and what the check says. */
export type PlantedCase = {
    check: string;
    files: Record<string, string>;
    expected: string;
    policy?: string;
    policyEdit?: [string, string];
    removed?: string[];
    executable?: string[];
};

/** What one acceptance run produced: the init output, the run report and how many checks ended in each status. */
export type AcceptanceRun = { init: string; report: RunReport; statuses: Record<string, number> };

/** One framework of component files in the planted components test: its check, its presets, its files and its planted cases. */
export type ComponentShape = {
    check: string;
    presets: string;
    files: Record<string, string>;
    planted: string;
    cases: [string, string][];
};
