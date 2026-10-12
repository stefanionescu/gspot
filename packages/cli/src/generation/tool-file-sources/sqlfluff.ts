import type { Level } from '#cli/types/configurations.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import type { ToolFileSource } from '#cli/types/generation/files.ts';

import {
    SQL_FILE_EXTENSIONS,
    SQLFLUFF_CAPITALISATION,
    SQLFLUFF_RECOMMENDED_OFF,
} from '#cli/config/generation/tool-file-sources.ts';
/**
 * Write the sqlfluff configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 * @param root0.format the resolved formatting settings.
 * @param root0.rulesOff the disabled lint rule reader.
 * @param level the selected check level.
 *
 * @returns the generated configuration text.
 */
export function sqlfluffToolFile(
    { settings, format, rulesOff }: Pick<ScopeView, 'settings' | 'format' | 'rulesOff'>,
    level: Level,
): ToolFileSource {
    const isAll = level === 'all';

    const off = [...rulesOff('sql/sqlfluff'), ...(isAll ? [] : SQLFLUFF_RECOMMENDED_OFF)];
    const document = {
        sqlfluff: {
            dialect: settings['tools.sqlfluff.dialect'],
            templater: 'raw',
            sql_file_exts: SQL_FILE_EXTENSIONS,
            max_line_length: format.print_width,
            large_file_skip_byte_limit: 0,
            exclude_rules: off,
        },
        'sqlfluff:indentation': {
            indent_unit: format.indent_style === 'tab' ? 'tab' : 'space',
            tab_space_size: format.indent_width,
        },
        'sqlfluff:rules': SQLFLUFF_CAPITALISATION,
    };

    return {
        content:
            [
                ...Object.entries({
                    sqlfluff: document.sqlfluff,
                    'sqlfluff:indentation': document['sqlfluff:indentation'],
                }).map(
                    ([name, section]) =>
                        `[${name}]\n${Object.entries(section)
                            .filter(([, value]) => !Array.isArray(value) || value.length > 0)
                            .map(
                                ([key, value]) => `${key} = ${Array.isArray(value) ? value.join(', ') : String(value)}`,
                            )
                            .join('\n')}\n`,
                ),
                ...Object.entries(document['sqlfluff:rules']).map(
                    ([rule, options]) =>
                        `[sqlfluff:rules:${rule}]\n${Object.entries(options)
                            .map(([key, value]) => `${key} = ${value}`)
                            .join('\n')}\n`,
                ),
                '',
            ].join('\n') + '\n',
        document: document,
    };
}
