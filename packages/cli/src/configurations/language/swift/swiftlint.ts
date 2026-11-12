import { Document, type Node, type Scalar, type YAMLMap, type YAMLSeq } from 'yaml';

import {
    SWIFT_FILES,
    SWIFTLINT_ANALYZER,
    SWIFTLINT_COMMENTS,
    SWIFTLINT_FUNCTION_NESTING,
    SWIFTLINT_LEVEL_NOTE,
    SWIFTLINT_OPT_IN,
} from '#cli/config/configurations/swift.ts';
import { listDisabledRules, readToolDisabledRules } from '#cli/configurations/rule-options.ts';
import { getLimit, getTable, selectFormat } from '#cli/settings/scopes.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

function buildSeverityLimit(planned: PlannedConfig, name: string): { warning: number; error: number } {
    const limit = getLimit(planned.scope.settings, name, 'swift');
    return { warning: limit, error: limit };
}

function buildSwiftlintOptions(planned: PlannedConfig, offSet: Set<string>) {
    const format = selectFormat(planned.scope.settings, SWIFT_FILES);
    const options = {
        line_length: { warning: format.print_width, error: format.print_width, ignores_urls: true },
        file_length: { ...buildSeverityLimit(planned, 'max_file_lines'), ignore_comment_only_lines: true },
        type_body_length: buildSeverityLimit(planned, 'max_type_lines'),
        function_parameter_count: {
            ...buildSeverityLimit(planned, 'max_function_parameters'),
            ignores_default_parameters: false,
        },
        function_body_length: buildSeverityLimit(planned, 'max_function_lines'),
        // No limit setting applies at level basic, so the rule keeps SwiftLint's default there.
        ...(planned.level === 'all' && {
            cyclomatic_complexity: buildSeverityLimit(planned, 'max_cyclomatic_complexity'),
        }),
        closure_body_length: buildSeverityLimit(planned, 'max_closure_lines'),
        identifier_name: {
            min_length: 1,
            max_length: getTable(planned.scope.settings, 'naming').swift?.max_characters,
        },
        type_name: { min_length: 1, max_length: getTable(planned.scope.settings, 'naming').swift?.max_characters },
        nesting: {
            type_level: { warning: 1, error: 1 },
            function_level: { warning: SWIFTLINT_FUNCTION_NESTING, error: SWIFTLINT_FUNCTION_NESTING },
        },
        unused_import: { always_keep_imports: getTable(planned.scope.settings, 'swift').allowed_unused_imports },
    };
    const enabled = Object.entries(options).filter(([rule]) => !offSet.has(rule));
    return Object.fromEntries(enabled);
}

function buildSwiftlintFile(planned: PlannedConfig): string {
    const { always } = readToolDisabledRules(planned);
    const off = listDisabledRules(planned);
    const offSet = new Set(off);
    const levelOff = off.filter(
        (rule) => !always.includes(rule) && !SWIFTLINT_OPT_IN.has(rule) && !SWIFTLINT_ANALYZER.has(rule),
    );
    const document = new Document({
        ...buildSwiftlintOptions(planned, offSet),
        disabled_rules: [...always, ...levelOff],
        opt_in_rules: [...SWIFTLINT_OPT_IN.difference(offSet)],
        analyzer_rules: [...SWIFTLINT_ANALYZER.difference(offSet)],
    });
    for (const { key } of (document.contents as YAMLMap<Scalar<string>, Node>).items) {
        const comment = SWIFTLINT_COMMENTS[key.value as keyof typeof SWIFTLINT_COMMENTS] as string | undefined;
        if (comment !== undefined) key.commentBefore = comment;
    }
    const firstLevelOff = (document.get('disabled_rules') as YAMLSeq<Node>).items[always.length];
    if (firstLevelOff !== undefined) firstLevelOff.commentBefore = SWIFTLINT_LEVEL_NOTE;
    return document.toString({ lineWidth: 0 }).trimEnd();
}

export const SWIFTLINT_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'swift/swiftlint.yml': buildSwiftlintFile,
};
