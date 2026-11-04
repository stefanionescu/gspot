import { z } from 'zod';
import { checkStateSchema } from '#cli/schemas/engine.ts';
import { CI_PROVIDERS } from '#cli/config/settings/schema.ts';
import { generatedFilesSchema } from '#cli/schemas/generation.ts';
import { TOOL_KINDS, SETTING_TYPES } from '#cli/config/manifests.ts';
import { hookStatusSchema, toolInspectionSchema } from '#cli/schemas/tools.ts';

import {
    settingOriginSchema,
    reasonRequirementSchema,
    removedConfigurationSchema,
} from '#cli/schemas/settings/fields.ts';

export const commandFieldsSchema = z.strictObject({
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
            reasonWhen: reasonRequirementSchema.optional(),
            scope: z.string(),
        })
        .array(),
});

export const changedEditReportSchema = generatedFilesSchema.extend({ changed: z.boolean(), summary: z.string() });

export const settingsEditReportSchema = z.union([
    changedEditReportSchema,
    z.strictObject({ changed: z.literal(false), summary: z.string(), notes: z.string().array() }),
]);

export const settingExplanationSchema = z.strictObject({
    setting: z.string(),
    type: z.enum(SETTING_TYPES),
    description: z.string(),
    default: z.unknown().optional(),
    defaultAll: z.unknown().optional(),
    languageDefaults: z.record(z.string(), z.unknown()).optional(),
    reasonWhen: reasonRequirementSchema.optional(),
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
