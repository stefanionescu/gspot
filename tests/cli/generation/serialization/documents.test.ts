import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { bodyPointer } from '#cli/generation/pointers.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { RUNNING_VERSION } from '#cli/config/platform/runtime.ts';
import { eta, templateInputs } from '#cli/generation/templates.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

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
    const inputs = templateInputs(session, selection, selection.selected);
    expect(parseYaml(eta.renderString('<%~ yaml(value) %>', { ...inputs, value: { [KEY]: VALUE } }))).toStrictEqual({
        [KEY]: VALUE,
    });
});

for (const configuration of ['javascript', 'markdown'])
    for (const component of MODULE_TARGETS)
        test.skipIf(process.platform === 'win32' && component.includes('?'))(
            `${configuration} ESM pointers import a module whose directory contains ${component}`,
            async () => {
                await using sandbox = await testdir();
                const manifest = configurationManifests().get(configuration)!;
                const pointer = manifest.configs.find(
                    (file) => file.stub_file?.body?.includes('{target_module}') === true,
                )!.stub_file!;
                const target = `generated/${component}/owner.mjs`;
                const output = bodyPointer(pointer, 'entry.mjs', target, RUNNING_VERSION);
                await createFileTree(sandbox.path, {
                    [target]: `export default ${JSON.stringify(MODULE_VALUE)};\n`,
                    [output.path]: output.content,
                });
                const native = await runTestCommand(
                    [
                        'node',
                        '-e',
                        'process.stdout.write(JSON.stringify((await import(process.argv[1])).default));',
                        pathToFileURL(join(sandbox.path, output.path)).href,
                    ],
                    { cwd: sandbox.path },
                );
                expect(native.code, native.stderr).toBe(0);
                expect(JSON.parse(native.stdout)).toStrictEqual(MODULE_VALUE);
            },
        );
