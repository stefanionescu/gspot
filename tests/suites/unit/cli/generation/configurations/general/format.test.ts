import { join } from 'node:path';
import * as prettier from 'prettier';
import { test, expect } from 'bun:test';
import { type Options } from 'prettier';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { generate } from '#cli/generation/generate.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { generateFile, findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { EDITORCONFIG_SELECTOR_ERRORS } from '#tests/config/generation/configurations/general/format.ts';

test.each([...EDITORCONFIG_SELECTOR_ERRORS])(
    'a format override selector that EditorConfig cannot express is a settings error ($pattern)',
    async ({ pattern, message }) => {
        const format = { override: [{ paths: [pattern], indent_width: 2 }] };
        const settingsText = generateFile(
            buildSandboxSettings(['javascript'], { rules: true, tables: stringify({ format }) }),
            'eslint.config.mjs',
            { 'app/source.js': 'export {};\n' },
        );
        const error = await captureRejection(settingsText);
        expect(error).toMatchObject({ name: 'GspotError', code: 'settings', message });
    },
);

test('Prettier loads the selected plugin through the root pointer', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['svelte']),
        'source.svelte': '<h1>Example</h1>\n',
    });
    const generated = generate(await openSession(sandbox.path));
    await createFileTree(sandbox.path, Object.fromEntries(generated.files.map(({ path, content }) => [path, content])));
    const configFile = JSON.parse(
        generated.files.find(({ path }) => path === findManifestTarget('format', 'prettier.json'))!.content,
    ) as Options;
    expect(configFile.plugins).toStrictEqual([`./${GSPOT_PATHS.nodeModules}/prettier-plugin-svelte/plugin.js`]);
    const pointer = await prettier.resolveConfig(join(sandbox.path, 'source.svelte'), {
        config: join(sandbox.path, 'prettier.config.mjs'),
        useCache: false,
    });
    expect(pointer?.plugins).toStrictEqual([
        join(sandbox.path, GSPOT_PATHS.nodeModules, 'prettier-plugin-svelte/plugin.js'),
    ]);
});

test('the Prettier plugin overrides come before your overrides, and without a plugin the Prettier file has no plugins key', async () => {
    const settings = {
        configurations: ['svelte'],
        format: { override: [{ paths: ['docs/**'], print_width: 80 }] },
    };
    const pluginPolicy = JSON.parse(
        await generateFile(stringify(settings), findManifestTarget('format', 'prettier.json'), {
            'source.svelte': '<h1>Example</h1>\n',
        }),
    ) as Options;
    expect(pluginPolicy['overrides']).toMatchObject([
        { files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } },
        { files: ['docs/**'], options: { printWidth: 80 } },
    ]);
    const without = JSON.parse(
        await generateFile(
            stringify({ ...settings, configurations: ['format'] }),
            findManifestTarget('format', 'prettier.json'),
            { 'source.js': 'export {};\n' },
        ),
    ) as Options;
    expect(without).not.toHaveProperty('plugins');
    expect(without['overrides']).toMatchObject([{ files: ['docs/**'] }]);
});
