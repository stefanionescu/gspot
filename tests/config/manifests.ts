export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const EXAMPLE_MANIFEST_PATH = 'src/configurations/language/example/manifest.toml';

export const MANIFEST_INVARIANT_CASES = [
    {
        name: 'a PyPI installer without a version',
        tables: '[[tool]]\nname = "probe"\npypi = "probe"\n',
        message:
            'tool.0: Invalid input\ntool.0: A tool reference contains only its name.\ntool.0.pypi: This installer needs an exact version.',
    },
    {
        name: 'check help that names the ignore command',
        tables: '[[check]]\nname = "sample"\nstage = "commit"\nlevel = "basic"\nruns = "files"\nsummary = "A sample."\nexample = "A sample."\nwhy = "A sample."\nhelp = "Run `gspot ignore example/sample`."\n',
        message: "check.0.help: A check's help gives the fix alone. Remove gspot ignore: gspot explain names it.",
    },
] as const;

export const DECLARATION_ORDERS = [
    { order: 'owner first', ownerFirst: true },
    { order: 'consumer first', ownerFirst: false },
];
