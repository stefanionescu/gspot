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

export const SINGLE_CONFIG_FILES = `
[[tool]]
name = "semgrep"
version = "1.0.0"

[[config_file]]
target = "semgrep/first.yml"
level = "all"

[[config_file]]
target = "semgrep/second.yml"
check = "example/scan"
`;

export const EXAMPLE_MANIFEST_PATH = 'configurations/language/example/manifest.toml';

export const MANIFEST_READER_SCRIPT = `
import { spyOn } from 'bun:test';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as assets from '#cli/system/assets.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { rmSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
const fixture = JSON.parse(process.argv[1]);
const paths = Object.keys(fixture.files);
const folder = mkdtempSync(join(tmpdir(), 'gspot-manifests-'));
for (const [path, text] of Object.entries(fixture.files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), text);
}

const buildAssetPath = assets.buildAssetPath;
using listing = spyOn(assets, 'listAssets').mockImplementation((prefix) =>
    prefix === 'configurations/' ? paths : fixture.assets.filter((path) => path.startsWith(prefix)),
);
using locating = spyOn(assets, 'buildAssetPath').mockImplementation((path) =>
    path in fixture.files ? join(folder, path) : buildAssetPath(path),
);
try {
    process.stdout.write(JSON.stringify([...readConfigurations()]));
} catch (error) {
    process.stderr.write(error.message);
    process.exitCode = 1;
} finally {
    rmSync(folder, { recursive: true, force: true });
}
`;

export const SEMGREP_CONFIG_FILE_PATHS: string[][] = [
    ['config-files/other.yml', `${GSPOT_PATHS.configurations}/language/example/other.yml`],
    ['config-files/semgrep/first.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/first.yml`],
    ['config-files/semgrep/second.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/second.yml`],
];

export const VALID_SCAN_CHECK = `
[[check]]
name = "scan"
level = "recommended"
stage = "push"
summary = "Scan the project."
example = "Scan a project."
why = "Checks must report defects."
help = "Fix the reported defect."
`;

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

    {
        name: 'an unpinned installer',
        tables: '[[tool]]\nname = "probe"\nnpm = "probe"\n',
        message: 'tool probe has no version pin or minimum.',
    },
    {
        name: 'a pin below its minimum',
        tables: '[[tool]]\nname = "probe"\nversion = "1.0.0"\nmin_version = "2.0.0"\n',
        message: 'tool probe pins 1.0.0 below its minimum 2.0.0.',
    },
    {
        name: 'conflicting installer pins',
        tables: '[[tool]]\nname = "first"\nnpm = { name = "probe", version = "1.0.0" }\n[[tool]]\nname = "second"\nnpm = { name = "probe", version = "2.0.0" }\n',
        message: 'npm:probe has conflicting versions 1.0.0 and 2.0.0.',
    },
    {
        name: 'an unknown setting default',
        tables: '[defaults]\n"unknown.value" = true\n',
        message: 'default unknown.value has no setting declaration.',
    },
    {
        name: 'an unknown config-file tool',
        tables: '[[config_file]]\ntarget = "probe.json"\ntool = "missing"\n',
        message: 'tool missing has no declaration.',
    },
    {
        name: 'an unknown config-file check',
        tables: '[[config_file]]\ntarget = "probe.json"\ncheck = "example/missing"\n',
        message: 'check example/missing has no declaration.',
    },
    {
        name: 'a conditional rule without its file',
        tables: '[rules."MISSING.md"]\nfilenames = ["source.js"]\n',
        message: 'conditional rule MISSING.md has no shipped rule file.',
    },
    {
        name: 'resources at the commit stage',
        tables: VALID_SCAN_CHECK.replace('stage = "push"', 'stage = "commit"') + 'needs = ["network"]\n',
        message: 'example/scan needs resources unavailable at the commit stage.',
    },
    {
        name: 'an empty setting without a condition',
        tables: VALID_SCAN_CHECK + 'command = ["echo", "{setting:structure.environment_readers}"]\n',
        message: 'example/scan uses empty-default setting structure.environment_readers without when.setting.',
    },
    {
        name: 'an undeclared condition setting',
        tables: VALID_SCAN_CHECK + 'when = { setting = "unknown.value" }\n',
        message: 'example/scan waits for undeclared setting unknown.value.',
    },
] as const;
