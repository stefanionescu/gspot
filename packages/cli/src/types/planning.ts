import type { Session } from '#cli/types/session.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { Tool, Stage, Check, Configuration } from '#cli/types/configurations.ts';
import type { ConfigurationTables } from '#cli/types/settings/configuration-tables.ts';

export type SkipCause = 'level' | 'system' | 'replaced' | 'setting' | 'condition' | 'ignore';

export type Skip = { cause: SkipCause; note: string };

/** The system name and architecture for a run. */
export type Host = { platform: string; arch: string };

export type PlanOptions = {
    /** Plan the checks that the settings configure: keep checks this system cannot run, and read no ignore file that gspot writes. */
    forConfiguration?: boolean;
    base?: string;
    commits?: string[];
    historyComplete?: boolean;
    stage: StageFilter | 'any';
    staged?: string[];
    changed?: string[];
    only?: string[];
    /** Root-relative paths that the positional file and folder arguments name. */
    paths?: string[];
    messageFile?: string;
};

/** What planning one scope needs. */
export type PlannedScope = {
    session: Session;
    scope: Scope;
    options: PlanOptions;
    host: Host;
    narrowedPaths: Set<string> | undefined;
    children: string[];
};

/** The settings reason that turns a check off. */
export type SettingsSkip = { cause: 'level' | 'ignore' | 'setting'; note: string };

/** The file that a check passes with --ignore-path, and a matcher for the paths it ignores. */
export type ToolIgnore = { file: string; matches: (path: string) => boolean };

export type PlannedCheck = {
    base?: string;
    commits?: string[];
    scope: Scope;
    check: Check;
    configuration?: Configuration;
    files: TrackedFile[];
    tool?: Tool;
    skip?: Skip;
    /** Changed paths absent from the readable tree that still trigger a project check. */
    triggerPaths: string[];
    messageFile?: string;
};

export type StageFilter = Stage | 'all';

/**
 * A dependency file that the licenses check reads, with its scope, its allowed licenses, and the skip that the settings
 * cause.
 */
export type LicenseProject = {
    dependencyFile: string;
    scope: Scope;
    settings: ConfigurationTables['licenses'];
    skip: SettingsSkip | undefined;
};
