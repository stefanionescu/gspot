import type { Profile } from '#cli/policy/profiles/read.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { Repository } from '#cli/repository/tree.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';
import type { Proposal } from '#cli/configurations/detect.ts';
import type { TakeoverPlan } from '#cli/commands/init/plan.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import type { ManifestFacts } from '#cli/repository/manifests.ts';
import type { Manifest } from '#cli/configurations/read-manifests.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import type { ConfigurationReason } from '#cli/commands/init/selection.ts';
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';
import type { CarriedConfiguration, CarriedFormatter } from '#cli/policy/adoption/results.ts';

export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    json: boolean;
    configurations?: string[];
    without?: string[];
    scopes?: string[];
    hooks?: NonNullable<Policy['hooks']>['tool'] | 'none';
    ci?: NonNullable<Policy['ci']>['provider'] | 'none';
    rules?: 'yes' | 'no';
    format?: 'keep' | 'shipped';
    runner?: NonNullable<Policy['runner']>['tool'] | 'none';
    from?: string;
    profile?: Profile;
    isListExact?: boolean;
    install: boolean;
    allowDirty: boolean;
};

export type InitResult = { text: string; json: Record<string, unknown>; exitCode: number };

/** The configurations init selects: at the root, per scope, and the closure of both. */
export type InitSelection = {
    scopes: ScopeEntry[];
    rootIds: string[];
    scopeProposals: Map<string, string[]>;
    selectedIds: Set<string>;
    rootProposals: Proposal[];
    how: Map<string, ConfigurationReason>;
};

/** The answers init collects from flags or the terminal. */
export type InitAnswers = {
    hooks: NonNullable<Policy['hooks']>['tool'] | 'none';
    ci: NonNullable<Policy['ci']>['provider'] | 'none';
    isRules: boolean;
    runner: NonNullable<Policy['runner']>['tool'] | 'none';
    formatter?: CarriedFormatter;
};

/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    plan: TakeoverPlan;
    policyText: string;
    runner: InitAnswers['runner'];
    removed: { path: string }[];
    observed: Map<string, FileSnapshot>;
};

/** The inputs to the init plan. */
export type InitPlanInputs = {
    profile?: TakeoverPlan['profile'];
    root: string;
    tooling: ExistingTooling;
    everySelected: Manifest[];
    how: Map<string, ConfigurationReason>;
    answers: InitAnswers;
    runnerTasks?: import('#cli/policy/runner.ts').RunnerTaskNames;
    carried: CarriedConfiguration;
    policyLines: number;
    /** Instruction destinations resolved from the final proposed policy. */
    agents: string[];
};

/** What init selection reads. */
export type InitContext = {
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    facts: ManifestFacts[];
    options: InitOptions;
};

/** The inputs to init selection. */
export type InitInputs = {
    root: string;
    repo: Repository;
    facts: ManifestFacts[];
    workspace: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: InitOptions;
};
