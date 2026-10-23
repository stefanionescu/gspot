import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import type { LimitSchemas } from '#cli/types/settings/definitions.ts';
import { LIMIT_DEFINITIONS } from '#cli/config/settings/definitions/limits.ts';
import { wholeNumber, allowReasonedValue } from '#cli/schemas/settings/fields.ts';
import { type WrittenLimits, type TableSettings } from '#cli/types/settings/file.ts';
import { type LimitLanguage, type LanguageLimitField } from '#cli/types/settings/values.ts';

const limitFields = Object.fromEntries(
    Object.entries(LIMIT_DEFINITIONS).map(([key, definition]) => [
        key.slice('limits.'.length),
        allowReasonedValue(
            key === 'limits.trivial_function_statements' ? z.number().int().positive() : wholeNumber,
            definition,
        ),
    ]),
) as LimitSchemas;

// A language table holds only the limits that some code reads for that language, and inherits unset ones from the root.
const languageLimitFields = z.strictObject(limitFields).partial();

// The limit fields that some code reads for one language, as a mask for pick.
function buildLanguageMask<Language extends LimitLanguage>(
    language: Language,
): Record<LanguageLimitField<Language>, true> {
    return Object.fromEntries(
        Object.entries(LIMIT_DEFINITIONS).flatMap(([key, declaration]) =>
            'languages' in declaration && (declaration.languages as readonly string[]).includes(language)
                ? [[key.slice(key.indexOf('.') + 1), true]]
                : [],
        ),
    ) as Record<LanguageLimitField<Language>, true>;
}

export const limitsSchema = z.strictObject({
    ...limitFields,
    typescript: languageLimitFields.pick(buildLanguageMask('typescript')).optional(),
    javascript: languageLimitFields.pick(buildLanguageMask('javascript')).optional(),
    python: languageLimitFields.pick(buildLanguageMask('python')).optional(),
    bash: languageLimitFields.pick(buildLanguageMask('bash')).optional(),
    swift: languageLimitFields.pick(buildLanguageMask('swift')).optional(),
    sql: languageLimitFields.pick(buildLanguageMask('sql')).optional(),
} satisfies SchemaShape<TableSettings<'limits'>, WrittenLimits>);

limitsSchema.register(z.globalRegistry, { id: 'limits' });
