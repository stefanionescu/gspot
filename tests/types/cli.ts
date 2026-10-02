// The types the CLI harness and its tests share: planted repositories, their findings, and spawned commands.
import type { Finding } from '#cli/types/execution/execution.ts';

/** What the clean rerun of a planted case plants: corrected files, and the case's policy unless it names another. */
export type Correction = {
    files: Record<string, string>;
    policy?: string | undefined;
    removed?: string[];
    executable?: string[];
};
/** A planted case that checks a finding at its source location, and what corrects it for the clean rerun. */
export type FindingCase = PlantedInput & {
    expected: Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;
    /** What the clean rerun plants instead; the case's policy with no files unless a case says otherwise. */
    corrected?: Correction;
    /** The platforms the case runs on; every platform unless the tool has no build elsewhere. */
    platforms?: NodeJS.Platform[];
    /** Whether the case needs a Docker daemon that runs Linux containers. */
    docker?: true;
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
