import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import * as prettier from 'prettier';
import type { Options } from 'prettier';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { EDITORCONFIG_SELECTOR_ERRORS } from '#tests/config/configurations/general.ts';
import {
    FORMAT_OVERRIDES_SETTINGS,
    NESTED_YAML,
    PRETTIER_OPTIONS_BY_FILE,
} from '#tests/config/setup/configurations.ts';
import { GREETING_SOURCE } from '#tests/config/setup/languages.ts';
import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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

test.each([
    { configurations: ['bash'], shfmt: '\nswitch_case_indent = true\nsimplify = true' },
    { configurations: [], shfmt: '' },
])('EditorConfig holds the shfmt layout when $configurations is selected', async ({ configurations, shfmt }) => {
    const settings = { configurations, format: { indent_style: 'space', indent_width: 4 } };
    const text = await buildGeneratedFile(stringify(settings), '.editorconfig', { 'run.sh': 'echo ready\n' });
    expect(text).toContain(`indent_style = space
indent_size = 4${shfmt}

`);
});

test('EditorConfig gives the files of a format override their indent', async () => {
    const settings = {
        configurations: ['bash'],
        format: {
            indent_style: 'space',
            indent_width: 2,
            override: [{ paths: ['**/*.sh', '**/*.bash'], indent_width: 4 }],
        },
    };
    const text = await buildGeneratedFile(stringify(settings), '.editorconfig', { 'run.sh': 'echo ready\n' });
    expect(text).toContain('[/**/*.sh]\nindent_size = 4\n');
    expect(text).toContain('[/**/*.bash]\nindent_size = 4\n');
});

test('Prettier loads the selected plugin through the root pointer file', async () => {
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

test('Prettier keeps Markdown samples as written, and the plugin overrides come before your overrides', async () => {
    const settings = {
        configurations: ['astro'],
        format: { override: [{ paths: ['docs/**'], print_width: 80 }] },
    };
    const pluginPolicy = JSON.parse(
        await buildGeneratedFile(stringify(settings), getManifestTarget('format', 'prettier.json'), {
            'source.astro': '<h1>Example</h1>\n',
        }),
    ) as Options;
    expect(pluginPolicy['overrides']).toMatchObject([
        {},
        { files: '*.astro', options: { parser: 'astro' } },
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

test('Prettier reads the bracket, arrow, and prose settings, in the table and in an override', async () => {
    const format = { bracket_spacing: false, arrow_parens: 'avoid', prose_wrap: 'always' };
    const override = { paths: ['**/*.ts'], bracket_spacing: true };
    const settings = { configurations: [], format: { ...format, override: [override] } };
    const text = await buildGeneratedFile(stringify(settings), getManifestTarget('format', 'prettier.json'), {
        'README.md': '# Example\n',
    });
    expect(JSON.parse(text)).toMatchObject({
        bracketSpacing: false,
        arrowParens: 'avoid',
        proseWrap: 'always',
        overrides: [{}, { files: ['**/*.ts'], options: { bracketSpacing: true } }],
    });
});

test('Prettier overrides agree in the root pointer file and editor lookup', async () => {
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
