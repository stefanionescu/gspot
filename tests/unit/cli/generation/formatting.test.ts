import { join } from 'node:path';
import * as prettier from 'prettier';
import { type Options } from 'prettier';
import { parse as parseYaml } from 'yaml';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { stringify, parse as parseToml } from 'smol-toml';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { scopeView, knownSettings } from '#cli/settings/view.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { prettierConfiguration } from '#cli/generation/formatting.ts';
import { SVELTE_PLUGIN, PRETTIER_OPTIONS_BY_FILE, FORMAT_OVERRIDES_SETTINGS } from '#tests/config/formatting.ts';

test('format.indent_width reaches EditorConfig, Prettier and each tool file', async () => {
    const width = 6;
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': stringify({
            level: 'all',
            configurations: ['format', 'files', 'python', 'swift', 'sql', 'markdown', 'bash'],
            format: { indent_width: width },
        }),
        'sample.yaml': 'parent:\n child: value\n',
        'sample.sh': 'echo example\n',
        'sample.md': '# Sample\n',
        'sample.py': 'value = 1\n',
        'sample.sql': 'SELECT 1;\n',
        'Sample.swift': 'let value = 1\n',
    });
    const session = await openSession(directory.path);
    const generated = new Map(emitAll(session).files.map((file) => [file.path, file.content]));
    // Isolate EditorConfig discovery from the Prettier generated configuration for this native consumer.
    await Bun.write(join(directory.path, '.editorconfig'), generated.get('.editorconfig')!);
    const path = join(directory.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    expect(editor?.tabWidth).toBe(width);
    const configuration = JSON.parse(generated.get('.gspot/config/prettier.json')!) as Options;
    expect(configuration.tabWidth).toBe(width);
    expect(parseJsonc(generated.get('.gspot/config/markdownlint.jsonc')!)).toMatchObject({ MD007: { indent: width } });
    expect(parseYaml(generated.get('.gspot/config/yamllint.yml')!)).toMatchObject({
        rules: { indentation: { spaces: 'consistent' } },
    });
    expect(parseToml(generated.get('.gspot/config/ruff.toml')!)['indent-width']).toBe(width);
    expect(parseToml(generated.get('.gspot/config/taplo.toml')!)).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get('.gspot/config/sqlfluff.cfg')).toContain(`tab_space_size = ${String(width)}`);
    expect(generated.get('.gspot/config/swiftformat')).toContain(`--indent ${String(width)}\n`);
    const source = await Bun.file(path).text();
    const expected = `parent:\n${' '.repeat(width)}child: value\n`;
    expect(await prettier.format(source, { ...editor, filepath: path })).toBe(expected);
    expect(await prettier.format(source, { ...configuration, filepath: path })).toBe(expected);
});

test('a YAML indent override gives EditorConfig and Prettier the same width', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': stringify({
            configurations: ['format', 'javascript'],
            format: { indent_width: 6, override: [{ paths: ['**/*.yaml'], indent_width: 2 }] },
        }),
        'sample.yaml': 'parent:\n child: value\n',
    });
    const session = await openSession(directory.path);
    const generated = emitAll(session);
    using log = openWriter(directory.path);
    writeGeneratedFiles(session, generated, log);
    const path = join(directory.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    const configuration = await prettier.resolveConfig(path, {
        config: join(directory.path, '.gspot/config/prettier.json'),
        useCache: false,
    });
    expect(editor?.tabWidth).toBe(2);
    expect(configuration?.tabWidth).toBe(2);
    const root = await prettier.resolveConfig(path, {
        config: join(directory.path, 'prettier.config.mjs'),
        editorconfig: false,
        useCache: false,
    });
    expect(root?.tabWidth).toBe(2);
    const source = await Bun.file(path).text();
    expect(await prettier.format(source, { ...editor, filepath: path })).toBe('parent:\n  child: value\n');
    expect(await prettier.format(source, { ...configuration, filepath: path })).toBe('parent:\n  child: value\n');
});

test('Prettier overrides agree in the tool file, the root pointer and editor lookup', async () => {
    await using directory = await testdir();
    const root = directory.path;
    await createFileTree(root, {
        'gspot.toml': FORMAT_OVERRIDES_SETTINGS,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(PRETTIER_OPTIONS_BY_FILE.map(({ file }) => [file, 'const greeting="hello";'])),
    });
    using log = openWriter(root);
    const session = await openSession(root);
    writeGeneratedFiles(session, emitAll(session), log);
    for (const { file, ...expected } of PRETTIER_OPTIONS_BY_FILE) {
        for (const config of ['.gspot/config/prettier.json', 'prettier.config.mjs']) {
            const computed = await prettier.resolveConfig(join(root, file), {
                config: join(root, config),
                editorconfig: true,
                useCache: false,
            });
            expect(computed, `${file} via ${config}`).toMatchObject(expected);
        }
        expect(await prettier.resolveConfig(join(root, file), { editorconfig: true, useCache: false })).toMatchObject(
            expected,
        );
    }
    await writeFile(join(root, 'tests/future.js'), 'const greeting="hello";');
    expect(
        await prettier.resolveConfig(join(root, 'tests/future.js'), {
            config: join(root, '.gspot/config/prettier.json'),
            useCache: false,
        }),
    ).toMatchObject({ singleQuote: true, semi: true });
});

const settings = parseSettings(
    settingsText(['format'], {
        rules: true,
        tables: '[[format.override]]\npaths = ["docs/**"]\nprint_width = 80\n',
    }),
);

const selected = selectConfigurations(settings.configurations, readManifests(createReadCache(process.cwd())));

const { format } = scopeView(knownSettings(selected, settings.level), settings, selected, '');

describe('prettierConfiguration', () => {
    test('a plugin is imported from the tool project relative to each tool file', () => {
        expect(
            prettierConfiguration({
                settings: settings,
                format,
                targetPath: '.gspot/config/prettier.json',
                extra: undefined,
                plugins: [{ ...SVELTE_PLUGIN, overrides: [...SVELTE_PLUGIN.overrides] }],
            })['plugins'],
        ).toStrictEqual(['../../.gspot/node_modules/prettier-plugin-svelte/plugin.js']);
        expect(
            prettierConfiguration({
                settings: settings,
                format,
                targetPath: 'prettier.config.mjs',
                extra: undefined,
                plugins: [{ ...SVELTE_PLUGIN, overrides: [...SVELTE_PLUGIN.overrides] }],
            })['plugins'],
        ).toStrictEqual(['./.gspot/node_modules/prettier-plugin-svelte/plugin.js']);
    });

    test('plugin overrides come before your overrides, and no plugin adds no key', () => {
        const pluginPolicy = prettierConfiguration({
            settings: settings,
            format,
            targetPath: '.gspot/config/prettier.json',
            extra: undefined,
            plugins: [{ ...SVELTE_PLUGIN, overrides: [...SVELTE_PLUGIN.overrides] }],
        });
        expect(pluginPolicy['overrides']).toMatchObject([
            { files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } },
            { files: ['../../docs/**'], options: { printWidth: 80 } },
        ]);
        const without = prettierConfiguration({
            settings: settings,
            format,
            targetPath: '.gspot/config/prettier.json',
            extra: undefined,
            plugins: [],
        });
        expect(without).not.toHaveProperty('plugins');
        expect(without['overrides']).toMatchObject([{ files: ['../../docs/**'] }]);
    });
});

test('extra editorconfig-checker options reach .editorconfig', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['format'], {
            level: 'all',
            tables: '[tools.editorconfig-checker.extra]\nvalue = { "*.txt" = { end_of_line = "crlf" } }\nreason = "The text export uses the reviewed native line-ending contract."\n',
        }),
        'source.txt': 'text\n',
    });
    const session = await openSession(sandbox.path);
    const editorconfig = emitAll(session).files.find(({ path }) => path === '.editorconfig');
    expect(editorconfig?.content).toContain('[*.txt]\nend_of_line = crlf');
});
