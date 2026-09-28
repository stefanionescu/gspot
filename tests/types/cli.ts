// The types of support/cli in this package.
import type { Finding } from '#cli/types/checks/checks.ts';

/** The fields the tests read from the SARIF report gspot writes. */
export type SarifReport = {
    runs: {
        results: unknown[];
        invocations: { executionSuccessful: boolean; toolExecutionNotifications?: { message: { text: string } }[] }[];
        properties?: { comparison?: { reference: string }; canceled?: { pendingRefs: string[] } };
    }[];
};
/** The code quality report gspot writes: one issue per finding. */
export type CodeQualityReport = {
    description: string;
    check_name: string;
    fingerprint: string;
    severity: string;
    location: { path: string; lines: { begin: number } };
}[];
/** What a planted hook program records about the call it received. */
export type HookCapture = { args: string[]; input?: string; cwd?: string; hook?: string };
/** A planted case that checks a diagnostic substring. */
export type PlantedCase = PlantedInput & { expected: string };
/** A planted case that checks a finding at its source location. */
export type FindingCase = PlantedInput & {
    expected: Pick<Finding, 'file'> & Partial<Pick<Finding, 'rule' | 'line' | 'column' | 'message'>>;
};
/** What a planted repository holds and selects. */
export type Sandbox = {
    /** The configurations init selects by name. */
    configurations: string[];
    /** The packages the planted manifest depends on; no manifest is written without them. */
    dependencies?: Record<string, string>;
    /** The source files of the repository. */
    files: Record<string, string>;
    /** Recommended configurations left out; naming and spelling always are. */
    without?: string[];
    /** The level set after init; all unless a test says otherwise. */
    level?: 'recommended' | 'all';
};
export type OriginalFile = { kind: 'file'; bytes: Uint8Array; mode: number } | { kind: 'symlink'; target: string };
/** The files and policy needed to plant a defect for one check. */
export type PlantedInput = {
    check: string;
    files: Record<string, string>;
    policy?: string;
    policyEdit?: [string, string];
    removed?: string[];
    executable?: string[];
};
/** What a spawned command left behind, for tests. */
export type SpawnOutcome = { code: number; stdout: string; stderr: string };
