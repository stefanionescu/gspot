import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { LimitSchemas } from '#cli/types/settings/limits.ts';
import { allowReasonedValue } from '#cli/schemas/settings/fields.ts';
import { LIMIT_DEFINITIONS } from '#cli/config/settings/definitions/limits.ts';
import type { WrittenLimits, TableSettings } from '#cli/types/settings/file.ts';
import type { LimitFields, LanguageLimitField } from '#cli/types/settings/values.ts';

const limitFields = Object.fromEntries(
    Object.entries(LIMIT_DEFINITIONS).map(([key, definition]) => [
        key.slice('limits.'.length),
        allowReasonedValue(
            z
                .number()
                .int()
                .min('minimum' in definition ? definition.minimum : 0),
            definition,
        ),
    ]),
) as LimitSchemas;

const languageLimitFieldsSchema = z.strictObject(limitFields).partial() satisfies z.ZodType<LimitFields<number>>;

export const limitsSchema = z.strictObject({
    ...limitFields,
    typescript: languageLimitFieldsSchema
        .pick(
            Object.fromEntries(
                Object.entries(LIMIT_DEFINITIONS).flatMap(([key, declaration]) =>
                    'languages' in declaration && (declaration.languages as readonly string[]).includes('typescript')
                        ? [[key.slice(key.indexOf('.') + 1), true]]
                        : [],
                ),
            ) as Record<LanguageLimitField<'typescript'>, true>,
        )
        .optional(),
    javascript: languageLimitFieldsSchema
        .pick(
            Object.fromEntries(
                Object.entries(LIMIT_DEFINITIONS).flatMap(([key, declaration]) =>
                    'languages' in declaration && (declaration.languages as readonly string[]).includes('javascript')
                        ? [[key.slice(key.indexOf('.') + 1), true]]
                        : [],
                ),
            ) as Record<LanguageLimitField<'javascript'>, true>,
        )
        .optional(),
    python: languageLimitFieldsSchema
        .pick(
            Object.fromEntries(
                Object.entries(LIMIT_DEFINITIONS).flatMap(([key, declaration]) =>
                    'languages' in declaration && (declaration.languages as readonly string[]).includes('python')
                        ? [[key.slice(key.indexOf('.') + 1), true]]
                        : [],
                ),
            ) as Record<LanguageLimitField<'python'>, true>,
        )
        .optional(),
    bash: languageLimitFieldsSchema
        .pick(
            Object.fromEntries(
                Object.entries(LIMIT_DEFINITIONS).flatMap(([key, declaration]) =>
                    'languages' in declaration && (declaration.languages as readonly string[]).includes('bash')
                        ? [[key.slice(key.indexOf('.') + 1), true]]
                        : [],
                ),
            ) as Record<LanguageLimitField<'bash'>, true>,
        )
        .optional(),
    swift: languageLimitFieldsSchema
        .pick(
            Object.fromEntries(
                Object.entries(LIMIT_DEFINITIONS).flatMap(([key, declaration]) =>
                    'languages' in declaration && (declaration.languages as readonly string[]).includes('swift')
                        ? [[key.slice(key.indexOf('.') + 1), true]]
                        : [],
                ),
            ) as Record<LanguageLimitField<'swift'>, true>,
        )
        .optional(),
    sql: languageLimitFieldsSchema
        .pick(
            Object.fromEntries(
                Object.entries(LIMIT_DEFINITIONS).flatMap(([key, declaration]) =>
                    'languages' in declaration && (declaration.languages as readonly string[]).includes('sql')
                        ? [[key.slice(key.indexOf('.') + 1), true]]
                        : [],
                ),
            ) as Record<LanguageLimitField<'sql'>, true>,
        )
        .optional(),
} satisfies SchemaShape<TableSettings<'limits'>, WrittenLimits>);

limitsSchema.register(z.globalRegistry, { id: 'limits' });
