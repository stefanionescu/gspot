import { join } from 'node:path';
import * as prettier from 'prettier';
import { test, expect } from 'bun:test';
import { type Options } from 'prettier';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { generate } from '#cli/generation/generate.ts';
import { generateFile } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('Prettier loads the selected plugin through the root pointer', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['svelte']),
        'source.svelte': '<h1>Example</h1>\n',
    });
    const generated = generate(await openSession(sandbox.path));
    await createFileTree(sandbox.path, Object.fromEntries(generated.files.map(({ path, content }) => [path, content])));
    const configFile = JSON.parse(
        generated.files.find(({ path }) => path === '.gspot/configurations/general/format/prettier.json')!.content,
    ) as Options;
    expect(configFile.plugins).toStrictEqual(['./.gspot/node_modules/prettier-plugin-svelte/plugin.js']);
    const pointer = await prettier.resolveConfig(join(sandbox.path, 'source.svelte'), {
        config: join(sandbox.path, 'prettier.config.mjs'),
        useCache: false,
    });
    expect(pointer?.plugins).toStrictEqual([
        join(sandbox.path, '.gspot/node_modules/prettier-plugin-svelte/plugin.js'),
    ]);
});
test('the Prettier plugin overrides come before your overrides, and without a plugin the Prettier file has no plugins key', async () => {
    const settings = {
        configurations: ['svelte'],
        format: { override: [{ paths: ['docs/**'], print_width: 80 }] },
    };
    const pluginPolicy = JSON.parse(
        await generateFile(stringify(settings), '.gspot/configurations/general/format/prettier.json', {
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
            '.gspot/configurations/general/format/prettier.json',
            {
                'source.js': 'export {};\n',
            },
        ),
    ) as Options;
    expect(without).not.toHaveProperty('plugins');
    expect(without['overrides']).toMatchObject([{ files: ['docs/**'] }]);
});
