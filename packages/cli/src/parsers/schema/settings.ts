import { z } from 'zod';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import type { SettingField, SettingItems, SettingFields } from '#cli/types/parsers/settings.ts';

/** The public policy and check levels. Preview rules have no supported level. */
export const levelSchema = z.enum(['recommended', 'all']);

/** Operating systems supported by declared checks and generated CI. */
export const operatingSystemSchema = z.enum(OPERATING_SYSTEMS.map((system) => system.name));

/** Package and task runners supported by the public runner setting. */
export const runnerSchema = z.enum(['mise', 'npm', 'bun', 'pnpm', 'yarn']);

/** Constraints declared by a setting's owning configuration. */
export const settingValidationSchema = z.strictObject({
    enum: z
        .array(z.union([z.string(), z.number(), z.boolean()]))
        .min(1)
        .optional(),
    pattern: z
        .string()
        .superRefine((pattern, context) => {
            try {
                new RegExp(pattern, 'u');
            } catch {
                context.addIssue({ code: 'custom', message: 'Use a valid Unicode regular expression.' });
            }
        })
        .optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    integer: z.boolean().optional(),
    message: z.string().min(1).optional(),
});

/** Primitive field names in authored setting item declarations. */
export const settingPrimitiveSchema = z.enum(['string', 'path', 'number', 'boolean']);

/** Types a configuration may declare for one authored setting. */
export const settingTypeSchema = z.enum(['number', 'string', 'path', 'boolean', 'list', 'table']);

/** Optionality and constraints belong to the declared field, not its readers. */
export const settingFieldOptionsSchema = z.strictObject({
    optional: z.boolean().optional(),
    validation: settingValidationSchema.optional(),
});

/** Typed record fields may contain other declared records and lists. */
export const settingFieldSchema: z.ZodType<SettingField> = z.lazy(() =>
    z.discriminatedUnion('type', [
        settingFieldOptionsSchema.extend({ type: settingPrimitiveSchema }),
        settingFieldOptionsSchema.extend({ type: z.literal('list'), items: settingItemsSchema }),
        settingFieldOptionsSchema.extend({ type: z.literal('table'), fields: settingFieldsSchema }),
    ]),
);

/** Every record field has a type; undeclared field values are refused. */
export const settingFieldsSchema: z.ZodType<SettingFields> = z.record(
    z.string().min(1),
    z.union([settingPrimitiveSchema, settingFieldSchema]),
);

/** A retained list declares strings, scope paths, or a typed record. */
export const settingItemsSchema: z.ZodType<SettingItems> = z.union([z.enum(['string', 'path']), settingFieldsSchema]);

/** Compiler metadata shared by manifest declarations and runtime value validation. */
export const settingValueDeclarationSchema = z.strictObject({
    type: settingTypeSchema,
    validation: settingValidationSchema.prefault({}),
    items: settingItemsSchema.optional(),
    default: z.unknown().optional(),
    default_all: z.unknown().optional(),
});
