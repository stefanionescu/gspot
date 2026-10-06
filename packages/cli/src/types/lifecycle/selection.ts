import type { Template } from '#cli/types/policy/templates.ts';
import type { Ownership } from '#cli/types/lifecycle/ownership.ts';
import type { Policy, Mutation } from '#cli/types/policy/settings.ts';
import type { ProjectManifest } from '#cli/types/parsers/packages.ts';
import type { Manifest, ConfigurationEvidence } from '#cli/types/configurations.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

/** The CI provider init selects, including an explicit choice to write no workflow. */
export type CiChoice = NonNullable<Policy['ci']>['provider'] | 'none';

/** The runner init selects, including an explicit choice to write no task setup. */
export type RunnerChoice = NonNullable<Policy['run_with']> | 'none';

export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    configurations?: string[];
    scopes?: string[];
    hooks?: boolean;
    ci?: CiChoice;
    rules?: boolean;
    runner?: RunnerChoice;
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
    projectManifests: ProjectManifest[];
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
    projectManifests: ProjectManifest[];
    workspace: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: InitOptions;
};

/** Policy mutation and selection changes calculated from repository evidence. */
export type ConfigurationReconciliation = { mutate: Mutation; notes: string[]; selections: ConfigurationSelections };

/** Private language and framework override history, by scope. */
export type ConfigurationSelections = NonNullable<Ownership['selections']>;

/** Authored choices and the last applied baseline for identifying edits. */
export type SelectionUpdate = {
    choices: ReadonlyMap<string, string[]>;
    manifests: Map<string, Manifest>;
    previous: ConfigurationSelections;
};

/** Existing and detected choices with a scope's recorded overrides. */
export type ConfigurationMerge = {
    saved: string[];
    found: string[];
    overrides: ConfigurationSelections[string] | undefined;
};

/** Explicit, detected, and recommended choices for explaining initial selection. */
export type ConfigurationChoices = { named: Set<string>; chosen: Set<string>; listed: Set<string> };
