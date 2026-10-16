import { stringify } from 'yaml';
import type { Level } from '#cli/types/configurations.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';

import {
    SWIFTLINT_OPT_IN,
    SWIFTLINT_ANALYZER,
    SWIFTLINT_COMMENTS,
    SWIFTLINT_DISABLED,
    SWIFTLINT_RECOMMENDED_OFF,
    SWIFTLINT_FUNCTION_NESTING,
} from '#cli/config/generation/swift.ts';

function buildSeverityLimits(count: unknown) {
    return { warning: count, error: count };
}

/**
 * Write the swiftlint configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 * @param root0.format the resolved formatting settings.
 * @param root0.limit the configured numeric limit reader.
 * @param root0.rulesOff the disabled lint rule reader.
 * @param level the selected check level.
 *
 * @returns the generated configuration text.
 */
export function buildSwiftlintFile(
    { settings, format, limit, rulesOff }: Pick<ScopeView, 'settings' | 'format' | 'limit' | 'rulesOff'>,
    level: Level,
): string {
    const isAll = level === 'all';
    const off = [...rulesOff('swift/swiftlint'), ...(isAll ? [] : SWIFTLINT_RECOMMENDED_OFF)];
    const offSet = new Set(off);
    const options = {
        line_length: { ...buildSeverityLimits(format.print_width), ignores_urls: true },
        file_length: { ...buildSeverityLimits(limit('file_lines', 'swift')), ignore_comment_only_lines: true },
        type_body_length: buildSeverityLimits(settings['limits.swift.type_lines']),
        function_parameter_count: {
            ...buildSeverityLimits(limit('function_parameters', 'swift')),
            ignores_default_parameters: false,
        },
        function_body_length: buildSeverityLimits(limit('function_lines', 'swift')),
        cyclomatic_complexity: buildSeverityLimits(limit('cyclomatic_complexity', 'swift')),
        closure_body_length: buildSeverityLimits(settings['limits.swift.closure_lines']),
        identifier_name: { min_length: 1, max_length: settings['naming.swift.max_characters'] },
        type_name: { min_length: 1, max_length: settings['naming.swift.max_characters'] },
        nesting: {
            type_level: buildSeverityLimits(1),
            function_level: buildSeverityLimits(SWIFTLINT_FUNCTION_NESTING),
        },
        missing_docs: { error: ['open', 'public'] },
        unused_import: { always_keep_imports: settings['tools.swiftlint.always_keep_imports'] },
        trailing_comma: { mandatory_comma: format.trailing_commas !== 'none' },
    };
    const document = {
        ...Object.fromEntries(Object.entries(options).filter(([rule]) => !offSet.has(rule))),
        disabled_rules: [
            ...SWIFTLINT_DISABLED,
            ...off.filter((rule) => !SWIFTLINT_OPT_IN.has(rule) && !SWIFTLINT_ANALYZER.has(rule)),
        ],
        opt_in_rules: [...SWIFTLINT_OPT_IN].filter((rule) => !offSet.has(rule)),
        analyzer_rules: [...SWIFTLINT_ANALYZER].filter((rule) => !offSet.has(rule)),
    };

    return (
        Object.entries(document)
            .flatMap(([rule, value]) => [
                ...(rule === 'identifier_name' || rule === 'disabled_rules' ? [SWIFTLINT_COMMENTS[rule]] : []),
                stringify({ [rule]: value }).trimEnd(),
            ])
            .join('\n') + '\n'
    );
}
