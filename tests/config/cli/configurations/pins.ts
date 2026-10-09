/** Declared installer combinations and their tool project installations. */
export const TOOL_PROJECT_PACKAGES = [
    {
        name: 'npm',
        tool: 'linter',
        version: '1.0.0',
        installers: { npm: { name: 'linter', version: '1.0.0' } },
        expected: { kind: 'npm', version: '1.0.0' },
    },
    {
        name: 'npm with a mise installer',
        tool: 'searcher',
        version: '2.0.0',
        installers: {
            npm: { name: '@scope/searcher', version: '2.0.0' },
            mise: { name: 'searcher', version: '2.0.0' },
        },
        expected: { kind: 'npm', version: '2.0.0' },
    },
    {
        name: 'Python',
        tool: 'formatter',
        version: '3.0.0',
        installers: { pypi: { name: 'formatter', version: '3.0.0' }, mise: { name: 'formatter', version: '3.0.0' } },
        expected: { kind: 'python', version: '3.0.0' },
    },
    {
        name: 'no installer',
        tool: 'compiler',
        version: '4.0.0',
        installers: {},
        expected: undefined,
    },
] as const;

/** Native installation hints must account for the repository's chosen installation runner. */
export const NATIVE_HINTS = [
    ['swiftlint', 'none'],
    ['swiftlint', 'mise'],
    ['gitleaks', 'none'],
    ['gitleaks', 'mise'],
] as const;
