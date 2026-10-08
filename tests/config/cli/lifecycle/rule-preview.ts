import type { RulePreviewCase } from '#tests/types/cli/lifecycle/rule-preview.ts';

/** Actual policy transitions for native rule additions, removals, and option changes. */
export const RULE_PREVIEW_CASES: RulePreviewCase[] = [
    {
        name: 'SwiftLint re-enables an ignored rule',
        configurations: ['swift'],
        file: '.gspot/config/swiftlint.yml',
        source: { 'Example.swift': 'let example = 1\n' },
        initialLevel: 'all',
        proposedLevel: 'all',
        initialTables:
            '[[ignore]]\ncheck = "swift/swiftlint"\nrule = "empty_count"\nreason = "The fixture verifies enabling a previously ignored rule."\n',
        changes: [
            { path: 'opt_in_rules', added: ['empty_count'], removed: [], changed: [] },
            { path: 'disabled_rules', added: [], removed: ['empty_count'], changed: [] },
        ],
    },
    {
        name: 'ShellCheck removes a suppression',
        configurations: ['bash'],
        file: '.gspot/config/shellcheckrc',
        source: { 'sample.sh': 'echo sample\n' },
        initialLevel: 'all',
        proposedLevel: 'all',
        initialTables:
            '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\nreason = "The fixture verifies a removed suppression."\n',
        changes: [{ path: 'disable', added: [], removed: ['SC2086'], changed: [] }],
    },
    {
        name: 'Commitlint changes a disabled rule',
        configurations: ['commits'],
        file: '.gspot/config/commitlint.config.cjs',
        source: { 'sample.txt': 'Sample\n' },
        initialLevel: 'all',
        proposedLevel: 'all',
        initialTables:
            '[[ignore]]\ncheck = "commits/commitlint"\nrule = "type-case"\nreason = "The fixture verifies enabling a previously disabled rule."\n',
        changes: [{ path: 'rules', added: [], removed: [], changed: ['type-case'] }],
    },
];
