import { SQL_FILES, SQLFLUFF_CAPITALISATION } from '#cli/config/configurations/language.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import { getTable, selectFormat } from '#cli/settings/scopes.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildSqlfluffFile(planned: PlannedConfig): string {
    const format = selectFormat(planned.scope.settings, SQL_FILES);
    const off = listDisabledRules(planned);
    const sections = {
        sqlfluff: {
            dialect: getTable(planned.scope.settings, 'sql').dialect,
            templater: 'raw',
            sql_file_exts: planned.configuration.files.extensions.join(','),
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

export const SQL_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'sql/sqlfluff.cfg': buildSqlfluffFile,
};
