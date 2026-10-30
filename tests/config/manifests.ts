export const MINIMUM_VERSION_CASES = [
    { minimum: '4', expected: '4.0.0' },
    { minimum: '4.4', expected: '4.4.0' },
] as const;

export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const EXAMPLE_MANIFEST_PATH = 'configurations/language/example/manifest.toml';

export const MANIFEST_INVARIANT_CASES = [
    {
        name: 'a PyPI installer without a version',
        tables: '[[tool]]\nname = "probe"\npypi = "probe"\n',
        message:
            'tool.0: Invalid input\ntool.0: A tool reference contains only its name.\ntool.0.pypi: This installer needs an exact version.',
    },
] as const;

export const DECLARATION_ORDERS = [
    { order: 'owner first', ownerFirst: true },
    { order: 'consumer first', ownerFirst: false },
];

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
