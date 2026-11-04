import type { z } from 'zod';
import type { Session } from '#cli/types/tools.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { Settings, InheritedSetting } from '#cli/types/settings.ts';
import type { CarryoverRow, InitPlanning } from '#cli/types/generation.ts';
import type { RunReport, PushInput, CheckProgress } from '#cli/types/engine/run.ts';
import type { CHECK_STAGES, CHECK_INPUT_HOOKS } from '#cli/config/commands/reports.ts';
import type { RunCache, CommandResult, CanceledCommandJson } from '#cli/types/system.ts';
import type { StageFilter, RunSelection, CheckDescription } from '#cli/types/engine/plan.ts';
import type { UntrackedFiles, PushedRevisions, RepositoryListing } from '#cli/types/repository.ts';

import type {
    ciStateSchema,
    doctorToolSchema,
    pushReportSchema,
    scanReportSchema,
    suggestionsSchema,
    checkIgnoreSchema,
    settingsListSchema,
    doctorReportSchema,
    scanCategorySchema,
    suggestionRowSchema,
    baselineReportSchema,
    pathExplanationSchema,
    checkExplanationSchema,
    configurationsListSchema,
    settingExplanationSchema,
    lintRuleExplanationSchema,
    configurationExplanationSchema,
} from '#cli/schemas/commands.ts';

export type PushReport = z.infer<typeof pushReportSchema>;

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

export type CheckExplanation = z.infer<typeof checkExplanationSchema>;

export type LintRuleExplanation = z.infer<typeof lintRuleExplanationSchema>;

type SettingExplanation = z.infer<typeof settingExplanationSchema>;

export type ExplainedSetting = { setting: Setting; text: string; scopes: SettingExplanation['scopes'] };

export type CheckIgnore = z.infer<typeof checkIgnoreSchema>;

export type PathExplanation = z.infer<typeof pathExplanationSchema>;

export type SettingScope = {
    scope: string;
    shipped: unknown;
    inherited: InheritedSetting | undefined;
    readBy: string[];
};

export type ConfigurationExplanation = z.infer<typeof configurationExplanationSchema>;

export type CheckFacts = {
    turnOff: CheckDescription['turnOff'];
    settings: string[];
    ruleFiles: string[];
    crashPattern: string | undefined;
    ignores: CheckIgnore[];
    minVersions: Record<string, string>;
};

export type ScanFlags = { markdown?: boolean; json?: boolean };

export type ScanCategory = z.infer<typeof scanCategorySchema>;

export type ScanReport = z.infer<typeof scanReportSchema>;

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
