import type { Finding } from '#cli/types/engine/tool-runs.ts';
import type { StageFilter, CheckDescription } from '#cli/types/engine/plan.ts';
import type { Session, HookStatus, ToolInspection } from '#cli/types/tools.ts';
import type { Tool, Check, Setting, Configuration } from '#cli/types/manifests.ts';
import type { RunReport, PushInput, CheckProgress } from '#cli/types/engine/run.ts';
import type { InitPlan, CarryoverRow, InitPlanning } from '#cli/types/generation.ts';
import type { RunCache, CommandResult, CanceledCommandJson } from '#cli/types/system.ts';
import type { Settings, InheritedSetting, RemovedConfiguration } from '#cli/types/settings.ts';
import type { CI_FILES, CHECK_STAGES, CHECK_INPUT_HOOKS } from '#cli/config/commands/reports.ts';
import type { FileKind, StagedPaths, ChangedPaths, PushedRevisions, RepositoryListing } from '#cli/types/repository.ts';

type CheckedRevision = { hash: string; refs: string[]; commits: string[]; shallow: boolean; report: RunReport };

export type PushReport = {
    canceled?: { pendingRefs: string[] };
    revisions: CheckedRevision[];
    skipped: PushedRevisions['skipped'];
    exitCode: number;
};

export type RevisionCheckResult = CommandResult<RunReport> | { skipped: PushedRevisions['skipped'][number]['reason'] };

export type RunFilters = {
    paths: string[] | undefined;
    changed: ChangedPaths | undefined;
    staging: StagedPaths | { staged: undefined; unstaged: number };
    stage: StageFilter;
};

export type CheckOptions = {
    changed?: boolean;
    hook?: CheckHook | undefined;
    onProgress?: ((progress: CheckProgress) => void) | undefined;
    cwd: string;
    only?: string[] | undefined;
    skip?: string[] | undefined;
    paths: string[];
    staged: boolean;
    push?: PushInput | undefined;
    base?: string | undefined;
    fix: boolean;
    stage?: StageFilter | undefined;
    messageFile?: string | undefined;
    verbose: boolean;
    toolCache?: RunCache | undefined;
    settings?: Settings | undefined;
    listing?: RepositoryListing | undefined;
};

export type RevisionSource = (
    | {
          content: 'index';
          cwd: string;
          paths: string[];
          toolsRoot: string;
          reference: string;
          reportRoot: string;
          staged: StagedPaths;
          started: Date;
      }
    | {
          content: 'commit';
          toolsRoot: string;
          reference: string;
          base?: string;
          commits: string[];
          range?: string[];
          shallow: boolean;
          changed?: string[];
      }
) & { dependencyNote?: string; unreadablePaths?: string[] };

type CheckHook = (typeof CHECK_INPUT_HOOKS)[number];

type CheckStage = (typeof CHECK_STAGES)[number];

export type CheckFlags = {
    stage?: CheckStage;
    only?: string[];
    skip?: string[];
    staged?: boolean;
    changed?: boolean;
    base?: string;
    fix?: boolean;
    hook?: CheckHook;
    verbose?: boolean;
};

export type CheckCommandJson = RunReport | PushReport | CanceledCommandJson;

type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    origin: InheritedSetting['origin'];
    originScope?: string | undefined;
    reasonRequirement: Setting['reason_when'];
    scope: string;
};

export type ConfigurationsListJson = {
    selected: { name: string; checks: { check: string; scope: string; status: string }[] }[];
    removed: RemovedConfiguration[];
    available: { name: string; description: string }[];
};

export type SettingsListJson = { settings: SettingRow[] };

type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

export type SuggestionRow = { path: string; note: string; command?: string };

export type Suggestions = {
    suggested: ConfigurationSuggestion[];
    undetected: ConfigurationSuggestion[];
    unowned: SuggestionRow[];
    lintCommands: SuggestionRow[];
};

export type DoctorTool = ToolInspection & { kind: Tool['kind'] };

export type DoctorReport = {
    submodules: string[];
    tools: DoctorTool[];
    environments: string[];
    suggestions: Suggestions;
    hooks: Omit<HookStatus, 'text'>;
    ci: CiState;
    ruleFiles: number;
};

export type CiState = { enabled: boolean; provider?: keyof typeof CI_FILES; file?: string };

export type Explanation = { subject: string; text: string } & (
    | { kind: 'check'; facts: CheckExplanation }
    | { kind: 'lint-rule'; facts: LintRuleExplanation }
    | { kind: 'configuration'; facts: ConfigurationExplanation }
    | { kind: 'setting'; facts: SettingExplanation }
    | { kind: 'path'; facts: PathExplanation }
);

type CheckExplanation = {
    check: string;
    configuration?: string;
    command?: readonly string[] | undefined;
    paths?: readonly string[] | undefined;
    stage: string;
    level: string;
    summary: string;
    why: string;
    help: string;
    condition: Check['when'];
    crashPattern: string | undefined;
    runInCopy: boolean | undefined;
    settings: string[];
    ruleFiles: string[];
    ignores: CheckIgnore[];
};

type LintRuleExplanation = {
    tool: string | undefined;
    rule: string;
    check: string;
    page: string | null;
    description: string | null;
    why: string | undefined;
    fix: string | undefined;
    example: string | undefined;
    explanation: string | undefined;
};

type SettingExplanation = {
    key: string;
    type: Setting['type'];
    description: string;
    default: unknown;
    defaultAll: unknown;
    languageDefaults: Setting['language_defaults'];
    reasonRequirement: Setting['reason_when'];
    scopes: {
        scope: string;
        default: unknown;
        value?: unknown;
        source?: string | undefined;
        readBy?: string[];
        reason?: string | undefined;
    }[];
};

export type ExplainedSetting = { setting: Setting; text: string; scopes: SettingExplanation['scopes'] };

export type CheckIgnore = { rule?: string | undefined; paths?: string[] | undefined; reason: string; command: string };

export type PathExplanation = {
    path: string;
    scope: string;
    fileKind: FileKind;
    fileKindOrigin?: string;
    tags: string[];
    configurations: string[];
    checks: { check: string; stage: string; state: string; configuration?: string }[];
    ignores: { check?: string; rule?: string; reason: string }[];
    unchecked?: string;
    remedy?: string;
};

export type SettingScope = {
    scope: string;
    shipped: unknown;
    inherited: InheritedSetting | undefined;
    readBy: string[];
};

export type ConfigurationExplanation = {
    name: string;
    group: Configuration['group'];
    title: string;
    description: string;
    requires: string[];
    tools: string[];
    checks: { check: string; stage: string }[];
    settings: string[];
    ruleFiles: string[];
    alwaysSelected: boolean;
    removed: { scope: string; reason: string; command: string }[];
};

export type CheckFacts = {
    turnOff: CheckDescription['turnOff'];
    source: string;
    settings: string[];
    ruleFiles: string[];
    crashPattern: string | undefined;
    ignores: CheckIgnore[];
    minVersions: Record<string, string>;
};

export type ScanFlags = { markdown?: boolean };

export type ScanCategory = { name: string; count: number; examples: Finding[] };

export type ScanReport = {
    totals: { files: number; checks: number; findings: number; filesFlagged: number; seconds: number };
    categories: ScanCategory[];
    filesToFormat: number;
    notRun: string[];
    cost: { tools: number; megabytes: number; perTool: { name: string; seconds: number }[] };
    plan: InitPlan;
    settingsText: string;
    nextSteps: string[];
    checks: RunReport['checks'];
};

export type ScanInput = {
    planning: InitPlanning;
    session: Session;
    report: RunReport;
    toolBytes: number;
    ruleRows: CarryoverRow[];
};

export type ScanSection = { title: string; rows: string[]; preformatted?: boolean };

export type BaselineFlags = { prune?: boolean };

export type BaselineJson = { summary: string; findings: number; files: number; leftOut: string[] };
