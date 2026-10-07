import { z } from 'zod';
import type { SettingDeclaration } from '#cli/types/configurations.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';

/** The public policy and check levels. Preview rules have no supported level. */
export const levelSchema = z.enum(['recommended', 'all']);

/** Operating systems supported by declared checks and generated CI. */
export const operatingSystemSchema = z.enum(OPERATING_SYSTEMS.map((system) => system.name));

/** Package and task runners supported by the public run_with setting. */
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

/** Primitive manifest setting shapes, before optional reason wrappers. */
export const settingValueSchemas = {
    number: z.number(),
    string: z.string(),
    boolean: z.boolean(),
    list: z.array(z.unknown()),
    table: z.record(z.string(), z.unknown()),
};

/**
 * Builds value validation from the constraints a configuration declares.
 * @param declaration the setting's type and validated constraints
 * @returns the schema for a bare effective setting value
 */
export function settingValueSchema(declaration: Pick<SettingDeclaration, 'type' | 'validation'>): z.ZodType {
    const validation = declaration.validation;
    const diagnostic = validation.message;
    if (validation.enum !== undefined) return z.literal(validation.enum, { error: diagnostic });
    switch (declaration.type) {
        case 'string': {
            return validation.pattern === undefined
                ? z.string()
                : z.string().regex(new RegExp(validation.pattern, 'u'), diagnostic);
        }
        case 'number': {
            return numberSettingSchema(validation);
        }
        default: {
            return settingValueSchemas[declaration.type];
        }
    }
}

/**
 * Applies numeric constraints shared by declared settings and policy format fields.
 * @param validation the bounds, integer requirement, and optional diagnostic
 * @returns the validated number schema
 */
export function numberSettingSchema(validation: SettingDeclaration['validation']): z.ZodNumber {
    let schema = z.number();
    if (validation.integer === true) schema = schema.int(validation.message);
    if (validation.minimum !== undefined) schema = schema.min(validation.minimum, validation.message);
    if (validation.maximum !== undefined) schema = schema.max(validation.maximum, validation.message);
    return schema;
}
