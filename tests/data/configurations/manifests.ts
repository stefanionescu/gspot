export const INVALID_VERSION_FLOORS = [['future']] as const;

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

export const REPLACE_DECLARATION = `[[tool]]
name = "example"
version = "1.0.0"
[[tool.replace_key]]
file = "package.json"
`;

/** Installer combinations that a tool declares, and what each one installs in the tool project. */
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

export const TOOL_DECLARATION = '[[tool]]\nname = "example"\nversion = "1.0.0"\n';

export const EXAMPLE_MANIFEST_PATH = 'configurations/language/example/manifest.toml';

/** The public reader runs once in a separate process for each package fixture. */
export const MANIFEST_READER_SCRIPT = `
import { spyOn } from 'bun:test';
import * as assets from '#cli/system/assets.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
const fixture = JSON.parse(process.argv[1]);
const paths = Object.keys(fixture.files);
const readAsset = assets.readAsset;
using listing = spyOn(assets, 'listAssets').mockImplementation((prefix) =>
    prefix === 'configurations/' ? paths : fixture.assets.filter((path) => path.startsWith(prefix)),
);
using reading = spyOn(assets, 'readAsset').mockImplementation((path) => fixture.files[path] ?? readAsset(path));
try {
    process.stdout.write(JSON.stringify([...readManifests()]));
} catch (error) {
    process.stderr.write(error.message);
    process.exitCode = 1;
}
`;
