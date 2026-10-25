import { stringify } from 'yaml';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { getTable, getLimit, listIgnoredRules } from '#cli/settings/scopes.ts';

import {
    SWIFTLINT_OPT_IN,
    SWIFTLINT_ANALYZER,
    SWIFTLINT_COMMENTS,
    SWIFTLINT_ALWAYS_OFF,
    SWIFTLINT_RECOMMENDED_OFF,
    SWIFTLINT_FUNCTION_NESTING,
} from '#cli/config/generation/configurations/language/swift/swiftlint.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 9 calls in this file share it.
function buildSeverityLimits(count: number) {
    return { warning: count, error: count };
}

/**
Build swiftlint.yml: the SwiftLint rules with the source limits of the repository.

@param planned the config file with its scope, level, and target path.
@returns the SwiftLint rules with the source limits of the repository.
*/
export function buildSwiftlintFile(planned: PlannedConfigFile): string {
    const { format } = planned.scope.settings.tables;
    const isAll = planned.level === 'all';
    const off = [...listIgnoredRules(planned.scope, 'swift/swiftlint'), ...(isAll ? [] : SWIFTLINT_RECOMMENDED_OFF)];
    const offSet = new Set(off);
    const options = {
        line_length: { ...buildSeverityLimits(format.print_width), ignores_urls: true },
        file_length: {
            ...buildSeverityLimits(getLimit(planned.scope.settings, 'file_lines', 'swift')),
            ignore_comment_only_lines: true,
        },
        type_body_length: buildSeverityLimits(getLimit(planned.scope.settings, 'type_lines', 'swift')),
        function_parameter_count: {
            ...buildSeverityLimits(getLimit(planned.scope.settings, 'function_parameters', 'swift')),
            ignores_default_parameters: false,
        },
        function_body_length: buildSeverityLimits(getLimit(planned.scope.settings, 'function_lines', 'swift')),
        cyclomatic_complexity: buildSeverityLimits(getLimit(planned.scope.settings, 'cyclomatic_complexity', 'swift')),
        closure_body_length: buildSeverityLimits(getLimit(planned.scope.settings, 'closure_lines', 'swift')),
        identifier_name: {
            min_length: 1,
            max_length: getTable(planned.scope.settings, 'naming').swift?.max_characters,
        },
        type_name: { min_length: 1, max_length: getTable(planned.scope.settings, 'naming').swift?.max_characters },
        nesting: {
            type_level: buildSeverityLimits(1),
            function_level: buildSeverityLimits(SWIFTLINT_FUNCTION_NESTING),
        },
        missing_docs: { error: ['open', 'public'] },
        unused_import: { always_keep_imports: getTable(planned.scope.settings, 'tools.swiftlint').always_keep_imports },
        trailing_comma: { mandatory_comma: format.trailing_commas !== 'none' },
    };
    const document = {
        ...Object.fromEntries(Object.entries(options).filter(([rule]) => !offSet.has(rule))),
        disabled_rules: [
            ...SWIFTLINT_ALWAYS_OFF,
            ...off.filter((rule) => !SWIFTLINT_OPT_IN.has(rule) && !SWIFTLINT_ANALYZER.has(rule)),
        ],
        opt_in_rules: [...SWIFTLINT_OPT_IN.difference(offSet)],
        analyzer_rules: [...SWIFTLINT_ANALYZER.difference(offSet)],
    };

    return Object.entries(document)
        .flatMap(([rule, value]) => [
            ...(rule === 'identifier_name' || rule === 'disabled_rules' ? [SWIFTLINT_COMMENTS[rule]] : []),
            stringify({ [rule]: value }).trimEnd(),
        ])
        .join('\n');
}
