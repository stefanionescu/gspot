import type { Snapshot } from '#cli/types/platform/root.ts';
import type { TomlTable, PolicyScope } from '#cli/types/policy/settings.ts';
import type { Manifest, ConfigurationEvidence } from '#cli/types/configurations.ts';
import type { Tooling, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

import type {
    CiChoice,
    InitOptions,
    RunnerChoice,
    InitSelection,
    ConfigurationReason,
} from '#cli/types/lifecycle/selection.ts';

export type Choice<T extends string> = { value: T; label: string; hint?: string | undefined };

export type Planning = {
    root: string;
    hasGit: boolean;
    options: InitOptions;
    tooling: Tooling;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    replaced: Replaced;
};

export type InitPlan = {
    ci?: { commands: string[] };
    template?: { name: string; digest: string; selection: string; detected: string[] };
    configurations: { configuration: string; how: ConfigurationReason; checks: number }[];
    write: InitFileRow[];
    remove: InitFileRow[];
    unread: InitFileRow[];
    retained: InitFileRow[];
    change: InitFileRow[];
    noLongerRuns: InitFileRow[];
};

/** The authored configuration init replaces: what it read, what it deletes, and what stays for the developer. */
export type Replaced = {
    read: Map<string, Snapshot>;
    removed: InitFileRow[];
    unread: InitFileRow[];
    retained: InitFileRow[];
};

export type PolicyDraft = {
    templateTables?: TomlTable;
    configurations: string[];
    scopes: PolicyScope[];
    hooks: boolean;
    ci: CiChoice;
    rules: boolean;
    runner: RunnerChoice;
    commitScopes?: string[];
};

/** The answers init collects from flags or the terminal. */
export type InitAnswers = {
    hooks: boolean;
    ci: CiChoice;
    rules: boolean;
    runner: RunnerChoice;
};

/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    plan: InitPlan;
    policyText: string;
    removed: { path: string }[];
    read: Map<string, Snapshot>;
};

export type Written = { lines: string[]; installNote: string; exitCode: number };

export type RetirementResult = { removed: string[]; preserved: string[] };

/** The JSON the init command prints: the plan, the policy it wrote or previewed, and what stopped it. */
export type InitJson = {
    root?: string;
    plan?: InitPlan;
    policy?: string;
    dryRun?: boolean;
    written?: boolean;
    error?: string;
    message?: string;
    /** What the tool installation said, when it did not finish. */
    note?: string;
};

export type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: ScopeEntry[];
    tooling: Tooling;
    owned: string[];
    unowned: string[];
    manifests: Map<string, Manifest>;
    hasGit: boolean;
};

/** A detected configuration family printed as one initialization section. */

/** A file initialization writes, removes, or preserves, with its explanation. */
export type InitFileRow = { path: string; note: string };
