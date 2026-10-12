import { z } from 'zod';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { WrittenLimits } from '#cli/types/settings/file.ts';
import { DEFAULT_FIELDS, DEFAULT_VALUES } from '#cli/config/settings/defaults.ts';
import type { TableSettings, NamingLanguage } from '#cli/types/settings/tables.ts';
import { percentage, reasonValue, wholeNumber, settingField } from '#cli/settings/schema/parts.ts';

const limitFields = {
    file_lines: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.file_lines, DEFAULT_FIELDS.file_lines),
    function_lines: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.function_lines,
        DEFAULT_FIELDS.function_lines,
    ),
    function_parameters: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.function_parameters,
        DEFAULT_FIELDS.function_parameters,
    ),
    statements: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.statements, DEFAULT_FIELDS.statements),
    nesting: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.nesting, DEFAULT_FIELDS.nesting),
    callback_nesting: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.callback_nesting,
        DEFAULT_FIELDS.callback_nesting,
    ),
    cognitive_complexity: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.cognitive_complexity,
        DEFAULT_FIELDS.cognitive_complexity,
    ),
    cyclomatic_complexity: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.cyclomatic_complexity,
        DEFAULT_FIELDS.cyclomatic_complexity,
    ),
    branches: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.branches, DEFAULT_FIELDS.branches),
    returns: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.returns, DEFAULT_FIELDS.returns),
    assignments: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.assignments, DEFAULT_FIELDS.assignments),
    closure_lines: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.closure_lines, DEFAULT_FIELDS.closure_lines),
    type_lines: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.type_lines, DEFAULT_FIELDS.type_lines),
    index_exports: settingField(reasonValue(wholeNumber), DEFAULT_VALUES.index_exports, DEFAULT_FIELDS.index_exports),
    min_function_statements: settingField(
        reasonValue(z.number().int().positive()),
        DEFAULT_VALUES.min_function_statements,
        DEFAULT_FIELDS.min_function_statements,
    ),
    prefix_collisions: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.prefix_collisions,
        DEFAULT_FIELDS.prefix_collisions,
    ),
    file_kilobytes: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.file_kilobytes,
        DEFAULT_FIELDS.file_kilobytes,
    ),
    sentence_words: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.sentence_words,
        DEFAULT_FIELDS.sentence_words,
    ),
    list_item_words: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.list_item_words,
        DEFAULT_FIELDS.list_item_words,
    ),
    paragraph_sentences: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.paragraph_sentences,
        DEFAULT_FIELDS.paragraph_sentences,
    ),
    headings_before_contents: settingField(
        reasonValue(wholeNumber),
        DEFAULT_VALUES.headings_before_contents,
        DEFAULT_FIELDS.headings_before_contents,
    ),
    min_duplicate_lines: settingField(
        reasonValue(z.number().int().positive()),
        DEFAULT_VALUES.min_duplicate_lines,
        DEFAULT_FIELDS.min_duplicate_lines,
    ),
    min_duplicate_tokens: settingField(
        reasonValue(z.number().int().positive()),
        DEFAULT_VALUES.min_duplicate_tokens,
        DEFAULT_FIELDS.min_duplicate_tokens,
    ),
    duplicate_percent: settingField(
        reasonValue(percentage),
        DEFAULT_VALUES.duplicate_percent,
        DEFAULT_FIELDS.duplicate_percent,
    ),
} satisfies SchemaShape<Omit<TableSettings<'limits'>, NamingLanguage>, Omit<WrittenLimits, NamingLanguage>>;

export { limitFields };
