import { z } from 'zod';
import { type SchemaShape } from '#cli/types/objects.ts';
import { type WrittenLimits } from '#cli/types/settings/file.ts';
import { DEFAULT_FIELDS, DEFAULT_VALUES } from '#cli/config/settings/defaults.ts';
import { type TableSettings, type NamingLanguage } from '#cli/types/settings/tables.ts';
import { percentage, wholeNumber, allowReasonedValue } from '#cli/settings/schema/parts.ts';

const limitFields = {
    file_lines: allowReasonedValue(wholeNumber).default(DEFAULT_VALUES.file_lines).meta(DEFAULT_FIELDS.file_lines),
    function_lines: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.function_lines)
        .meta(DEFAULT_FIELDS.function_lines),
    function_parameters: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.function_parameters)
        .meta(DEFAULT_FIELDS.function_parameters),
    statements: allowReasonedValue(wholeNumber).default(DEFAULT_VALUES.statements).meta(DEFAULT_FIELDS.statements),
    nesting: allowReasonedValue(wholeNumber).default(DEFAULT_VALUES.nesting).meta(DEFAULT_FIELDS.nesting),
    callback_nesting: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.callback_nesting)
        .meta(DEFAULT_FIELDS.callback_nesting),
    cognitive_complexity: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.cognitive_complexity)
        .meta(DEFAULT_FIELDS.cognitive_complexity),
    cyclomatic_complexity: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.cyclomatic_complexity)
        .meta(DEFAULT_FIELDS.cyclomatic_complexity),
    branches: allowReasonedValue(wholeNumber).default(DEFAULT_VALUES.branches).meta(DEFAULT_FIELDS.branches),
    returns: allowReasonedValue(wholeNumber).default(DEFAULT_VALUES.returns).meta(DEFAULT_FIELDS.returns),
    assignments: allowReasonedValue(wholeNumber).default(DEFAULT_VALUES.assignments).meta(DEFAULT_FIELDS.assignments),
    closure_lines: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.closure_lines)
        .meta(DEFAULT_FIELDS.closure_lines),
    type_lines: allowReasonedValue(wholeNumber).default(DEFAULT_VALUES.type_lines).meta(DEFAULT_FIELDS.type_lines),
    index_exports: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.index_exports)
        .meta(DEFAULT_FIELDS.index_exports),
    min_function_statements: allowReasonedValue(z.number().int().positive())
        .default(DEFAULT_VALUES.min_function_statements)
        .meta(DEFAULT_FIELDS.min_function_statements),
    prefix_collisions: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.prefix_collisions)
        .meta(DEFAULT_FIELDS.prefix_collisions),
    file_kilobytes: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.file_kilobytes)
        .meta(DEFAULT_FIELDS.file_kilobytes),
    sentence_words: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.sentence_words)
        .meta(DEFAULT_FIELDS.sentence_words),
    list_item_words: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.list_item_words)
        .meta(DEFAULT_FIELDS.list_item_words),
    paragraph_sentences: allowReasonedValue(wholeNumber)
        .default(DEFAULT_VALUES.paragraph_sentences)
        .meta(DEFAULT_FIELDS.paragraph_sentences),
    min_duplicate_lines: allowReasonedValue(z.number().int().positive())
        .default(DEFAULT_VALUES.min_duplicate_lines)
        .meta(DEFAULT_FIELDS.min_duplicate_lines),
    min_duplicate_tokens: allowReasonedValue(z.number().int().positive())
        .default(DEFAULT_VALUES.min_duplicate_tokens)
        .meta(DEFAULT_FIELDS.min_duplicate_tokens),
    duplicate_percent: allowReasonedValue(percentage)
        .default(DEFAULT_VALUES.duplicate_percent)
        .meta(DEFAULT_FIELDS.duplicate_percent),
} satisfies SchemaShape<Omit<TableSettings<'limits'>, NamingLanguage>, Omit<WrittenLimits, NamingLanguage>>;

const languageLimitsSchema = z.strictObject(limitFields);

const limitsSchema = z.strictObject({
    ...limitFields,
    typescript: languageLimitsSchema.optional(),
    javascript: languageLimitsSchema.optional(),
    python: languageLimitsSchema.optional(),
    bash: languageLimitsSchema.optional(),
    swift: languageLimitsSchema.optional(),
    sql: languageLimitsSchema.optional(),
    css: languageLimitsSchema.optional(),
    html: languageLimitsSchema.optional(),
} satisfies SchemaShape<TableSettings<'limits'>, WrittenLimits>);

export { limitsSchema };
