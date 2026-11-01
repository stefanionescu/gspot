import type { ToolInspection } from '#cli/types/tools.ts';
import type { Setting, Configuration } from '#cli/types/manifests.ts';
import type { StageFilter, CheckDescription } from '#cli/types/engine/plan.ts';
import type { CommandResult, CanceledCommandJson } from '#cli/types/system.ts';
import type { RunReport, PushInput, CheckProgress } from '#cli/types/engine/run.ts';
import type { InheritedSetting, RemovedConfiguration } from '#cli/types/settings.ts';
import type { CHECK_STAGES, CHECK_INPUT_HOOKS } from '#cli/config/commands/reports.ts';
import type { FileKind, StagedPaths, ChangedPaths, PushedRevisions } from '#cli/types/repository.ts';

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
    paths: string[];
    staged: boolean;
    push?: PushInput | undefined;
    base?: string | undefined;
    fix: boolean;
    stage?: StageFilter | undefined;
    messageFile?: string | undefined;
    verbose: boolean;
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
    json?: boolean;
    only?: string[];
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
    reason_when: Setting['reason_when'];
    scope: string;
};

export type ConfigurationsListJson = {
    selected: { name: string; checks: { name: string; scope: string; state: string }[] }[];
    removed: RemovedConfiguration[];
    available: { name: string; description: string }[];
};

export type SettingsListJson = { settings: SettingRow[] };

type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

export type SuggestionRow = { path: string; note: string; command?: string };

export type Suggestions = {
    detected: ConfigurationSuggestion[];
    suggested: ConfigurationSuggestion[];
    undetected: ConfigurationSuggestion[];
    unowned: SuggestionRow[];
    lintJobs: SuggestionRow[];
};

export type DoctorReport = {
    submodules: string[];
    tools: ToolInspection[];
    environments: string[];
    suggestions: Suggestions;
    addCommands: string[];
    hooks: string;
    ci: string;
    ruleFiles: number;
    exitCode: number;
};

export type Explanation = {
    kind: 'check' | 'lint-rule' | 'configuration' | 'setting' | 'path';
    subject: string;
    text: string;
    facts: Record<string, unknown>;
};

export type CheckIgnore = { rule?: string | undefined; paths?: string[] | undefined; reason: string; command: string };

export type PathExplanation = {
    path: string;
    scope: string;
    fileKind: FileKind;
    fileKindOrigin?: string;
    tags: string[];
    configurations: string[];
    checks: { check: string; stage: string; configuration?: string }[];
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
    rules: string[];
    alwaysSelected: boolean;
    removed: { scope: string; reason: string; command: string }[];
};

export type CheckFacts = {
    turnOff: CheckDescription['turnOff'];
    source: string;
    settings: string[];
    rules: string[];
    crashPattern: string | undefined;
    ignores: CheckIgnore[];
    minVersions: Record<string, string>;
};
