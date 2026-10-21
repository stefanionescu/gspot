import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';

import {
    SQL_FILE_EXTENSIONS,
    SQLFLUFF_CAPITALISATION,
    SQLFLUFF_RECOMMENDED_OFF,
} from '#cli/config/generation/settings/builders/sqlfluff.ts';

/**
 * Build the SQLFluff file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the SQL dialect, formatting choices, and SQLFluff rule exclusions.
 */
export function buildSqlfluffFile(planned: PlannedToolFile): string {
    const { format } = planned.selection.view.values;
    const level = planned.level;

    const isAll = level === 'all';

    const off = [...listIgnoredRules(planned.selection, 'sql/sqlfluff'), ...(isAll ? [] : SQLFLUFF_RECOMMENDED_OFF)];
    const sections = {
        sqlfluff: {
            dialect: getTable(planned.selection.view, 'tools.sqlfluff').dialect,
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
    };

    return [
        ...Object.entries(sections).map(
            ([name, section]) =>
                `[${name}]\n${Object.entries(section)
                    .filter(([, value]) => !Array.isArray(value) || value.length > 0)
                    .map(([key, value]) => `${key} = ${Array.isArray(value) ? value.join(', ') : String(value)}`)
                    .join('\n')}\n`,
        ),
        ...Object.entries(SQLFLUFF_CAPITALISATION).map(
            ([rule, options]) =>
                `[sqlfluff:rules:${rule}]\n${Object.entries(options)
                    .map(([key, value]) => `${key} = ${value}`)
                    .join('\n')}\n`,
        ),
    ].join('\n');
}
