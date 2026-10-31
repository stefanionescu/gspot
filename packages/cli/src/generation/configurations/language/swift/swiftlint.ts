import { stringify } from 'yaml';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { getTable, getLimit, listIgnoredRules } from '#cli/settings/scopes.ts';

import {
    SWIFTLINT_CHECK,
    SWIFTLINT_OPT_IN,
    SWIFTLINT_ANALYZER,
    SWIFTLINT_COMMENTS,
    SWIFTLINT_LEVEL_NOTE,
    SWIFTLINT_ALWAYS_OFF,
    SWIFTLINT_FUNCTION_NESTING,
    SWIFTLINT_DEFAULT_LEVEL_OFF,
} from '#cli/config/generation/configurations/language/swift.ts';

function buildSwiftlintOptions(planned: PlannedConfig, offSet: Set<string>) {
    const { format } = planned.scope.settings.tables;
    const options = {
        line_length: { warning: format.print_width, error: format.print_width, ignores_urls: true },
        file_length: {
            warning: getLimit(planned.scope.settings, 'file_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'file_lines', 'swift'),
            ignore_comment_only_lines: true,
        },
        type_body_length: {
            warning: getLimit(planned.scope.settings, 'type_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'type_lines', 'swift'),
        },
        function_parameter_count: {
            warning: getLimit(planned.scope.settings, 'function_parameters', 'swift'),
            error: getLimit(planned.scope.settings, 'function_parameters', 'swift'),
            ignores_default_parameters: false,
        },
        function_body_length: {
            warning: getLimit(planned.scope.settings, 'function_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'function_lines', 'swift'),
        },
        cyclomatic_complexity: {
            warning: getLimit(planned.scope.settings, 'cyclomatic_complexity', 'swift'),
            error: getLimit(planned.scope.settings, 'cyclomatic_complexity', 'swift'),
        },
        closure_body_length: {
            warning: getLimit(planned.scope.settings, 'closure_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'closure_lines', 'swift'),
        },
        identifier_name: {
            min_length: 1,
            max_length: getTable(planned.scope.settings, 'naming').swift?.max_characters,
        },
        type_name: { min_length: 1, max_length: getTable(planned.scope.settings, 'naming').swift?.max_characters },
        nesting: {
            type_level: { warning: 1, error: 1 },
            function_level: { warning: SWIFTLINT_FUNCTION_NESTING, error: SWIFTLINT_FUNCTION_NESTING },
        },
        missing_docs: { error: ['open', 'public'] },
        unused_import: { always_keep_imports: getTable(planned.scope.settings, 'tools.swiftlint').always_keep_imports },
    };
    const enabled = Object.entries(options).filter(([rule]) => !offSet.has(rule));
    return Object.fromEntries(enabled);
}

/**
Build swiftlint.yml: the SwiftLint rules with the source limits of the repository.

@param planned the config file to build.
*/
export function buildSwiftlintFile(planned: PlannedConfig): string {
    const isAll = planned.level === 'all';
    const off = [...listIgnoredRules(planned.scope, SWIFTLINT_CHECK), ...(isAll ? [] : SWIFTLINT_DEFAULT_LEVEL_OFF)];
    const offSet = new Set(off);
    const options = buildSwiftlintOptions(planned, offSet);
    const document = {
        ...options,
        disabled_rules: [
            ...SWIFTLINT_ALWAYS_OFF,
            ...off.filter((rule) => !SWIFTLINT_OPT_IN.has(rule) && !SWIFTLINT_ANALYZER.has(rule)),
        ],
        opt_in_rules: [...SWIFTLINT_OPT_IN.difference(offSet)],
        analyzer_rules: [...SWIFTLINT_ANALYZER.difference(offSet)],
    };

    const disabled = buildDisabledRuleLines(off);
    return Object.entries(document)
        .flatMap(([rule, value]) => {
            if (rule === 'disabled_rules') return disabled;
            const note = rule === 'identifier_name' ? [SWIFTLINT_COMMENTS.identifier_name] : [];
            return [...note, stringify({ [rule]: value }).trimEnd()];
        })
        .join('\n');
}

function buildDisabledRuleLines(off: string[]): string[] {
    const disabled = off.filter((name) => !SWIFTLINT_OPT_IN.has(name) && !SWIFTLINT_ANALYZER.has(name));
    const levelLines = disabled.map((name) => `  - ${name}`);
    return [
        'disabled_rules:',
        `  ${SWIFTLINT_COMMENTS.disabled_rules}`,
        ...SWIFTLINT_ALWAYS_OFF.map((name) => `  - ${name}`),
        ...(disabled.length === 0 ? [] : [`  ${SWIFTLINT_LEVEL_NOTE}`, ...levelLines]),
    ];
}
