import type { RunCache } from '#cli/types/system.ts';
import type { STAGE_FILTERS } from '#cli/config/engine.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import type { Host, Session, ScopeCheck, SessionBase } from '#cli/types/tools.ts';
import type { Scope, Defined, Settings, TableValues } from '#cli/types/settings.ts';
import type { TrackedFile, UntrackedFiles, RepositoryListing } from '#cli/types/repository.ts';

export type SkipCause = 'level' | 'system' | 'replaced' | 'setting' | 'condition' | 'ignore';

export type Skip = { cause: SkipCause; note: string };

export type RunSelection = {
    content: 'working-tree' | 'index' | 'commit' | 'message';
    reference?: string | undefined;
    base?: string | undefined;
    paths?: string[] | undefined;
    commits?: string[] | undefined;
    range?: string[] | undefined;
    shallow?: boolean | undefined;
    messageFile?: string | undefined;
    unstagedChanges?: number | undefined;
};

export type PlanOptions = {
    stage: StageFilter | 'any';
    keepLevelOff?: boolean | undefined;
    only?: string[] | undefined;
    skip?: string[] | undefined;
    paths?: string[] | undefined;
    selection?: RunSelection | undefined;
};

export type PlannedScope = {
    session: SessionBase & Pick<Session, 'toolConfigurations'>;
    scope: Scope;
    options: PlanOptions;
    host: Host;
    narrowedPaths: Set<string> | undefined;
    children: string[];
    inventory: PlanInventory;
};

export type PlanInventory = {
    trackedPaths: ReadonlySet<string>;
    narrowedFiles: TrackedFile[] | undefined;
    scopeFiles: Map<string, TrackedFile[]>;
    ownFiles: Map<string, TrackedFile[]>;
};

export type SettingsSkip = { cause: 'level' | 'ignore' | 'setting'; note: string };

export type PlannedCheck = ScopeCheck & {
    files: TrackedFile[];
    skip?: Skip | undefined;
    triggerPaths: string[];
    narrowedLinks?: string[] | undefined;
};

export type StageFilter = (typeof STAGE_FILTERS)[number];

export type SettingReader = { check: string; enabled: boolean; note?: string };

export type PrettierPlugin = {
    name: string;
    module: string;
    overrides: Array<{ files: string; options: Record<string, unknown> }>;
};

export type CheckDescription = {
    toolName: string | undefined;
    tools: string[];
    programs: string[];
    systems: string[] | undefined;
    needs: NonNullable<Check['needs']>;
    minVersions: Record<string, string>;
    turnOff: { paths: string; rule: string | undefined };
    suppression: Tool['suppression'];
};

export type SessionOptions = {
    toolsRoot?: string;
    cache?: RunCache | undefined;
    toolCache?: RunCache | undefined;
    listing?: RepositoryListing | undefined;
    untracked?: UntrackedFiles | undefined;
    settings?: Settings | undefined;
    unreadablePaths?: string[] | undefined;
    resources?: Disposable[];
    cancelSignal?: AbortSignal | undefined;
};

export type ConfigurationTables = Defined<
    Required<Omit<TableValues, 'format' | 'limits' | 'naming' | 'structure' | `tools.${string}`>>
>;
