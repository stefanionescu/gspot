import { z } from 'zod';

import {
    configurationsListSchema,
    doctorReportSchema,
    initReportSchema,
    installReportSchema,
    pathExplanationSchema,
    pushReportSchema,
    scanReportSchema,
    settingExplanationSchema,
    settingsEditReportSchema,
    settingsListSchema,
} from '#cli/schemas/commands.ts';

const commandFieldsSchema = z.strictObject({
    version: z.string(),
    exitCode: z.int(),
    notes: z.string().array(),
});

const EXPLAIN_OUTPUT_FIELDS = { ...commandFieldsSchema.shape, subject: z.string() };

export const runtimePinsSchema = z.object({
    tools: z.object({ bun: z.string(), node: z.string() }),
});

export const tsconfigSchema = z.object({
    extends: z.string().optional(),
    include: z.string().array().optional(),
    exclude: z.string().array().optional(),
    compilerOptions: z.object({ typeRoots: z.string().array().optional() }).optional(),
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

export const settingsEditOutputSchema = settingsEditReportSchema.extend(commandFieldsSchema.shape);

export const pushOutputSchema = pushReportSchema.extend(commandFieldsSchema.shape);

export const scanOutputSchema = scanReportSchema.extend(commandFieldsSchema.shape);

export const initOutputSchema = initReportSchema.extend(commandFieldsSchema.shape);
