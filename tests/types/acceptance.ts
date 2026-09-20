import type { Finding } from '#types/finding.ts';
import type { RunReport } from '#types/report.ts';

/** What a spawned command left behind, for tests. */
export type SpawnOutcome = { code: number; stdout: string; stderr: string };

/** The files and policy needed to plant a defect for one check. */
export type PlantedInput = {
    check: string;
    files: Record<string, string>;
    policy?: string;
    policyEdit?: [string, string];
    removed?: string[];
    executable?: string[];
};

/** A planted case that checks a diagnostic substring. */
export type PlantedCase = PlantedInput & { expected: string };

/** A planted case that checks a finding at its source location. */
export type FindingCase = PlantedInput & {
    expected: Pick<Finding, 'file'> & Partial<Pick<Finding, 'rule' | 'line' | 'column' | 'message'>>;
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
