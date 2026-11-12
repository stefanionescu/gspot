import type { z } from 'zod';

import type { CHECK_INPUT_HOOKS } from '#cli/config/commands/reports.ts';
import type {
    checkExplanationSchema,
    checkIgnoreSchema,
    ciStateSchema,
    configurationExplanationSchema,
    configurationsListSchema,
    doctorReportSchema,
    doctorToolSchema,
    lintRuleExplanationSchema,
    pathExplanationSchema,
    pushReportSchema,
    scanCategorySchema,
    scanReportSchema,
    settingExplanationSchema,
    settingsListSchema,
} from '#cli/schemas/commands.ts';
import type { RunSelection, SessionOptions, StageFilter } from '#cli/types/engine/plan.ts';
import type { CheckProgress, PushInput, RunReport } from '#cli/types/engine/run.ts';
import type { CarryoverRow, InitPlanning } from '#cli/types/generation.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { PushedRevisions } from '#cli/types/repository.ts';
import type { InheritedSetting } from '#cli/types/settings.ts';
import type { CanceledCommandJson, CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

export type PushReport = z.infer<typeof pushReportSchema>;

export type RevisionCheckResult = CommandResult<RunReport> | { skipped: PushedRevisions['skipped'][number]['reason'] };

export type CheckOptions = {
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
    messageArgument?: string | undefined;
    verbose: boolean;
    session?: Pick<SessionOptions, 'toolCache' | 'settings' | 'listing'>;
};

export type RevisionSource = {
    session: Pick<SessionOptions, 'toolsRoot' | 'untracked' | 'unreadablePaths'>;
    selection: RunSelection & { content: 'index' | 'commit' };
    started?: Date;
    dependencyNote?: string;
    missingToolsNote?: string;
};

type CheckHook = (typeof CHECK_INPUT_HOOKS)[number];

export type CheckFlags = {
    only?: string[];
    skip?: string[];
    staged?: boolean;
    base?: string;
    fix?: boolean;
    hook?: CheckHook;
    verbose?: boolean;
};

export type CheckCommandJson = RunReport | PushReport | CanceledCommandJson;

export type ConfigurationsListJson = z.infer<typeof configurationsListSchema>;

export type SettingsListJson = z.infer<typeof settingsListSchema>;

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
    scopePath: string;
    shipped: unknown;
    inherited: InheritedSetting | undefined;
    readBy: string[];
};

export type ConfigurationExplanation = z.infer<typeof configurationExplanationSchema>;

export type ScanCategory = z.infer<typeof scanCategorySchema>;

export type ScanReport = z.infer<typeof scanReportSchema>;

export type ScanInput = {
    planning: InitPlanning;
    session: Session;
    report: RunReport;
    toolBytes: number;
    ruleRows: CarryoverRow[];
    leftOut: string[];
};

export type ScanSection = { title: string; rows: string[] };
