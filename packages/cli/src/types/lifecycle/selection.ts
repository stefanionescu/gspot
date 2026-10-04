import type { Template } from '#cli/types/policy/templates.ts';
import type { ManifestSummary } from '#cli/types/parsers/packages.ts';
import type { Policy, Mutation } from '#cli/types/policy/settings.ts';
import type { Manifest, ConfigurationEvidence } from '#cli/types/configurations.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    configurations?: string[];
    scopes?: string[];
    hooks?: boolean;
    ci?: NonNullable<Policy['ci']>['provider'] | 'none';
    rules?: boolean;
    runner?: NonNullable<Policy['run_with']> | 'none';
    from?: string;
    template?: Template;
    isListExact?: boolean;
    install: boolean;
};

export type ConfigurationReason = 'named' | 'detected' | 'recommended' | 'required';

/** What init selection reads. */
export type InitDetection = {
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    fields: ManifestSummary[];
    options: InitOptions;
    /** Whether the folder is a git repository; a configuration whose checks all read git stays out otherwise. */
    hasGit: boolean;
};

/** The configurations init selects: at the root, per scope, and the closure of both. */
export type InitSelection = {
    scopes: ScopeEntry[];
    rootIds: string[];
    scopeConfigurations: Map<string, string[]>;
    selectedIds: Set<string>;
    detected: ConfigurationEvidence[];
    how: Map<string, ConfigurationReason>;
};

/** The inputs to init selection. */
export type InitInputs = {
    root: string;
    repo: Repository;
    fields: ManifestSummary[];
    workspace: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: InitOptions;
};

/** Policy mutation and selection changes calculated from repository evidence. */
export type ConfigurationReconciliation = { mutate: Mutation; notes: string[] };

/** Explicit, detected, and recommended choices for explaining initial selection. */
export type ConfigurationChoices = { named: Set<string>; chosen: Set<string>; listed: Set<string> };
