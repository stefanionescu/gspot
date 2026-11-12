import { z } from 'zod';

import { GROUPS, REASON_DESCRIPTIONS, SETTING_TYPES, TOOL_KINDS } from '#cli/config/manifests.ts';
import { CI_PROVIDERS } from '#cli/config/settings/schema.ts';
import { checkStateSchema, findingSchema, reportedCheckSchema, runReportSchema } from '#cli/schemas/engine.ts';
import { generatedFilesSchema, initPlanSchema } from '#cli/schemas/generation.ts';
import { checkFieldsSchema, fileKindSchema } from '#cli/schemas/manifests/manifest.ts';
import { pushSkipSchema } from '#cli/schemas/repository.ts';
import { removedConfigurationSchema, settingOriginSchema } from '#cli/schemas/settings/fields.ts';
import { installResultSchema, toolInspectionSchema } from '#cli/schemas/tools.ts';

export const installReportSchema = generatedFilesSchema.extend({
    ...installResultSchema.shape,
    summary: z.string(),
});

export const doctorToolSchema = toolInspectionSchema.extend({ kind: z.enum(TOOL_KINDS) });

export const ciStateSchema = z.strictObject({
    enabled: z.boolean(),
    provider: z.enum(CI_PROVIDERS).nullable(),
    file: z.string().nullable(),
});

export const doctorReportSchema = z.strictObject({
    submodules: z.string().array(),
    tools: doctorToolSchema.array(),
    environments: z.string().array(),
    hooks: z.strictObject({ ready: z.boolean(), tool: z.string().nullable(), lines: z.string().array() }),
    ci: ciStateSchema,
    ruleFileCount: z.int(),
    pin: z.string().nullable(),
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

const reasonRequirementSchema = z.enum(Object.keys(REASON_DESCRIPTIONS) as Array<keyof typeof REASON_DESCRIPTIONS>);

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

export const settingsEditReportSchema = generatedFilesSchema.extend({ changed: z.boolean(), summary: z.string() });

export const settingExplanationSchema = z.strictObject({
    setting: z.string(),
    type: z.enum(SETTING_TYPES),
    description: z.string(),
    default: z.unknown(),
    defaultAll: z.unknown(),
    languageDefaults: z.record(z.string(), z.unknown()).nullable(),
    reasonFor: reasonRequirementSchema.nullable(),
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

export const pushReportSchema = z.strictObject({
    canceled: z.strictObject({ pendingRefs: z.string().array() }).nullable(),
    revisions: z
        .strictObject({
            hash: z.string(),
            refs: z.string().array(),
            commits: z.string().array(),
            shallow: z.boolean(),
            report: runReportSchema,
        })
        .array(),
    skipped: pushSkipSchema.array(),
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
    ...installResultSchema.shape,
    root: z.string(),
    plan: initPlanSchema,
    settingsText: z.string(),
});

export const checkIgnoreSchema = z.strictObject({
    rule: z.string().optional(),
    paths: z.string().array().optional(),
    reason: z.string(),
    command: z.string(),
});

export const checkExplanationSchema = z.strictObject({
    check: z.string(),
    configuration: z.string().nullable(),
    command: z.string().array().readonly().nullable(),
    paths: z.string().array().readonly().nullable(),
    stage: z.string(),
    level: z.string(),
    summary: z.string(),
    why: z.string(),
    help: z.string(),
    condition: checkFieldsSchema.shape.when.unwrap().nullable(),
    crashPattern: z.string().nullable(),
    runInCopy: z.boolean().nullable(),
    minVersions: z.record(z.string(), z.string()),
    turnOff: z.strictObject({ paths: z.string().nullable(), rule: z.string().nullable() }),
    settingNames: z.string().array(),
    ruleFiles: z.string().array(),
    selected: z.boolean().nullable(),
    ignores: checkIgnoreSchema.array(),
});

export const lintRuleExplanationSchema = z.strictObject({
    tool: z.string().nullable(),
    rule: z.string(),
    check: z.string(),
    page: z.string().nullable(),
    description: z.string().nullable(),
    why: z.string().nullable(),
    fix: z.string().nullable(),
    example: z.string().nullable(),
    explanation: z.string().nullable(),
    turnOff: z.strictObject({ everywhere: z.string(), paths: z.string().nullable() }),
    changeOptions: z.string().nullable(),
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
    fileKind: fileKindSchema,
    fileKindOrigin: z.string(),
    tags: z.string().array(),
    configurations: z.string().array(),
    checks: z
        .strictObject({ check: z.string(), stage: z.string(), state: z.string(), configuration: z.string().optional() })
        .array(),
    ignores: z.strictObject({ check: z.string().optional(), rule: z.string().optional(), reason: z.string() }).array(),
    unchecked: z.string().nullable(),
    remedy: z.string().nullable(),
});
