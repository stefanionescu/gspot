/** Actual policy transitions for native rule additions, removals, and option changes. */
export const RULE_CHANGE_CASES = [
    {
        name: 'SwiftLint re-enables an ignored rule',
        configurations: ['swift'],
        file: '.gspot/config/swiftlint.yml',
        source: { 'Example.swift': 'let example = 1\n' },
        initialTables: `[[ignore]]
check = "swift/swiftlint"
rule = "empty_count"
reason = "The sandbox verifies enabling a previously ignored rule."
`,
        changes: [{ path: 'opt_in_rules', added: ['empty_count'], removed: [], changed: [] }],
    },
    {
        name: 'ShellCheck removes a suppression',
        configurations: ['bash'],
        file: '.gspot/config/shellcheckrc',
        source: { 'sample.sh': 'echo sample\n' },
        initialTables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "The sandbox verifies a removed suppression."
`,
        changes: [{ path: 'disable', added: [], removed: ['SC2086'], changed: [] }],
    },
    {
        name: 'Commitlint changes a disabled rule',
        configurations: ['commits'],
        file: '.gspot/config/commitlint.config.cjs',
        source: { 'sample.txt': 'Sample\n' },
        initialTables: `[[ignore]]
check = "commits/commitlint"
rule = "type-case"
reason = "The sandbox verifies enabling a previously disabled rule."
`,
        changes: [{ path: 'rules', added: [], removed: [], changed: ['type-case'] }],
    },
] as const;

export const RULE_CAPTURE_REFUSALS = [
    { document: { rules: [{ id: 'same' }, { id: 'same' }] }, message: 'contains duplicate ID same' },
    { document: { rules: [{ pattern: 'eval(...)' }] }, message: 'must contain records with string IDs' },
    { document: { rules: 1 }, message: 'must contain a rule list or table' },
] as const;
