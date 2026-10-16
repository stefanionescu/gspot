import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { listRequiredTools } from '#cli/planning/needed-tools.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { EDITORCONFIG_SETTINGS } from '#tests/data/checks/format.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, parseToolFile } from '#tests/setup/tool-files.ts';
import { SWIFT_FORMAT_SETTINGS } from '#tests/data/checks/swift/projects.ts';
import { NESTED_PYTHON_SETTINGS } from '#tests/data/checks/python/project.ts';
import { PLAIN_TOOL_FILES, TOOL_FILE_PROJECT } from '#tests/data/generated-files/tool-files.ts';

test('a Ruff-only Python scope gets no type checker file or pointer', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_PYTHON_SETTINGS,
        'linted/source.py': 'value = 1\n',
        'typed/source.py': 'value: int = 1\n',
    });
    const paths = generate(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/ruff.toml');
    expect(paths).toContain('linted/ruff.toml');
    expect(paths).toContain('typed/ruff.toml');
    expect(paths).not.toContain('.gspot/config/basedpyrightconfig/linted/basedpyrightconfig.json');
    expect(paths).not.toContain('linted/pyrightconfig.json');
    expect(paths.filter((path) => path.startsWith('.gspot/config/') && path.endsWith('/ruff.toml'))).toHaveLength(1);
    expect(paths).toContain('.gspot/config/basedpyrightconfig.json');
    expect(paths).toContain('typed/pyrightconfig.json');
});
test('a TypeScript-only scope gets the Knip file and no jsconfig', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["typescript"]\n[rules]\nenabled = false\n',
        'src/main.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const paths = generate(session).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/knip.json');
    expect(paths).not.toContain('.gspot/config/jsconfig.json');
});
test('ignoring SwiftLint and Periphery keeps SwiftFormat and drops their files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SWIFT_FORMAT_SETTINGS,
        'main.swift': 'let value = 1\n',
    });
    const paths = generate(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/swiftformat');
    expect(paths).not.toContain('.gspot/config/swiftlint.yml');
    expect(paths).not.toContain('.gspot/config/periphery.yml');
    expect(paths).not.toContain('.gspot/package.json');
});
test('EditorConfig stays without a Prettier file or ignore file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EDITORCONFIG_SETTINGS,
        'sample.json': '{"value":1}\n',
    });
    const paths = generate(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.editorconfig');
    expect(paths).not.toContain('.gspot/config/prettier.json');
    expect(paths).not.toContain('.prettierignore');
});
test('Go and Rust sources get only the formatter files and tools they use', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { level: 'all' }),
        'main.go': 'package main\nfunc main() {}\n',
        'main.rs': 'fn main() {}\n',
    });
    const session = await openSession(sandbox.path);
    const files = generate(session).files;
    const paths = files.map((file) => file.path);
    expect(paths).toContain('.editorconfig');
    expect(paths).toContain('.gspot/config/taplo.toml');
    for (const path of ['.gspot/config/prettier.json', '.prettierignore']) expect(paths).not.toContain(path);
    const packages = listToolProjectPins(session.neededToolManifests).npm;
    const manifests = readManifests(createReadCache(process.cwd()));
    const fileManifest = manifests.get('files')!;
    const expected = listToolProjectPins([
        {
            ...fileManifest,
        },
    ]).npm;
    expect(Object.keys(packages).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
        Object.keys(expected).toSorted((first, second) => first.localeCompare(second)),
    );
});
test.each([...LEVELS])("every configuration's tool files parse at level %s", async (level) => {
    const configurations = [...readManifests(createReadCache(process.cwd())).values()]
        .filter((manifest) => manifest.toolFiles.some((config) => !config.fragment))
        .map((manifest) => manifest.configuration.name);
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...TOOL_FILE_PROJECT,
        'gspot.toml': `level = "${level}"\nconfigurations = ${JSON.stringify(configurations)}\n`,
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const generated = output.files.filter((file) => file.kind === 'tool_file' || file.kind === 'pointer');
    const selected = new Set(
        session.scopes
            .flatMap((scope) => scope.selected)
            .filter((manifest) => configurations.includes(manifest.configuration.name))
            .map((manifest) => manifest.configuration.name),
    );
    expect(selected).toStrictEqual(new Set(configurations));
    const paths = new Set(generated.map((file) => file.path));
    const checks = session.configuredChecks;
    const checkNames = new Set(checks.map((entry) => entry.check.name));
    const tools = new Set(checks.flatMap((entry) => listRequiredTools(entry)));
    for (const { scope, selected: manifests } of session.scopes) {
        const targets = manifests
            .flatMap((manifest) => manifest.toolFiles)
            .filter((file) => !file.fragment)
            .filter((file) => file.level !== 'all' || level === 'all')
            .filter((file) => file.tool.length === 0 || file.tool.some((name) => tools.has(name)))
            .filter((file) => file.check.length === 0 || file.check.some((name) => checkNames.has(name)))
            .map((file) => buildScopeTarget(scope.path, file, session.toolFiles().targets));
        expect(targets.length).toBeGreaterThan(0);
        expect(new Set(targets).difference(paths)).toStrictEqual(new Set<string>());
    }
    for (const file of generated) {
        if (new Set<string>(PLAIN_TOOL_FILES).has(basename(file.path))) continue;
        parseToolFile(file.content, file.path);
    }
});
test('tool file source values list the dependencies of each scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript', 'testing-library'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["javascript", "testing-library"]\n',
        }),
        'package.json': '{"private":true,"dependencies":{"@testing-library/react":"*"}}',
        'app/package.json': '{"private":true,"dependencies":{"@testing-library/vue":"*"}}',
        'sample.test.js': 'export const value = 1;\n',
        'app/sample.test.js': 'export const value = 1;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const configuration = (await eslint.calculateConfigForFile('sample.test.js')) as EslintConfiguration;
    expect(configuration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'react']);
    const applicationConfiguration = (await eslint.calculateConfigForFile('app/sample.test.js')) as EslintConfiguration;
    expect(applicationConfiguration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'vue']);
});
