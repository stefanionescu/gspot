import type { z } from 'zod';
import type { Session } from '#cli/types/tools.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import type { Settings, InheritedSetting } from '#cli/types/settings.ts';
import type { Check, Setting, Configuration } from '#cli/types/manifests.ts';
import type { RunReport, PushInput, CheckProgress } from '#cli/types/engine/run.ts';
import type { InitPlan, CarryoverRow, InitPlanning } from '#cli/types/generation.ts';
import type { CHECK_STAGES, CHECK_INPUT_HOOKS } from '#cli/config/commands/reports.ts';
import type { RunCache, CommandResult, CanceledCommandJson } from '#cli/types/system.ts';
import type { StageFilter, RunSelection, CheckDescription } from '#cli/types/engine/plan.ts';
import type { FileKind, UntrackedFiles, PushedRevisions, RepositoryListing } from '#cli/types/repository.ts';

import type {
    ciStateSchema,
    doctorToolSchema,
    suggestionsSchema,
    settingsListSchema,
    doctorReportSchema,
    suggestionRowSchema,
    baselineReportSchema,
    configurationsListSchema,
} from '#cli/schemas/commands.ts';

type CheckedRevision = { hash: string; refs: string[]; commits: string[]; shallow: boolean; report: RunReport };

export type PushReport = {
    canceled?: { pendingRefs: string[] };
    revisions: CheckedRevision[];
    skipped: PushedRevisions['skipped'];
    exitCode: number;
};

export type RevisionCheckResult = CommandResult<RunReport> | { skipped: PushedRevisions['skipped'][number]['reason'] };

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

export type RevisionSource = {
    toolsRoot: string;
    selection: RunSelection & { content: 'index' | 'commit' };
    untracked?: UntrackedFiles;
    started?: Date;
    dependencyNote?: string;
    unreadablePaths?: string[];
};

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

export type ConfigurationsListJson = z.infer<typeof configurationsListSchema>;

export type SettingsListJson = z.infer<typeof settingsListSchema>;

export type SuggestionRow = z.infer<typeof suggestionRowSchema>;

export type Suggestions = z.infer<typeof suggestionsSchema>;

export type DoctorTool = z.infer<typeof doctorToolSchema>;

export type DoctorReport = z.infer<typeof doctorReportSchema>;

export type CiState = z.infer<typeof ciStateSchema>;

export type Explanation = { subject: string; text: string } & (
    | { kind: 'check'; facts: CheckExplanation }
    | { kind: 'lint-rule'; facts: LintRuleExplanation }
    | { kind: 'configuration'; facts: ConfigurationExplanation }
    | { kind: 'setting'; facts: SettingExplanation }
    | { kind: 'path'; facts: PathExplanation }
);

export type CheckExplanation = {
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
    minVersions: Record<string, string>;
    turnOff: CheckDescription['turnOff'];
    settingNames: string[];
    ruleFiles: string[];
    selected?: boolean;
    ignores: CheckIgnore[];
};

export type LintRuleExplanation = {
    tool: string | undefined;
    rule: string;
    check: string;
    page: string | null;
    description: string | null;
    why: string | undefined;
    fix: string | undefined;
    example: string | undefined;
    explanation: string | undefined;
    turnOff: { everywhere: string; paths: string };
    changeOptions: string | undefined;
};

type SettingExplanation = {
    setting: string;
    type: Setting['type'];
    description: string;
    default: unknown;
    defaultAll: unknown;
    languageDefaults: Setting['language_defaults'];
    reasonWhen: Setting['reason_when'];
    scopes: Array<{
        scope: string;
        default: unknown;
        value?: unknown;
        source?: InheritedSetting['origin'] | undefined;
        readBy?: string[];
        reason?: string | undefined;
    }>;
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
    checks: Array<{ check: string; stage: string; state: string; configuration?: string }>;
    ignores: Array<{ check?: string; rule?: string; reason: string }>;
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
    checks: Array<{ check: string; stage: string }>;
    settingNames: string[];
    ruleFiles: string[];
    alwaysSelected: boolean;
    removed: Array<{ scope: string; reason: string; command: string }>;
};

export type CheckFacts = {
    turnOff: CheckDescription['turnOff'];
    settings: string[];
    ruleFiles: string[];
    crashPattern: string | undefined;
    ignores: CheckIgnore[];
    minVersions: Record<string, string>;
};

export type ScanFlags = { markdown?: boolean; json?: boolean };

export type ScanCategory = { name: string; count: number; examples: Finding[] };

export type ScanReport = {
    totals: { files: number; checks: number; findings: number; filesFlagged: number; seconds: number };
    categories: ScanCategory[];
    filesToFormat: number;
    notRun: string[];
    cost: { tools: number; megabytes: number; perTool: Array<{ name: string; seconds: number }> };
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

export type BaselineFlags = { prune?: boolean; only?: string[] };

export type BaselineJson = z.infer<typeof baselineReportSchema>;
