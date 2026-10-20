import { stringify } from 'yaml';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

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
 * Build the SwiftLint file from the settings.
 *
 * @param context the tool file to build.
 * @returns the SwiftLint rules with the source limits of the repository.
 */
function buildSwiftlintFile(context: ToolFileContext): string {
    const { settings, format, limit, rulesOff } = context.selection.view;
    const level = context.level;

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

export { buildSwiftlintFile };
