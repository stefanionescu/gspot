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
