import { join } from 'node:path';
import * as prettier from 'prettier';
import { test, expect } from 'bun:test';
import { type Options } from 'prettier';
import { parse as parseYaml } from 'yaml';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { generateFile } from '#tests/setup/tool-files.ts';
import { applyGeneratedFiles } from '#tests/setup/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { stringify, parse as parseToml } from '@decimalturn/toml-patch';

import {
    PRETTIER_OPTIONS_BY_FILE,
    FORMAT_OVERRIDES_SETTINGS,
    EDITORCONFIG_SELECTOR_ERRORS,
} from '#tests/data/checks/format.ts';

test.each([...EDITORCONFIG_SELECTOR_ERRORS])(
    'a format override selector that EditorConfig cannot express is a settings error ($pattern)',
    ({ pattern, message }) => {
        const format = { override: [{ paths: [pattern], indent_width: 2 }] };
        expect(
            generateFile(
                buildSandboxSettings(['javascript'], { rules: true, tables: stringify({ format }) }),
                'eslint.config.mjs',
                { 'app/source.js': 'export {};\n' },
            ),
        ).rejects.toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'settings', message }));
    },
);

test('format.indent_width reaches EditorConfig, Prettier and each tool file', async () => {
    const width = 6;
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['format', 'data-files', 'python', 'swift', 'sql', 'markdown', 'bash'], {
            level: 'all',
            rules: true,
            tables: stringify({ format: { indent_width: width } }),
        }),
        'sample.yaml': 'parent:\n child: value\n',
        'sample.sh': 'echo example\n',
        'sample.md': '# Sample\n',
        'sample.py': 'value = 1\n',
        'sample.sql': 'SELECT 1;\n',
        'Sample.swift': 'let value = 1\n',
    });

    const session = await openSession(folder.path);
    const generated = new Map(generate(session).files.map((file) => [file.path, file.content]));
    // Write only .editorconfig, so Prettier resolves its options from EditorConfig alone.
    await writeFile(join(folder.path, '.editorconfig'), generated.get('.editorconfig')!);
    const path = join(folder.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    expect(editor?.tabWidth).toBe(width);
    const configuration = JSON.parse(generated.get('.gspot/configurations/general/format/prettier.json')!) as Options;
    expect(configuration.tabWidth).toBe(width);
    expect(parseJsonc(generated.get('.gspot/configurations/language/markdown/markdownlint.jsonc')!)).toMatchObject({
        MD007: { indent: width },
    });
    expect(parseYaml(generated.get('.gspot/configurations/general/data-files/yamllint.yml')!)).toMatchObject({
        rules: { indentation: { spaces: 'consistent' } },
    });
    expect(parseToml(generated.get('.gspot/configurations/language/python/ruff.toml')!)).toHaveProperty(
        'indent-width',
        width,
    );
    expect(parseToml(generated.get('.gspot/configurations/general/data-files/taplo.toml')!)).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get('.gspot/configurations/language/sql/sqlfluff.cfg')).toContain(
        `tab_space_size = ${String(width)}`,
    );
    expect(generated.get('.gspot/configurations/language/swift/swiftformat')).toContain(`--indent ${String(width)}\n`);
});

test('a YAML indent override gives EditorConfig and Prettier the same width', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['format', 'javascript'], {
            rules: true,
            tables: stringify({ format: { indent_width: 6, override: [{ paths: ['**/*.yaml'], indent_width: 2 }] } }),
        }),
        'sample.yaml': 'parent:\n child: value\n',
    });

    await applyGeneratedFiles(folder.path);
    const path = join(folder.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    const configuration = await prettier.resolveConfig(path, {
        config: join(folder.path, 'prettier.config.mjs'),
        editorconfig: false,
        useCache: false,
    });
    expect(editor?.tabWidth).toBe(2);
    expect(configuration?.tabWidth).toBe(2);
});

test('Prettier overrides agree in the root pointer and editor lookup', async () => {
    await using folder = await testdir();
    const root = folder.path;
    await createFileTree(root, {
        'gspot.toml': FORMAT_OVERRIDES_SETTINGS,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(PRETTIER_OPTIONS_BY_FILE.map(({ file }) => [file, 'const greeting="hello";'])),
    });
    await applyGeneratedFiles(root);
    for (const { file, ...expected } of PRETTIER_OPTIONS_BY_FILE) {
        const computed = await prettier.resolveConfig(join(root, file), {
            config: join(root, 'prettier.config.mjs'),
            editorconfig: true,
            useCache: false,
        });
        expect(computed, file).toMatchObject(expected);
        expect(await prettier.resolveConfig(join(root, file), { editorconfig: true, useCache: false })).toMatchObject(
            expected,
        );
    }
    await writeFile(join(root, 'tests/future.js'), 'const greeting="hello";');
    expect(
        await prettier.resolveConfig(join(root, 'tests/future.js'), {
            config: join(root, 'prettier.config.mjs'),
            useCache: false,
        }),
    ).toMatchObject({ singleQuote: true, semi: true });
});

test('Prettier loads the selected plugin through the root pointer', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['svelte']),
        'source.svelte': '<h1>Example</h1>\n',
    });
    const generated = generate(await openSession(sandbox.path));
    await createFileTree(sandbox.path, Object.fromEntries(generated.files.map(({ path, content }) => [path, content])));
    const toolFile = JSON.parse(
        generated.files.find(({ path }) => path === '.gspot/configurations/general/format/prettier.json')!.content,
    ) as Options;
    expect(toolFile.plugins).toStrictEqual(['./.gspot/node_modules/prettier-plugin-svelte/plugin.js']);
    const pointer = await prettier.resolveConfig(join(sandbox.path, 'source.svelte'), {
        config: join(sandbox.path, 'prettier.config.mjs'),
        useCache: false,
    });
    expect(pointer?.plugins).toStrictEqual([
        join(sandbox.path, '.gspot/node_modules/prettier-plugin-svelte/plugin.js'),
    ]);
});

test('Prettier plugin overrides precede your overrides, and no plugin adds no key', async () => {
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
