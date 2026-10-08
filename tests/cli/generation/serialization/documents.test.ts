import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { RUNNING_VERSION } from '#cli/config/platform/runtime.ts';
import { bodyPointer } from '#cli/generation/documents/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { eta, etaInputs } from '#cli/generation/compilation/public.ts';

import {
    KEY,
    VALUE,
    SCHEME,
    PROJECT,
    REGISTRIES,
    MODULE_VALUE,
    MODULE_TARGETS,
    SERIALIZATION_FILES,
    SERIALIZATION_POLICY,
} from '#tests/config/cli/generation/serialization.ts';

test('JSON option keys and YAML values keep their literal structure', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify(SERIALIZATION_POLICY),
        ...SERIALIZATION_FILES,
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    for (const path of ['.gspot/config/prettier.json', '.gspot/config/knip.json']) {
        const file = output.files.find((entry) => entry.path === path);
        expect(file).toBeDefined();
        const parsed: unknown = parseJsonc(file!.content);
        expect(parsed).toMatchObject({ [KEY]: VALUE });
    }
    const markdownRules = output.files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
    expect(parseJsonc(markdownRules.content)).toMatchObject({ MD044: { names: [KEY, VALUE] } });
    const markdownCli = output.files.find((entry) => entry.path === '.gspot/config/markdownlint-cli2.mjs')!;
    const markdownPath = join(sandbox.path, markdownCli.path);
    await Bun.write(markdownPath, markdownCli.content);
    const native = await runTestCommand(
        [
            process.execPath,
            '-e',
            'const {default: configuration} = await import(process.argv[1]); process.stdout.write(JSON.stringify(configuration.config));',
            pathToFileURL(markdownPath).href,
        ],
        { cwd: sandbox.path },
    );
    expect(native.code, native.stderr).toBe(0);
    expect(JSON.parse(native.stdout)).toStrictEqual({
        extends: join(sandbox.path, '.gspot/config/markdownlint.jsonc'),
    });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get('.gspot/config/periphery.yml')).toMatchObject({ project: PROJECT, schemes: [SCHEME] });
    expect(yaml.get('.gspot/config/hadolint.yml')).toMatchObject({ trustedRegistries: REGISTRIES });
    expect(yaml.get('.gspot/config/yamllint.yml')).toMatchObject({
        rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } },
    });
});

test('the template YAML binding preserves literal mapping keys and scalar values', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildPolicy([]) });
    const session = await openSession(sandbox.path);
    const selection = session.scopes[0]!;
    const inputs = etaInputs(session, selection, selection.selected);
    expect(parseYaml(eta.renderString('<%~ yaml(value) %>', { ...inputs, value: { [KEY]: VALUE } }))).toStrictEqual({
        [KEY]: VALUE,
    });
});

for (const configuration of ['javascript', 'markdown'])
    test(`${configuration} ESM pointers import modules whose directories contain URI delimiters and Unicode`, async () => {
        await using sandbox = await testdir();
        const manifest = configurationManifests().get(configuration)!;
        const pointer = manifest.toolFiles.find(
            (file) => file.pointer?.body?.includes('{target_module}') === true,
        )!.pointer!;
        // Windows file names cannot contain a question mark.
        const components = MODULE_TARGETS.filter(
            (component) => process.platform !== 'win32' || !component.includes('?'),
        );
        const paths = [];
        for (const [index, component] of components.entries()) {
            const target = `generated/${component}/owner.mjs`;
            const output = bodyPointer(pointer, `entry-${String(index)}.mjs`, target, RUNNING_VERSION);
            await createFileTree(sandbox.path, {
                [target]: `export default ${JSON.stringify(MODULE_VALUE)};\n`,
                [output.path]: output.content,
            });
            paths.push(pathToFileURL(join(sandbox.path, output.path)).href);
        }
        const native = await runTestCommand(
            [
                'node',
                '-e',
                'process.stdout.write(JSON.stringify(await Promise.all(process.argv.slice(1).map(async (path) => (await import(path)).default))));',
                ...paths,
            ],
            { cwd: sandbox.path },
        );
        expect(native.code, native.stderr).toBe(0);
        expect(JSON.parse(native.stdout)).toStrictEqual(components.map(() => MODULE_VALUE));
    });

test.each(
    (['recommended', 'all'] as const).flatMap((level) =>
        ['', 'ios # app', 'AppTests', 'AppTests/Helpers'].map((scope) => ({ level, scope })),
    ),
)('XCTest Eta directory pointers retain native overrides at $level in "$scope"', async ({ level, scope }) => {
    await using sandbox = await testdir();
    const prefix = scope === '' ? '' : `${scope}/`;
    const directory = scope.startsWith('AppTests') ? scope : `${prefix}AppTests`;
    const child = `${prefix}ChildTests`;
    const scopeTable = scope === '' ? '' : `[scope.${JSON.stringify(scope)}]\nconfigurations = ["xctest"]\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(scope === '' ? ['xctest'] : [], {
            level,
            tables:
                scopeTable +
                `[scope.${JSON.stringify(child)}]\nremoved_configurations = ["xctest"]\nconfigurations = ["swift"]\n` +
                '[scope."omitted"]\nremoved_configurations = ["xctest"]\nconfigurations = ["swift"]\n',
        }),
        [`${directory}/Value.swift`]: 'import XCTest\n',
        [`${directory}/Deep/Value.swift`]: 'import XCTest\n',
        'omitted/AppTests/Value.swift': 'import XCTest\n',
        [`${child}/Value.swift`]: 'import XCTest\n',
    });
    const files = emitAll(await openSession(sandbox.path)).files;
    const pointer = files.find((file) => file.path === `${directory}/.swiftlint.yml`)!;
    const config = scope === '' ? '.gspot/config/swiftlint.yml' : `.gspot/config/${scope}/swiftlint.yml`;
    expect(parseYaml(pointer.content)).toStrictEqual({
        parent_config: `${'../'.repeat(directory.split('/').length)}${config}`,
        disabled_rules: ['force_unwrapping', 'missing_docs', 'no_magic_numbers'],
    });
    expect(pointer.content).toStartWith('# Generated by gspot ');
    expect(files.filter((file) => file.path === pointer.path)).toHaveLength(1);
    expect(files.some((file) => file.path === `${directory}/Deep/.swiftlint.yml`)).toBe(false);
    expect(parseYaml(files.find((file) => file.path === config)!.content)).toHaveProperty(
        'unused_import.always_keep_imports',
        [],
    );
    expect(files.find((file) => file.path === `${prefix}.swiftlint.yml`)!.content).toContain('parent_config:');
    expect(files.some((file) => file.path === 'omitted/AppTests/.swiftlint.yml')).toBe(false);
    expect(parseYaml(files.find((file) => file.path === `${child}/.swiftlint.yml`)!.content)).not.toHaveProperty(
        'disabled_rules',
    );
});

test.each(['recommended', 'all'] as const)(
    '%s Markdown defaults retain native rule options and the all-only heading checks',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['markdown'], {
                level,
                tables: `[tools.markdownlint.rules.MD044]
names = ["Widget"]
`,
            }),
            'source.md': '# Widget\n',
        });
        const session = await openSession(sandbox.path);
        const file = emitAll(session).files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
        const config = parseJsonc(file.content) as Record<string, unknown>;
        expect(config['default']).toBe(true);
        expect(config['MD013']).toBe(false);
        expect(config['MD033']).toBe(false);
        expect(config['MD041']).toBe(level === 'all');
        expect(config['MD025']).toStrictEqual(level === 'all' ? { front_matter_title: '' } : false);
        expect(config['MD043']).toBeUndefined();
        expect(config['MD044']).toStrictEqual({ names: ['Widget'] });
        expect(config['MD001']).toBeUndefined();
    },
);
