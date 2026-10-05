/** Declared installer combinations and the private installation each runner selects. */
export const PRIVATE_INSTALLATIONS = [
    {
        name: 'npm',
        tool: 'linter',
        version: '1.0.0',
        installers: { npm: { name: 'linter', version: '1.0.0' } },
        runner: undefined,
        expected: { kind: 'npm', version: '1.0.0' },
    },
    {
        name: 'npm under mise',
        tool: 'linter',
        version: '1.0.0',
        installers: { npm: { name: 'linter', version: '1.0.0' } },
        runner: 'mise',
        expected: { kind: 'npm', version: '1.0.0' },
    },
    {
        name: 'mise preferred',
        tool: 'searcher',
        version: '2.0.0',
        installers: {
            npm: { name: '@scope/searcher', version: '2.0.0' },
            mise: { name: 'searcher', version: '2.0.0' },
        },
        runner: 'mise',
        expected: undefined,
    },
    {
        name: 'npm preferred',
        tool: 'searcher',
        version: '2.0.0',
        installers: {
            npm: { name: '@scope/searcher', version: '2.0.0' },
            mise: { name: 'searcher', version: '2.0.0' },
        },
        runner: 'npm',
        expected: { kind: 'npm', version: '2.0.0' },
    },
    {
        name: 'Python',
        tool: 'formatter',
        version: '3.0.0',
        installers: { pypi: { name: 'formatter', version: '3.0.0' }, mise: { name: 'formatter', version: '3.0.0' } },
        runner: undefined,
        expected: { kind: 'python', version: '3.0.0' },
    },
    {
        name: 'Python under mise',
        tool: 'formatter',
        version: '3.0.0',
        installers: { pypi: { name: 'formatter', version: '3.0.0' }, mise: { name: 'formatter', version: '3.0.0' } },
        runner: 'mise',
        expected: { kind: 'python', version: '3.0.0' },
    },
    {
        name: 'no installer',
        tool: 'compiler',
        version: '4.0.0',
        installers: {},
        runner: undefined,
        expected: undefined,
    },
] as const;

/** Native acquisition hints must account for the repository's chosen installation runner. */
export const NATIVE_HINTS = [
    ['swiftlint', 'none'],
    ['swiftlint', 'mise'],
    ['gitleaks', 'none'],
    ['gitleaks', 'mise'],
] as const;

export const NATIVE_HINT_COMMANDS: Record<string, Record<string, string>> = {
    darwin: { swiftlint: 'brew install swiftlint', gitleaks: 'brew install gitleaks' },
    linux: { swiftlint: 'mise install swiftlint@', gitleaks: 'mise install gitleaks@' },
    win32: { swiftlint: 'mise install swiftlint@', gitleaks: 'winget install Gitleaks.Gitleaks' },
};
