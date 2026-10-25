import type { Session } from '#cli/types/session.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { ConfigurationTables } from '#cli/types/settings/tables.ts';
import type { Tool, Stage, Check, Configuration } from '#cli/types/configurations.ts';

export type SkipCause = 'level' | 'system' | 'replaced' | 'setting' | 'condition' | 'ignore';

export type Skip = { cause: SkipCause; note: string };

export type Host = { platform: string; arch: string };

export type PlanOptions = {
    forConfiguration?: boolean;
    base?: string;
    commits?: string[];
    shallow?: boolean;
    stage: StageFilter | 'any';
    staged?: string[];
    changed?: string[];
    only?: string[];
    paths?: string[];
    messageFile?: string;
};

export type PlannedScope = {
    session: Session;
    scope: Scope;
    options: PlanOptions;
    host: Host;
    narrowedPaths: Set<string> | undefined;
    children: string[];
};

export type SettingsSkip = { cause: 'level' | 'ignore' | 'setting'; note: string };

export type PlannedCheck = {
    base?: string;
    commits?: string[];
    scope: Scope;
    check: Check;
    configuration?: Configuration;
    files: TrackedFile[];
    tool?: Tool;
    skip?: Skip;
    triggerPaths: string[];
    messageFile?: string;
};

export type StageFilter = Stage | 'all';

export type LicenseProject = {
    dependencyFile: string;
    scope: Scope;
    settings: ConfigurationTables['licenses'];
    skip: SettingsSkip | undefined;
};

export type LimitCheck = { check: string; languages: readonly string[]; limits: readonly string[] };

export type SettingReader = { check: string; enabled: boolean; note?: string };
