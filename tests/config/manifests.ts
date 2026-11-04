export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const EXAMPLE_MANIFEST_FOLDER = 'src/configurations/language/example';

export const MANIFEST_INVARIANT_CASES = [
    {
        name: 'a PyPI installer without a version',
        tables: '[[tool]]\nname = "probe"\npypi = "probe"\n',
        field: 'tool.0.pypi',
    },
    {
        name: 'check help that names the ignore command',
        tables: '[[check]]\nname = "sample"\nstage = "commit"\nlevel = "basic"\nruns = "files"\nsummary = "A sample."\nexample = "A sample."\nwhy = "A sample."\nhelp = "Run `gspot ignore example/sample`."\n',
        field: 'check.0.help',
    },
] as const;

export const DECLARATION_ORDERS = [
    { order: 'owner first', ownerFirst: true },
    { order: 'consumer first', ownerFirst: false },
];
