import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { type WrittenLimits } from '#cli/types/settings/file.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { wholeNumber, allowReasonedValue } from '#cli/settings/schema/parts.ts';
import { LIMITS_DECLARATIONS } from '#cli/config/settings/limits-declarations.ts';

import {
    type TableSettings,
    type LimitLanguage,
    type SettingLanguage,
    type LanguageLimitField,
} from '#cli/types/settings/tables.ts';

const limitFields = {
    file_lines: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.file_lines)
        .meta(SETTING_DECLARATIONS['limits.file_lines']),
    function_lines: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.function_lines)
        .meta(SETTING_DECLARATIONS['limits.function_lines']),
    function_parameters: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.function_parameters)
        .meta(SETTING_DECLARATIONS['limits.function_parameters']),
    function_statements: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.function_statements)
        .meta(SETTING_DECLARATIONS['limits.function_statements']),
    block_nesting: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.block_nesting)
        .meta(SETTING_DECLARATIONS['limits.block_nesting']),
    callback_nesting: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.callback_nesting)
        .meta(SETTING_DECLARATIONS['limits.callback_nesting']),
    cognitive_complexity: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.cognitive_complexity)
        .meta(SETTING_DECLARATIONS['limits.cognitive_complexity']),
    cyclomatic_complexity: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.cyclomatic_complexity)
        .meta(SETTING_DECLARATIONS['limits.cyclomatic_complexity']),
    function_branches: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.function_branches)
        .meta(SETTING_DECLARATIONS['limits.function_branches']),
    function_returns: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.function_returns)
        .meta(SETTING_DECLARATIONS['limits.function_returns']),
    function_assignments: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.function_assignments)
        .meta(SETTING_DECLARATIONS['limits.function_assignments']),
    closure_lines: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.closure_lines)
        .meta(SETTING_DECLARATIONS['limits.closure_lines']),
    type_lines: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.type_lines)
        .meta(SETTING_DECLARATIONS['limits.type_lines']),
    index_exports: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.index_exports)
        .meta(SETTING_DECLARATIONS['limits.index_exports']),
    trivial_function_statements: allowReasonedValue(z.number().int().positive())
        .default(SETTING_DEFAULTS.trivial_function_statements)
        .meta(SETTING_DECLARATIONS['limits.trivial_function_statements']),
    shared_prefix_files: allowReasonedValue(wholeNumber)
        .default(SETTING_DEFAULTS.shared_prefix_files)
        .meta(SETTING_DECLARATIONS['limits.shared_prefix_files']),
} satisfies SchemaShape<Omit<TableSettings<'limits'>, SettingLanguage>, Omit<WrittenLimits, SettingLanguage>>;

// A language table holds only the limits that some code reads for that language, and inherits unset ones from the root.
const languageLimitFields = z.strictObject(limitFields).partial();

// The limit fields that some code reads for one language, as a mask for pick.
function buildLanguageMask<Language extends LimitLanguage>(
    language: Language,
): Record<LanguageLimitField<Language>, true> {
    return Object.fromEntries(
        Object.entries(LIMITS_DECLARATIONS).flatMap(([key, declaration]) =>
            'languages' in declaration && (declaration.languages as readonly string[]).includes(language)
                ? [[key.slice(key.indexOf('.') + 1), true]]
                : [],
        ),
    ) as Record<LanguageLimitField<Language>, true>;
}

const limitsSchema = z.strictObject({
    ...limitFields,
    typescript: languageLimitFields.pick(buildLanguageMask('typescript')).optional(),
    javascript: languageLimitFields.pick(buildLanguageMask('javascript')).optional(),
    python: languageLimitFields.pick(buildLanguageMask('python')).optional(),
    bash: languageLimitFields.pick(buildLanguageMask('bash')).optional(),
    swift: languageLimitFields.pick(buildLanguageMask('swift')).optional(),
    sql: languageLimitFields.pick(buildLanguageMask('sql')).optional(),
} satisfies SchemaShape<TableSettings<'limits'>, WrittenLimits>);

limitsSchema.register(z.globalRegistry, { id: 'limits' });

export { limitsSchema };
