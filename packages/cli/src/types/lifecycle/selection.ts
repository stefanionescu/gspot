import type { Template } from '#cli/types/policy/templates.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import type { Policy, Mutation } from '#cli/types/policy/settings.ts';
import type { Manifest, ConfigurationEvidence } from '#cli/types/configurations.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

/** The CI provider init selects, including an explicit choice to write no workflow. */
export type CiChoice = NonNullable<Policy['ci']>['provider'] | 'none';

/** The runner init selects, including an explicit choice to write no task setup. */
export type RunnerChoice = NonNullable<Policy['runner']> | 'none';

export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    configurations?: string[];
    scopes?: Map<string, string[]>;
    hooks?: boolean;
    ci?: CiChoice;
    agentRules?: boolean;
    runner?: RunnerChoice;
    from?: string;
    template?: Template;
    install: boolean;
};

export type ConfigurationReason = 'named' | 'detected' | 'suggested' | 'required';

/** What init selection reads. */
export type InitDetection = {
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    packageManifests: PackageManifest[];
    options: Pick<InitOptions, 'configurations' | 'scopes' | 'template'>;
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
    packageManifests: PackageManifest[];
    workspace: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: Pick<InitOptions, 'configurations' | 'scopes' | 'template'>;
};

/** Policy mutation and selection changes calculated from repository evidence. */
export type ConfigurationReconciliation = { mutate: Mutation; notes: string[] };

/** Existing and detected choices with a scope's recorded overrides. */
export type ConfigurationMerge = {
    saved: string[];
    found: string[];
    removed: string[];
};

/** Explicit, detected, and recommended choices for explaining initial selection. */
export type ConfigurationChoices = { named: Set<string>; chosen: Set<string>; listed: Set<string> };
