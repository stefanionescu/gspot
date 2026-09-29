// The types of the commands in this package.
import type { Read } from '#cli/types/platform.ts';
import type { CheckResult } from '#cli/types/checks.ts';
import type { Profile } from '#cli/types/policy/profiles.ts';
import type { ToolInspection } from '#cli/types/tools/tools.ts';
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';
import type { Policy, RawPolicy, ResolvedSetting } from '#cli/types/policy/policy.ts';
import type { StagedSet, ChangedSet, PushSelection } from '#cli/types/repository/revisions.ts';
import type { Manifest, CheckSpec, SettingSpec, UnknownLanguage, KitEvidence as Plan } from '#cli/types/kits.ts';
import type { Session, RunReport, PushReport, StageFilter, CoverageReport } from '#cli/types/execution/execution.ts';

import type {
    Fields,
    TomlTable,
    Repository,
    ScopeEntry,
    TrackedFile,
    ExistingTooling,
} from '#cli/types/repository/repository.ts';

export type SetOptions = {
    cwd: string;
    key: string;
    items: string[];
    reason?: string;
    scope?: string;
    replace: boolean;
    remove: boolean;
    toDefault: boolean;
};
export type InstallOptions = { cwd: string; isDryRun: boolean };
/** The JSON the install command prints: the planned steps of a dry run, or whether the installation completed. */
export type InstallJson = { isDryRun?: true; installed?: boolean; steps?: string[][]; hooks?: string; error?: string };
export type CommandResult = { text: string; json: unknown; exitCode: number };
/** The JSON a failed command prints: the error's name and message. */
export type CommandFailureJson = { error: string; message: string };
export type UninstallPlan = { remove: string[]; blocks: string[]; hooks: boolean };
/** gspot uninstall. */
export type UninstallOptions = { cwd: string; yes: boolean; isDryRun: boolean };
export type IgnoreOptions = {
    cwd: string;
    check: string;
    paths?: string[];
    rule?: string;
    reason?: string;
    remove: boolean;
};
export type Choice<T extends string> = { value: T; label: string; hint?: string | undefined };
export type AddOptions = { cwd: string; isDryRun: boolean; kits: string[]; scope?: string };
export type RemoveOptions = { cwd: string; isDryRun: boolean; kit: string; scope?: string };

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};
/** The JSON a dry-run apply prints: the version pin, the drifted files, and the notes of the plan. */
export type ApplyPreviewJson = {
    isDryRun: true;
    pin: { from: string | undefined; to: string };
    drift: DriftEntry[];
    notes: string[];
};

export type PushedRevision = PushSelection['revisions'][number];
export type Checked = PushReport['revisions'][number];
export type Selections = {
    paths: string[];
    changed: ChangedSet | undefined;
    set: StagedSet | { staged: undefined; unstaged: number };
    stage: StageFilter;
};
/** What a snapshot stands for: the staged index or a pushed commit, and where its report goes. */
export type Revision = {
    commits?: string[];
    historyComplete?: boolean;
    content: 'index' | 'commit';
    cacheRoot: string;
    reference: string;
    reportRoot?: string;
    staged?: StagedSet;
    changed?: string[];
};
export type CheckOptions = {
    onResult?: (result: CheckResult) => void;
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
    push?: { input: string; remote?: string };
    changed?: string;
    fix: boolean;
    isDryRun: boolean;
    stage?: StageFilter;
    skips: string[];
    messageFile?: string;
    quiet: boolean;
    verbose: boolean;
    noCache: boolean;
};
export type CheckCommandResult = CommandResult & { report?: RunReport };

export type ChangeReport = {
    detectedNotSelected: { kit: string; evidence: string; command: string }[];
    recommendedNotSelected: { kit: string; evidence: string; command: string }[];
    configurationNotOwned: { path: string; note: string; command: string }[];
    changedOutsideGspot: { path: string; note: string; command: string }[];
    pinnedTwice: { tool: string; version: string; places: string[]; command: string }[];
};
export type DoctorReport = {
    submodules: string[];
    tools: ToolInspection[];
    coverage: CoverageReport;
    changes: ChangeReport;
    hooks: string;
    ci: string;
    rules: { files: number };
    version: { running: string; pinned?: string };
    exitCode: number;
};
export type ChangeKey =
    | 'detectedNotSelected'
    | 'recommendedNotSelected'
    | 'configurationNotOwned'
    | 'changedOutsideGspot';
export type ChangeRow = { path: string; note: string; command: string };
export type DoctorOptions = { cwd: string };

export type SettingScope = { scope: string; shipped: unknown; current: ResolvedSetting | undefined };
export type Explanation = {
    kind: 'check' | 'tool-rule' | 'kit' | 'setting' | 'path';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};
export type PathExplanation = {
    path: string;
    scope: string;
    file: string;
    fileSource?: string;
    tags: string[];
    kits: string[];
    checks: { check: string; stage: string; kit?: string }[];
    ignores: { check: string; rule?: string; reason?: string }[];
    unchecked?: string;
    remedy?: string;
};
export type Found = { check: CheckSpec; kit: Manifest | undefined };
export type OwnCheck = Session['policyFiles']['policy']['checks'][number];
export type ExplainFields = { settings: string[]; rules: string[]; crashPattern: string | undefined };

export type Planning = {
    root: string;
    options: InitOptions;
    tooling: ExistingTooling;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    replaced: Replaced;
};
/** The authored configuration init replaces: what it read, what it deletes, and what stays for the developer. */
export type Replaced = {
    read: Map<string, Read>;
    removed: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
};
export type DetectionSummary = {
    files: TrackedFile[];
    plans: Plan[];
    scopes: ScopeEntry[];
    tooling: ExistingTooling;
    owned: string[];
    unowned: string[];
    unknown: UnknownLanguage[];
    manifests: Map<string, Manifest>;
    hasGit: boolean;
};
export type KitReason = 'named' | 'detected' | 'recommended' | 'required';
export type Detect = NonNullable<SettingSpec['detect']>;
export type DetectedSetting = { key: string; value: unknown; kit: string };
export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    json: boolean;
    kits?: string[];
    without?: string[];
    scopes?: string[];
    hooks?: NonNullable<Policy['hooks']>['tool'] | 'none';
    ci?: NonNullable<Policy['ci']>['provider'] | 'none';
    rules?: 'yes' | 'no';
    runner?: NonNullable<Policy['runner']>['tool'] | 'none';
    from?: string;
    profile?: Profile;
    isListExact?: boolean;
    install: boolean;
    allowDirty: boolean;
};
/** The JSON the init command prints: the plan, the policy it wrote or previewed, and what stopped it. */
export type InitJson = {
    root?: string;
    plan?: ReplacePlan;
    policy?: string;
    isDryRun?: boolean;
    written?: boolean;
    error?: string;
    install?: string;
};
export type InitResult = { text: string; json: InitJson; exitCode: number };
/** The configurations init selects: at the root, per scope, and the closure of both. */
export type InitSelection = {
    scopes: ScopeEntry[];
    rootIds: string[];
    scopePlans: Map<string, string[]>;
    selectedIds: Set<string>;
    rootPlans: Plan[];
    how: Map<string, KitReason>;
};
/** The answers init collects from flags or the terminal. */
export type InitAnswers = {
    hooks: NonNullable<Policy['hooks']>['tool'] | 'none';
    ci: NonNullable<Policy['ci']>['provider'] | 'none';
    isRules: boolean;
    runner: NonNullable<Policy['runner']>['tool'] | 'none';
};
/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    plan: ReplacePlan;
    policyText: string;
    runner: InitAnswers['runner'];
    removed: { path: string }[];
    read: Map<string, Read>;
};
/** What init selection reads. */
export type InitDetection = {
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    fields: Fields[];
    options: InitOptions;
    /** Whether the folder is a git repository; a configuration whose checks all read git stays out otherwise. */
    hasGit: boolean;
};
/** The inputs to init selection. */
export type InitInputs = {
    root: string;
    repo: Repository;
    fields: Fields[];
    workspace: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: InitOptions;
};
export type InitPlan = {
    profileTables?: TomlTable;
    kits: string[];
    scopes: { path: string; kits: string[] }[];
    hooks: NonNullable<RawPolicy['hooks']>['tool'] | 'none';
    ci: NonNullable<RawPolicy['ci']>['provider'] | 'none';
    rules: boolean;
    runner: NonNullable<RawPolicy['runner']>['tool'] | 'none';
    /** The Bun install safeguards found in each bunfig.toml, by scope path ('' for the root). */
    install?: { path: string; settings: InstallSettings }[];
    /** The Xcode project and scheme init found, for the tools.xcode table. */
    xcode?: { scope: string; project: string; scheme?: string };
    /** The settings init filled from the repository through their detect tables. */
    detected?: DetectedSetting[];
    commitScopes?: string[];
};
export type Written = { lines: string[]; installNote: string; exitCode: number };
export type Installed = { installNote: string; exitCode: number };
export type InstallSettings = { min_release_age_days?: number; security_scanner?: string };
export type ReplacePlan = {
    ci?: { commands: string[]; reports: string };
    profile?: { name: string; digest: string; selection: string; detected: string[] };
    kits: { kit: string; how: KitReason; checks: number }[];
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
};
