import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const MINIMUM_VERSION_CASES = [
    { minimum: '4', expected: '4.0.0' },
    { minimum: '4.4', expected: '4.4.0' },
] as const;

export const SEMGREP_ASSETS = [
    'configurations/language/example/config-files/semgrep/first.yml',
    'configurations/language/example/config-files/semgrep/second.yml',
    'configurations/language/example/config-files/semgrep/not-a-pack.txt',
] as const;

export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const SEMGREP_CONFIG_FILE_TABLES =
    '\n[[config_file]]\ntarget = "other.yml"\npointer = { path = "other.yml", body = "{target}" }\n\n[[config_file]]\ntarget = "semgrep/first.yml"\ntool = "semgrep"\nper_scope = true\n\n[[config_file]]\ntarget = "semgrep/second.yml"\ntool = "semgrep"\nper_scope = true\n';

export const EXAMPLE_MANIFEST_PATH = 'configurations/language/example/manifest.toml';

export const SEMGREP_CONFIG_FILE_PATHS: string[][] = [
    ['config-files/other.yml', `${GSPOT_PATHS.configurations}/language/example/other.yml`],
    ['config-files/semgrep/first.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/first.yml`],
    ['config-files/semgrep/second.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/second.yml`],
];

export const MANIFEST_INVARIANT_CASES = [
    {
        name: 'a PyPI installer without a version',
        tables: '[[tool]]\nname = "probe"\npypi = "probe"\n',
        message:
            'tool.0: Invalid input\ntool.0: A tool reference contains only its name.\ntool.0.pypi: This installer needs an exact version.',
    },
    {
        name: 'a mise installer without a version',
        tables: '[[tool]]\nname = "probe"\nmise = "github:org/probe"\n',
        message:
            'tool.0: Invalid input\ntool.0: A tool reference contains only its name.\ntool.0.mise: This installer needs an exact version.',
    },
] as const;
