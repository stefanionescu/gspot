import type { Finding } from '#cli/types/execution/runtime.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';

/** What the clean rerun of a test case writes: corrected files, and the case's policy unless it names another. */
export type Correction = {
    files: Record<string, string>;
    /** TOML tables appended to the installed policy; an explicit undefined drops the case policy. */
    policy?: string | undefined;
    removed?: string[];
    /** Executable paths; an explicit undefined drops the case list. */
    executable?: string[] | undefined;
};

/** A test case that checks a finding at its source location, and what corrects it for the clean rerun. */
export type FindingCase = CaseChanges & {
    expected: Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;
    /** What the clean rerun writes instead; the case's policy with no files unless a case says otherwise. */
    corrected?: Correction;
    /** The platforms the case runs on; every platform unless the tool has no build elsewhere. */
    platforms?: NodeJS.Platform[];
    /** Whether the case needs a Docker daemon that runs Linux containers. */
    docker?: true;
};

/** A CLI invocation selected by the test that owns the scenario. */
export type CheckCommand = (cwd: string, argv: string[], environment: Record<string, string>) => Promise<SpawnOutcome>;
