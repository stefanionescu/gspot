import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-settings.ts';

import {
    SQL_FILE_EXTENSIONS,
    SQLFLUFF_CAPITALISATION,
    SQLFLUFF_RECOMMENDED_OFF,
} from '#cli/config/generation/config-files/builders/sqlfluff.ts';

/**
 * Build sqlfluff.cfg: the SQL dialect, formatting choices, and SQLFluff rule exclusions.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the SQL dialect, formatting choices, and SQLFluff rule exclusions.
 */
export function buildSqlfluffFile(planned: PlannedConfigFile): string {
    const { format } = planned.scope.settings.values;
    const level = planned.level;

    const isAll = level === 'all';

    const off = [...listIgnoredRules(planned.scope, 'sql/sqlfluff'), ...(isAll ? [] : SQLFLUFF_RECOMMENDED_OFF)];
    const sections = {
        sqlfluff: {
            dialect: getTable(planned.scope.settings, 'tools.sqlfluff').dialect,
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
