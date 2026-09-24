import type { z } from 'zod';
import type { Defined } from '#cli/types/policy.ts';
import type { ToolProbe } from '#cli/types/tools.ts';
// The report schema owns both the public document and its parsed types.
import type { pushReportSchema, reportSchema } from '#cli/schemas/reports.ts';

// What doctor reports.

export type CoverageReport = {
    endings: { ending: string; scope: string; files: number; kinds: string[] }[];
    unchecked: { path: string; reason: string; remedy?: string }[];
    partial: { path: string; missing: string[] }[];
    checked: number;
};

export type ChangeReport = {
    detectedNotSelected: { configuration: string; evidence: string; command: string }[];
    recommendedNotSelected: { configuration: string; evidence: string; command: string }[];
    configurationNotOwned: { path: string; note: string; command: string }[];
    changedOutsideGspot: { path: string; note: string; command: string }[];
    pinnedTwice: { tool: string; version: string; places: string[]; command: string }[];
};

export type DoctorReport = {
    submodules: string[];
    tools: ToolProbe[];
    coverage: CoverageReport;
    changes: ChangeReport;
    hooks: string;
    ci: string;
    rules: { files: number };
    version: { running: string; pinned?: string };
    exitCode: number;
};

/** The change sections that share one row shape. */
export type ChangeKey =
    | 'detectedNotSelected'
    | 'recommendedNotSelected'
    | 'configurationNotOwned'
    | 'changedOutsideGspot';

/** One row of the change report: a path, what is wrong with it, and the command that fixes it. */
export type ChangeRow = { path: string; note: string; command: string };

/** gspot doctor. */
export type DoctorOptions = { cwd: string };

export type Finding = Defined<z.infer<typeof reportSchema.shape.checks.element.shape.findings.element>>;
export type CheckResult = Defined<Omit<z.infer<typeof reportSchema.shape.checks.element>, 'findings'>> & {
    findings: Finding[];
};

export type RunReport = Defined<Omit<z.infer<typeof reportSchema>, 'checks' | 'ignores' | 'coverage'>> & {
    checks: CheckResult[];
    coverage: Omit<z.infer<typeof reportSchema.shape.coverage>, 'findings'> & { findings: Finding[] };
    ignores: Defined<z.infer<typeof reportSchema.shape.ignores.element>>[];
};

export type PushReport = Omit<z.infer<typeof pushReportSchema>, 'revisions'> & {
    revisions: (Omit<z.infer<typeof pushReportSchema.shape.revisions.element>, 'report'> & { report: RunReport })[];
};
