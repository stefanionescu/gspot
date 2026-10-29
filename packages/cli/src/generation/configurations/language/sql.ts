import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    SQLFLUFF_CHECK,
    SQL_FILE_EXTENSIONS,
    SQLFLUFF_CAPITALISATION,
    SQLFLUFF_DEFAULT_LEVEL_OFF,
} from '#cli/config/generation/configurations/language/sql.ts';

/**
Build sqlfluff.cfg: the SQL dialect, formatting choices, and SQLFluff rule exclusions.

@param planned the config file to build.
*/
export function buildSqlfluffFile(planned: PlannedConfigFile): string {
    const { format } = planned.scope.settings.tables;
    const isAll = planned.level === 'all';

    const off = [...listIgnoredRules(planned.scope, SQLFLUFF_CHECK), ...(isAll ? [] : SQLFLUFF_DEFAULT_LEVEL_OFF)];
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
