import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { getTable, getLimit, selectFormat, listIgnoredRules } from '#cli/settings/scopes.ts';
import { Document, type Node, type Scalar, type YAMLMap, type YAMLSeq } from 'yaml';

import {
    SWIFT_FILES,
    SWIFTLINT_CHECK,
    SWIFTLINT_OPT_IN,
    SWIFTLINT_ANALYZER,
    SWIFTLINT_COMMENTS,
    SWIFTLINT_LEVEL_NOTE,
    SWIFTLINT_ALWAYS_OFF,
    SWIFTLINT_FUNCTION_NESTING,
    SWIFTLINT_DEFAULT_LEVEL_OFF,
} from '#cli/config/configurations/swift.ts';

function buildSwiftlintOptions(planned: PlannedConfig, offSet: Set<string>) {
    const format = selectFormat(planned.scope.settings, SWIFT_FILES);
    const options = {
        line_length: { warning: format.print_width, error: format.print_width, ignores_urls: true },
        file_length: {
            warning: getLimit(planned.scope.settings, 'max_file_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'max_file_lines', 'swift'),
            ignore_comment_only_lines: true,
        },
        type_body_length: {
            warning: getLimit(planned.scope.settings, 'max_type_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'max_type_lines', 'swift'),
        },
        function_parameter_count: {
            warning: getLimit(planned.scope.settings, 'max_function_parameters', 'swift'),
            error: getLimit(planned.scope.settings, 'max_function_parameters', 'swift'),
            ignores_default_parameters: false,
        },
        function_body_length: {
            warning: getLimit(planned.scope.settings, 'max_function_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'max_function_lines', 'swift'),
        },
        max_cyclomatic_complexity: {
            warning: getLimit(planned.scope.settings, 'max_cyclomatic_complexity', 'swift'),
            error: getLimit(planned.scope.settings, 'max_cyclomatic_complexity', 'swift'),
        },
        closure_body_length: {
            warning: getLimit(planned.scope.settings, 'max_closure_lines', 'swift'),
            error: getLimit(planned.scope.settings, 'max_closure_lines', 'swift'),
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
        unused_import: { always_keep_imports: getTable(planned.scope.settings, 'swift').allowed_unused_imports },
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
    const levelOff = off.filter((rule) => !SWIFTLINT_OPT_IN.has(rule) && !SWIFTLINT_ANALYZER.has(rule));
    const document = new Document({
        ...buildSwiftlintOptions(planned, offSet),
        disabled_rules: [...SWIFTLINT_ALWAYS_OFF, ...levelOff],
        opt_in_rules: [...SWIFTLINT_OPT_IN.difference(offSet)],
        analyzer_rules: [...SWIFTLINT_ANALYZER.difference(offSet)],
    });
    for (const { key } of (document.contents as YAMLMap<Scalar<string>, Node>).items) {
        const comment = SWIFTLINT_COMMENTS[key.value as keyof typeof SWIFTLINT_COMMENTS] as string | undefined;
        if (comment !== undefined) key.commentBefore = comment;
    }
    const firstLevelOff = (document.get('disabled_rules') as YAMLSeq<Node>).items[SWIFTLINT_ALWAYS_OFF.length];
    if (firstLevelOff !== undefined) firstLevelOff.commentBefore = SWIFTLINT_LEVEL_NOTE;
    return document.toString({ lineWidth: 0 }).trimEnd();
}
