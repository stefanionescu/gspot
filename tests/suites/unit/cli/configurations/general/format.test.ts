import { join } from 'node:path';
import * as prettier from 'prettier';
import { test, expect } from 'bun:test';
import type { Options } from 'prettier';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { GREETING_SOURCE } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { EDITORCONFIG_SELECTOR_ERRORS } from '#tests/config/configurations/general.ts';
import { getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

import {
    NESTED_YAML,
    PRETTIER_OPTIONS_BY_FILE,
    FORMAT_OVERRIDES_SETTINGS,
} from '#tests/config/setup/configurations.ts';

test.each([...EDITORCONFIG_SELECTOR_ERRORS])(
    'a format override selector that EditorConfig cannot express is a settings error ($pattern)',
    async ({ pattern, message }) => {
        const format = { override: [{ paths: [pattern], indent_width: 2 }] };
        const generated = buildGeneratedFile(
            buildSandboxSettings(['javascript'], { rules: true, tables: stringify({ format }) }),
            'eslint.config.mjs',
            { 'app/source.js': 'export {};\n' },
        );
        const error = await captureRejection(generated);
        expect(error).toMatchObject({ name: 'GspotError', code: 'settings', message });
    },
);

test('Prettier loads the selected plugin through the root link file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['svelte']),
        'source.svelte': '<h1>Example</h1>\n',
    });
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    await createFileTree(sandbox.path, Object.fromEntries(generated.files.map(({ path, content }) => [path, content])));
    const editorOptions = await prettier.resolveConfig(join(sandbox.path, 'source.svelte'), {
        config: join(sandbox.path, 'prettier.config.mjs'),
        useCache: false,
    });
    expect(editorOptions?.plugins).toStrictEqual([
        join(sandbox.path, GSPOT_PATHS.nodeModules, 'prettier-plugin-svelte/plugin.js'),
    ]);
});

test('the Prettier plugin overrides come before your overrides', async () => {
    const settings = {
        configurations: ['svelte'],
        format: { override: [{ paths: ['docs/**'], print_width: 80 }] },
    };
    const pluginPolicy = JSON.parse(
        await buildGeneratedFile(stringify(settings), getManifestTarget('format', 'prettier.json'), {
            'source.svelte': '<h1>Example</h1>\n',
        }),
    ) as Options;
    expect(pluginPolicy['overrides']).toMatchObject([
        { files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } },
        { files: ['docs/**'], options: { printWidth: 80 } },
    ]);
});

test('a YAML indent override gives EditorConfig and Prettier the same width', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['format', 'javascript'], {
            rules: true,
            tables: stringify({ format: { indent_width: 6, override: [{ paths: ['**/*.yaml'], indent_width: 2 }] } }),
        }),
        'sample.yaml': NESTED_YAML,
    });

    await applyGeneratedFiles(sandbox.path);
    const path = join(sandbox.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    const configuration = await prettier.resolveConfig(path, {
        config: join(sandbox.path, 'prettier.config.mjs'),
        editorconfig: false,
        useCache: false,
    });
    expect(editor?.tabWidth).toBe(2);
    expect(configuration?.tabWidth).toBe(2);
});

test('Prettier overrides agree in the root link file and editor lookup', async () => {
    await using sandbox = await createGitSandbox({});
    const root = sandbox.path;
    await createFileTree(root, {
        'gspot.toml': FORMAT_OVERRIDES_SETTINGS,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(PRETTIER_OPTIONS_BY_FILE.map(({ file }) => [file, GREETING_SOURCE])),
    });
    await applyGeneratedFiles(root);
    for (const { file, ...expected } of PRETTIER_OPTIONS_BY_FILE) {
        const config = await prettier.resolveConfig(join(root, file), {
            config: join(root, 'prettier.config.mjs'),
            editorconfig: true,
            useCache: false,
        });
        expect(config, file).toMatchObject(expected);
        expect(await prettier.resolveConfig(join(root, file), { editorconfig: true, useCache: false })).toMatchObject(
            expected,
        );
    }
    await writeFile(join(root, 'tests/future.js'), GREETING_SOURCE);
    expect(
        await prettier.resolveConfig(join(root, 'tests/future.js'), {
            config: join(root, 'prettier.config.mjs'),
            useCache: false,
        }),
    ).toMatchObject({ singleQuote: true, semi: true });
});
