import type { Manifest, Proposal } from '#cli/types/configurations.ts';
import type { FileSnapshot } from '#cli/types/filesystem.ts';
import type {
    CarriedConfiguration,
    CarriedFormatter,
    ConfigurationReason,
    TakeoverPlan,
} from '#cli/types/ownership.ts';
import type { Policy } from '#cli/types/policy.ts';
import type { Profile } from '#cli/types/profiles.ts';
import type { ExistingTooling, ManifestFacts, Repository, ScopeEntry, TrackedFile } from '#cli/types/repository.ts';

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
    runnerTasks?: import('#cli/schemas/runners.ts').RunnerTaskNames;
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
