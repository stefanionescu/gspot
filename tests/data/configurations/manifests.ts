export const MINIMUM_VERSION_CASES = [
    { minimum: '4', expected: '4.0.0' },
    { minimum: '4.4', expected: '4.4.0' },
    { minimum: 'future', expected: undefined },
] as const;

export const SEMGREP_ASSETS = [
    'configurations/language/example/tool-files/semgrep/first.yml',
    'configurations/language/example/tool-files/semgrep/second.yml',
    'configurations/language/example/tool-files/semgrep/not-a-pack.txt',
] as const;

export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const SEMGREP_TOOL_FILES = `
[[tool_file]]
target = "other.yml"
pointer = { path = "other.yml", body = "{target}" }

[[tool_file]]
target = "semgrep/first.yml"
tool = "semgrep"
per_scope = true

[[tool_file]]
target = "semgrep/second.yml"
tool = "semgrep"
per_scope = true
`;

/** One tool, a tool file that names no consumer, and one that names a check. */
export const SINGLE_TOOL_FILES = `
[[tool]]
name = "semgrep"
version = "1.0.0"

[[tool_file]]
target = "semgrep/first.yml"
level = "all"

[[tool_file]]
target = "semgrep/second.yml"
check = "example/scan"
`;

export const TOOL_TABLE = '[[tool]]\nname = "example"\nversion = "1.0.0"\n';

export const REPLACE_KEY_TABLE = `${TOOL_TABLE}[[tool.replace_key]]
file = "package.json"
`;

export const EXAMPLE_MANIFEST_PATH = 'configurations/language/example/manifest.toml';

/** The public reader runs once in a separate process for each package fixture. */
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

/** The source and target of each discovered config file. */
export const SEMGREP_CONFIG_FILES: string[][] = [
    ['tool-files/other.yml', '.gspot/configurations/language/example/other.yml'],
    ['tool-files/semgrep/first.yml', '.gspot/configurations/language/example/semgrep/first.yml'],
    ['tool-files/semgrep/second.yml', '.gspot/configurations/language/example/semgrep/second.yml'],
    ['tool-files/semgrep/not-a-pack.txt', '.gspot/configurations/language/example/semgrep/not-a-pack.txt'],
];

/** Replacement items that a manifest refuses. */
/** A tool that replaces two of your files and one key of package.json. */
export const REPLACEMENT_TABLES =
    '[[tool]]\nname = "native"\nversion = "1.0.0"\nreplace = [".native", "native.json"]\n[[tool.replace_key]]\nfile = "package.json"\nkey = "native"\n';

/** [[tool]] tables that a manifest refuses, with the path and message of the refusal inside the tool. */
export const TOOL_TABLE_REFUSALS = [
    {
        name: 'a rule page without {rule}',
        tables: `${TOOL_TABLE}rule_url = "https://example.test/rules"\ncrash_pattern = '^Fatal:'\n`,
        path: ['rule_url'],
        message: 'A rule page names where {rule} goes.',
    },
    {
        name: 'a crash pattern that is no regular expression',
        tables: `${TOOL_TABLE}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '(Fatal'\n`,
        path: ['crash_pattern'],
        message: 'Use a valid Unicode regular expression.',
    },
    ...[
        { list: '".native"', path: ['replace'], message: 'Invalid input: expected array, received string' },
        { list: '[""]', path: ['replace', 0], message: 'Too small: expected string to have >=1 characters' },
        { list: '[7]', path: ['replace', 0], message: 'Invalid input: expected string, received number' },
    ].map(({ list, path, message }) => ({
        name: `the replacement list ${list}`,
        tables: REPLACEMENT_TABLES.replace('[".native", "native.json"]', list),
        path,
        message,
    })),
];
