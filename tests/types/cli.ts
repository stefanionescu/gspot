// The types of support/cli in this package.
import type { Finding } from '#cli/types/checks.ts';

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
/** A planted case that checks a finding at its source location, and what corrects it for the clean rerun. */
export type FindingCase = PlantedInput & {
    expected: Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;
    /** What the clean rerun plants instead; the case's policy with no files unless a case says otherwise. */
    corrected?: Correction;
    /** The platforms the case runs on; every platform unless the tool has no build elsewhere. */
    platforms?: NodeJS.Platform[];
};
/** What the clean rerun of a planted case plants: corrected files, and the case's policy unless it names another. */
export type Correction = {
    files: Record<string, string>;
    policy?: string | undefined;
    removed?: string[];
    executable?: string[];
};
/** What a planted repository holds and selects. */
export type Sandbox = {
    /** The kits init selects by name. */
    kits: string[];
    /** The packages the planted manifest depends on; no manifest is written without them. */
    dependencies?: Record<string, string>;
    /** The source files of the repository. */
    files: Record<string, string>;
    /** Recommended configurations left out; naming and spelling when a fixture says nothing. */
    without?: string[];
    /** The init flags after the kits; no runner, hooks, CI, guides, or install unless a fixture says otherwise. */
    init?: string[];
    /** Tools on the PATH beside typos, ec, and ast-grep. */
    tools?: string[];
    /** Whether this repository's node_modules is linked into the sandbox; it is unless a fixture says otherwise. */
    modules?: boolean;
    /** The level set after init; all unless a test says otherwise. */
    level?: 'recommended' | 'all';
};
/** A repository the planted cases of one table share, with what happens once around its install. */
export type PlantedRepository = Sandbox & {
    /** The folder the repository is made under; the temporary folder unless a tool needs another drive. */
    dirname?: string;
    /** Runs once before init: files that are copied rather than written. */
    before?: (root: string) => void;
    /** Runs once after install: settings, commits, or files the cases need in place. */
    prepare?: (root: string, environment: Record<string, string>) => void | Promise<void>;
    /** The correction of a case that names none. */
    corrected?: (planted: FindingCase) => Correction;
};
/** An installed repository and the environment its commands run with. */
export type Planted = { root: string; environment: Record<string, string> };
export type OriginalFile = { kind: 'file'; bytes: Uint8Array; mode: number } | { kind: 'symlink'; target: string };
/** The files and policy needed to plant a defect for one check. */
export type PlantedInput = {
    check: string;
    files: Record<string, string>;
    policy?: string;
    removed?: string[];
    executable?: string[];
};
/** What a spawned command left behind, for tests. */
export type SpawnOutcome = { code: number; stdout: string; stderr: string };
