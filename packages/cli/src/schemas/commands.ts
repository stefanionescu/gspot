import { z } from 'zod';

import { FILE_KINDS, GROUPS, SETTING_TYPES, TOOL_KINDS } from '#cli/config/manifests.ts';
import { PUSH_SKIP_REASONS } from '#cli/config/repository/git.ts';
import { CI_PROVIDERS } from '#cli/config/settings/schema.ts';
import {
    checkStateSchema,
    findingSchema,
    fixReportSchema,
    reportedCheckSchema,
    runReportSchema,
} from '#cli/schemas/engine.ts';
import { generatedFilesSchema, initPlanSchema } from '#cli/schemas/generation.ts';
import { checkFieldsSchema } from '#cli/schemas/manifests/manifest.ts';
import {
    reasonRequirementSchema,
    removedConfigurationSchema,
    settingOriginSchema,
} from '#cli/schemas/settings/fields.ts';
import { hookStatusSchema, toolInspectionSchema } from '#cli/schemas/tools.ts';

const commandFieldsSchema = z.strictObject({
    version: z.string(),
    exitCode: z.int(),
    notes: z.string().array(),
});

export const baselineReportSchema = z.strictObject({
    summary: z.string(),
    findingCount: z.int(),
    fileCount: z.int(),
    leftOut: z.string().array(),
});

export const installReportSchema = generatedFilesSchema.extend({
    summary: z.string(),
    installed: z.string().array(),
    steps: z.string().array().readonly().array().readonly(),
    missing: z.string().array(),
});

const configurationSuggestionSchema = z.strictObject({
    configuration: z.string(),
    evidence: z.string(),
    command: z.string(),
});

export const suggestionRowSchema = z.strictObject({
    path: z.string(),
    note: z.string(),
    command: z.string().optional(),
});

export const suggestionsSchema = z.strictObject({
    suggested: configurationSuggestionSchema.array(),
    undetected: configurationSuggestionSchema.array(),
    unowned: suggestionRowSchema.array(),
    lintCommands: suggestionRowSchema.array(),
});

export const doctorToolSchema = toolInspectionSchema.extend({ kind: z.enum(TOOL_KINDS) });

export const ciStateSchema = z.strictObject({
    enabled: z.boolean(),
    provider: z.enum(CI_PROVIDERS).optional(),
    file: z.string().optional(),
});

export const doctorReportSchema = z.strictObject({
    submodules: z.string().array(),
    tools: doctorToolSchema.array(),
    environments: z.string().array(),
    suggestions: suggestionsSchema,
    hooks: hookStatusSchema.omit({ text: true }),
    ci: ciStateSchema,
    ruleFileCount: z.int(),
});

const LISTED_CHECK_FIELDS = { check: z.string(), scope: z.string() };

const [onCheckSchema, skippedCheckSchema] = checkStateSchema.options;

const listedCheckSchema = z.discriminatedUnion('status', [
    onCheckSchema.extend(LISTED_CHECK_FIELDS),
    skippedCheckSchema.extend(LISTED_CHECK_FIELDS),
]);

export const configurationsListSchema = z.strictObject({
    selected: z.strictObject({ name: z.string(), checks: listedCheckSchema.array() }).array(),
    removed: removedConfigurationSchema.array(),
    available: z.strictObject({ name: z.string(), description: z.string() }).array(),
});

export const settingsListSchema = z.strictObject({
    settings: z
        .strictObject({
            setting: z.string(),
            value: z.unknown().optional(),
            source: settingOriginSchema,
            reasonFor: reasonRequirementSchema.optional(),
            scope: z.string(),
        })
        .array(),
});

const changedEditReportSchema = generatedFilesSchema.extend({ changed: z.boolean(), summary: z.string() });

const unchangedEditReportSchema = z.strictObject({
    changed: z.literal(false),
    summary: z.string(),
    notes: z.string().array(),
});

export const settingsEditReportSchema = z.union([changedEditReportSchema, unchangedEditReportSchema]);

export const settingExplanationSchema = z.strictObject({
    setting: z.string(),
    type: z.enum(SETTING_TYPES),
    description: z.string(),
    default: z.unknown().optional(),
    defaultAll: z.unknown().optional(),
    languageDefaults: z.record(z.string(), z.unknown()).optional(),
    reasonFor: reasonRequirementSchema.optional(),
    scopes: z
        .strictObject({
            scope: z.string(),
            default: z.unknown().optional(),
            value: z.unknown().optional(),
            source: settingOriginSchema.optional(),
            readBy: z.string().array().optional(),
            reason: z.string().optional(),
        })
        .array(),
});

export const checkReportSchema = runReportSchema.extend({ fixes: fixReportSchema.optional() });

export const pushReportSchema = z.strictObject({
    canceled: z.strictObject({ pendingRefs: z.string().array() }).optional(),
    revisions: z
        .strictObject({
            hash: z.string(),
            refs: z.string().array(),
            commits: z.string().array(),
            shallow: z.boolean(),
            report: runReportSchema,
        })
        .array(),
    skipped: z.strictObject({ ref: z.string(), hash: z.string(), reason: z.enum(PUSH_SKIP_REASONS) }).array(),
    exitCode: z.int(),
});

export const scanCategorySchema = z.strictObject({
    name: z.string(),
    count: z.int(),
    rules: z.strictObject({ check: z.string(), rule: z.string(), count: z.int() }).array(),
    examples: findingSchema.array(),
});

const toolTimeSchema = z.strictObject({ name: z.string(), seconds: z.number() });

export const scanReportSchema = z.strictObject({
    totals: z.strictObject({
        files: z.int(),
        checks: z.int(),
        findings: z.int(),
        filesFlagged: z.int(),
        seconds: z.number(),
    }),
    categories: scanCategorySchema.array(),
    filesToFormat: z.int(),
    notRun: z.string().array(),
    leftOut: z.string().array(),
    cost: z.strictObject({ tools: z.int(), megabytes: z.number(), perTool: toolTimeSchema.array() }),
    plan: initPlanSchema,
    settingsText: z.string(),
    nextSteps: z.string().array(),
    checks: reportedCheckSchema.array().readonly(),
});

export const initReportSchema = generatedFilesSchema.extend({
    root: z.string(),
    plan: initPlanSchema,
    settingsText: z.string(),
    installed: z.string().array(),
    missing: z.string().array(),
    steps: z.string().array().readonly().array().readonly(),
});

export const checkIgnoreSchema = z.strictObject({
    rule: z.string().optional(),
    paths: z.string().array().optional(),
    reason: z.string(),
    command: z.string(),
});

export const checkExplanationSchema = z.strictObject({
    check: z.string(),
    configuration: z.string().optional(),
    command: z.string().array().readonly().optional(),
    paths: z.string().array().readonly().optional(),
    stage: z.string(),
    level: z.string(),
    summary: z.string(),
    why: z.string(),
    help: z.string(),
    condition: checkFieldsSchema.shape.when,
    crashPattern: z.string().optional(),
    runInCopy: z.boolean().optional(),
    minVersions: z.record(z.string(), z.string()),
    turnOff: z.strictObject({ paths: z.string(), rule: z.string().optional() }),
    settingNames: z.string().array(),
    ruleFiles: z.string().array(),
    selected: z.boolean().optional(),
    ignores: checkIgnoreSchema.array(),
});

export const lintRuleExplanationSchema = z.strictObject({
    tool: z.string().optional(),
    rule: z.string(),
    check: z.string(),
    page: z.string().nullable(),
    description: z.string().nullable(),
    why: z.string().optional(),
    fix: z.string().optional(),
    example: z.string().optional(),
    explanation: z.string().optional(),
    turnOff: z.strictObject({ everywhere: z.string(), paths: z.string() }),
    changeOptions: z.string().optional(),
});

export const configurationExplanationSchema = z.strictObject({
    name: z.string(),
    group: z.enum(GROUPS),
    title: z.string(),
    description: z.string(),
    requires: z.string().array(),
    tools: z.string().array(),
    checks: z.strictObject({ check: z.string(), stage: z.string() }).array(),
    settingNames: z.string().array(),
    ruleFiles: z.string().array(),
    alwaysSelected: z.boolean(),
    removed: z.strictObject({ scope: z.string(), reason: z.string(), command: z.string() }).array(),
});

export const pathExplanationSchema = z.strictObject({
    path: z.string(),
    scope: z.string(),
    fileKind: z.enum(FILE_KINDS),
    fileKindOrigin: z.string().optional(),
    tags: z.string().array(),
    configurations: z.string().array(),
    checks: z
        .strictObject({ check: z.string(), stage: z.string(), state: z.string(), configuration: z.string().optional() })
        .array(),
    ignores: z.strictObject({ check: z.string().optional(), rule: z.string().optional(), reason: z.string() }).array(),
    unchecked: z.string().optional(),
    remedy: z.string().optional(),
});

const EXPLAIN_OUTPUT_FIELDS = { ...commandFieldsSchema.shape, subject: z.string() };

export const checkOutputSchema = checkExplanationSchema.extend({ ...EXPLAIN_OUTPUT_FIELDS, kind: z.literal('check') });

export const lintRuleOutputSchema = lintRuleExplanationSchema.extend({
    ...EXPLAIN_OUTPUT_FIELDS,
    kind: z.literal('lint-rule'),
});

export const configurationOutputSchema = configurationExplanationSchema.extend({
    ...EXPLAIN_OUTPUT_FIELDS,
    kind: z.literal('configuration'),
});

export const settingOutputSchema = settingExplanationSchema.extend({
    ...EXPLAIN_OUTPUT_FIELDS,
    kind: z.literal('setting'),
});

export const pathOutputSchema = pathExplanationSchema.extend({ ...EXPLAIN_OUTPUT_FIELDS, kind: z.literal('path') });

export const installOutputSchema = installReportSchema.extend(commandFieldsSchema.shape);

export const doctorOutputSchema = doctorReportSchema.extend(commandFieldsSchema.shape);

export const configurationsListOutputSchema = configurationsListSchema.extend(commandFieldsSchema.shape);

export const settingsListOutputSchema = settingsListSchema.extend(commandFieldsSchema.shape);

export const changedEditOutputSchema = changedEditReportSchema.extend(commandFieldsSchema.shape);

export const unchangedEditOutputSchema = unchangedEditReportSchema.extend(commandFieldsSchema.shape);

export const pushOutputSchema = pushReportSchema.extend(commandFieldsSchema.shape);

export const scanOutputSchema = scanReportSchema.extend(commandFieldsSchema.shape);

export const initOutputSchema = initReportSchema.extend(commandFieldsSchema.shape);
