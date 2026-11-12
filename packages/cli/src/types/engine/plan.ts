import type { z } from 'zod';

import type { SKIP_CAUSES, STAGE_FILTERS } from '#cli/config/engine.ts';
import type { checkStateSchema } from '#cli/schemas/engine.ts';
import type { Check, Configuration, Tool } from '#cli/types/manifests.ts';
import type { RepositoryListing, StartRunner, TrackedFile, UntrackedFiles } from '#cli/types/repository.ts';
import type { Defined, Scope, Settings, TableValues } from '#cli/types/settings.ts';
import type { RunCache } from '#cli/types/system.ts';
import type { Host, ScopeCheck, Session, SessionBase } from '#cli/types/tools.ts';

type SkipCause = (typeof SKIP_CAUSES)[number];

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
    messageArgument?: string | undefined;
    unstagedChanges?: number | undefined;
};

export type CheckState = z.infer<typeof checkStateSchema>;

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

export type SettingsSkip = { cause: 'level' | 'condition' | 'ignore' | 'setting'; note: string };

export type PlannedCheck = ScopeCheck & {
    files: TrackedFile[];
    skip?: Skip | undefined;
    triggerPaths: string[];
    narrowedLinks?: string[] | undefined;
};

export type ShippedPlannedCheck = PlannedCheck & { configuration: Configuration };

export type FixerPlannedCheck = PlannedCheck & { check: Omit<Check, 'fix'> & { fix: [string, ...string[]] } };

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
    turnOff: { paths: string | null; rule: string | undefined };
    suppression: Tool['suppression'];
    crashPattern: string | undefined;
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
    startRunner?: StartRunner | undefined;
};

export type ConfigurationTables = Defined<
    Required<Omit<TableValues, 'format' | 'limits' | 'naming' | 'structure' | `tools.${string}`>>
>;
