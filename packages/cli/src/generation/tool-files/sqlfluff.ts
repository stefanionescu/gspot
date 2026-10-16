import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    SQL_FILE_EXTENSIONS,
    SQLFLUFF_CAPITALISATION,
    SQLFLUFF_RECOMMENDED_OFF,
} from '#cli/config/generation/tool-file-sources.ts';
/**
 * Build sqlfluff file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the SQL dialect, formatting choices, and SQLFluff rule exclusions.
 */
function buildSqlfluffFile(context: ToolFileContext): string {
    const { settings, format, rulesOff } = context.selection.view;
    const level = context.level;

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

    return (
        [
            ...Object.entries({
                sqlfluff: document.sqlfluff,
                'sqlfluff:indentation': document['sqlfluff:indentation'],
            }).map(
                ([name, section]) =>
                    `[${name}]\n${Object.entries(section)
                        .filter(([, value]) => !Array.isArray(value) || value.length > 0)
                        .map(([key, value]) => `${key} = ${Array.isArray(value) ? value.join(', ') : String(value)}`)
                        .join('\n')}\n`,
            ),
            ...Object.entries(document['sqlfluff:rules']).map(
                ([rule, options]) =>
                    `[sqlfluff:rules:${rule}]\n${Object.entries(options)
                        .map(([key, value]) => `${key} = ${value}`)
                        .join('\n')}\n`,
            ),
            '',
        ].join('\n') + '\n'
    );
}

export { buildSqlfluffFile };
