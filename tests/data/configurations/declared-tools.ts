/** Installer combinations that a tool declares, and what each one installs in the tool project. */
export const TOOL_PROJECT_PACKAGES = [
    {
        name: 'npm',
        tool: 'linter',
        version: '1.0.0',
        system: false,
        installers: { npm: { name: 'linter', version: '1.0.0' } },
        expected: { kind: 'npm', name: 'linter', version: '1.0.0', requires: ['node'] },
    },
    {
        name: 'npm with a mise installer',
        tool: 'searcher',
        version: '2.0.0',
        system: false,
        installers: {
            npm: { name: '@scope/searcher', version: '2.0.0' },
            mise: { name: 'searcher', version: '2.0.0' },
        },
        expected: { kind: 'npm', name: '@scope/searcher', version: '2.0.0', requires: ['node'] },
    },
    {
        name: 'Python',
        tool: 'formatter',
        version: '3.0.0',
        system: false,
        installers: { pypi: { name: 'formatter', version: '3.0.0' }, mise: { name: 'formatter', version: '3.0.0' } },
        expected: { kind: 'python', name: 'formatter', version: '3.0.0' },
    },
    {
        name: 'a system tool with a pypi pin',
        tool: 'checker',
        version: '5.0.0',
        system: true,
        installers: { pypi: { name: 'checker', version: '5.0.0' } },
        expected: undefined,
    },
    {
        name: 'no installer',
        tool: 'compiler',
        version: '4.0.0',
        system: false,
        installers: {},
        expected: undefined,
    },
] as const;
