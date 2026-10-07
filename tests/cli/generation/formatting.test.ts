import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { planRun } from '#cli/planning/plan.ts';
import prettier, { type Options } from 'prettier';
import { test, expect, describe } from 'bun:test';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { scopeView } from '#cli/policy/settings/view.ts';
import { stringify, parse as parseToml } from 'smol-toml';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { prettierConfiguration } from '#cli/generation/formatting.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { prepareCommand, commandEnvironment } from '#cli/execution/command/check.ts';
import { FORMAT_CASES, FORMAT_OVERRIDES_POLICY } from '#tests/config/samples/formatting.ts';
import { IGNORE_CASES, IGNORE_POLICY, SVELTE_PLUGIN } from '#tests/config/cli/generation/formatting.ts';
import type { YamllintConfiguration, MarkdownlintConfiguration } from '#tests/types/generation/configuration-files.ts';

test.each(['recommended', 'all'] as const)(
    '%s keeps Taplo defaults and applies only declared formatting choices',
    async (level) => {
        await using sandbox = await testdir();
        for (const tables of ['', '[tools.taplo.formatting]\ncompact_inline_tables = true\n']) {
            await createFileTree(sandbox.path, {
                'gspot.toml': buildPolicy([], { level, tables }),
                'settings.toml': 'entry = { key = true }\n',
            });
            const output = emitAll(await openSession(sandbox.path)).files.find(
                (file) => file.path === '.gspot/config/taplo.toml',
            )!;
            const document = parseToml(output.content);
            expect(document).toHaveProperty('schema.enabled', false);
            expect(document).toMatchObject({ formatting: { indent_string: ' '.repeat(4), column_width: 120 } });
            if (tables === '') expect(document).not.toHaveProperty('formatting.compact_inline_tables');
            else expect(document).toHaveProperty('formatting.compact_inline_tables', true);
        }
    },
);

test('the format width reaches editors and generated tool configurations', async () => {
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
    const [bashCheck] = planRun(session, { stage: 'all', skips: [], only: ['bash/shfmt'] });
    const command = prepareCommand(
        session,
        bashCheck!,
        bashCheck!.check.command!,
        commandEnvironment(session, bashCheck!),
    );
    expect(command.argv[command.argv.indexOf('-i') + 1]).toBe(String(width));
    // Isolate EditorConfig discovery from the Prettier generated configuration for this native consumer.
    await Bun.write(join(directory.path, '.editorconfig'), generated.get('.editorconfig')!);
    const path = join(directory.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    expect(editor?.tabWidth).toBe(width);
    const native = JSON.parse(generated.get('.gspot/config/prettier.json')!) as Options;
    expect(native.tabWidth).toBe(width);
    const markdownlint = parseJsonc(generated.get('.gspot/config/markdownlint.jsonc')!) as MarkdownlintConfiguration;
    expect(markdownlint.MD007.indent).toBe(width);
    const yamllint = parseYaml(generated.get('.gspot/config/yamllint.yml')!) as YamllintConfiguration;
    expect(yamllint.rules.indentation.spaces).toBe('consistent');
    expect(parseToml(generated.get('.gspot/config/ruff.toml')!)['indent-width']).toBe(width);
    expect(parseToml(generated.get('.gspot/config/taplo.toml')!)).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get('.gspot/config/sqlfluff.cfg')).toContain(`tab_space_size = ${String(width)}`);
    expect(generated.get('.gspot/config/swiftformat')).toContain(`--indent ${String(width)}\n`);
    const source = await Bun.file(path).text();
    const expected = `parent:\n${' '.repeat(width)}child: value\n`;
    expect(await prettier.format(source, { ...editor, filepath: path })).toBe(expected);
    expect(await prettier.format(source, { ...native, filepath: path })).toBe(expected);
});

test('an explicit YAML width override remains consistent between EditorConfig and Prettier', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': stringify({
            configurations: ['format'],
            format: { indent_width: 6, overrides: [{ paths: ['**/*.yaml'], indent_width: 2 }] },
        }),
        'sample.yaml': 'parent:\n child: value\n',
    });
    const session = await openSession(directory.path);
    const generated = emitAll(session);
    using log = openOwnership(directory.path);
    writeOutputs(session, log, undefined, generated);
    const path = join(directory.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    const native = await prettier.resolveConfig(path, {
        config: join(directory.path, '.gspot/config/prettier.json'),
        useCache: false,
    });
    expect(editor?.tabWidth).toBe(2);
    expect(native?.tabWidth).toBe(2);
    const root = await prettier.resolveConfig(path, {
        config: join(directory.path, '.prettierrc.json'),
        editorconfig: false,
        useCache: false,
    });
    expect(root?.tabWidth).toBe(2);
    const source = await Bun.file(path).text();
    expect(await prettier.format(source, { ...editor, filepath: path })).toBe('parent:\n  child: value\n');
    expect(await prettier.format(source, { ...native, filepath: path })).toBe('parent:\n  child: value\n');
});

test('formatter overrides agree for explicit configuration and editor discovery', async () => {
    await using directory = await testdir();
    const root = directory.path;
    await createFileTree(root, {
        'gspot.toml': FORMAT_OVERRIDES_POLICY,
        'package.json': '{"private":true}\n',
        ...Object.fromEntries(FORMAT_CASES.map(({ file }) => [file, 'const greeting="hello";'])),
    });
    using log = openOwnership(root);
    writeOutputs(await openSession(root), log);
    for (const { file, ...expected } of FORMAT_CASES) {
        for (const config of ['.gspot/config/prettier.json', '.prettierrc.json']) {
            const resolved = await prettier.resolveConfig(join(root, file), {
                config: join(root, config),
                editorconfig: true,
                useCache: false,
            });
            expect(resolved, `${file} via ${config}`).toMatchObject(expected);
        }
        expect(await prettier.resolveConfig(join(root, file), { editorconfig: true, useCache: false })).toMatchObject(
            expected,
        );
    }
    writeFileSync(join(root, 'tests/future.js'), 'const greeting="hello";');
    expect(
        await prettier.resolveConfig(join(root, 'tests/future.js'), {
            config: join(root, '.gspot/config/prettier.json'),
            useCache: false,
        }),
    ).toMatchObject({ singleQuote: true, semi: true });
});

test.each(IGNORE_CASES)('generated Prettier ignore patterns give $file ignored=$ignored', async ({ file, ignored }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': stringify(IGNORE_POLICY),
        'package.json': '{"packageManager":"pnpm@9.0.0"}',
        'source.ts': 'export const value = 1;\n',
        [file]: 'const value={enabled:true};\n',
    });
    const generated = emitAll(await openSession(directory.path)).files.find(({ path }) => path === '.prettierignore')!;
    const ignorePath = join(directory.path, generated.path);
    await Bun.write(ignorePath, generated.content);
    const result = await prettier.getFileInfo(join(directory.path, file), { ignorePath, resolveConfig: false });
    expect(result).toStrictEqual({ ignored, inferredParser: ignored ? null : 'typescript' });
});

const policy = parseStrictPolicy(
    buildPolicy(['format'], { tables: '[[format.overrides]]\npaths = ["docs/**"]\nprint_width = 80\n' }),
);
const selected = selectConfigurations(policy.configurations, configurationManifests());
const { format } = scopeView(knownSettings(selected, policy.level), policy, selected, '');

describe('prettierConfiguration', () => {
    test('a plugin is loaded from the tool project installation relative to each configuration file', () => {
        expect(
            prettierConfiguration({
                policy,
                format,
                targetPath: '.gspot/config/prettier.json',
                verbatim: undefined,
                plugins: [SVELTE_PLUGIN],
            })['plugins'],
        ).toStrictEqual(['../../.gspot/node_modules/prettier-plugin-svelte/plugin.js']);
        expect(
            prettierConfiguration({
                policy,
                format,
                targetPath: '.prettierrc.json',
                verbatim: undefined,
                plugins: [SVELTE_PLUGIN],
            })['plugins'],
        ).toStrictEqual(['./.gspot/node_modules/prettier-plugin-svelte/plugin.js']);
    });

    test('plugin overrides come before policy overrides, and no plugin adds no key', () => {
        const pluginPolicy = prettierConfiguration({
            policy,
            format,
            targetPath: '.gspot/config/prettier.json',
            verbatim: undefined,
            plugins: [SVELTE_PLUGIN],
        });
        expect(pluginPolicy['overrides']).toMatchObject([
            { files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } },
            { files: ['../../docs/**'], options: { printWidth: 80 } },
        ]);
        const without = prettierConfiguration({
            policy,
            format,
            targetPath: '.gspot/config/prettier.json',
            verbatim: undefined,
            plugins: [],
        });
        expect(without).not.toHaveProperty('plugins');
        expect(without['overrides']).toMatchObject([{ files: ['../../docs/**'] }]);
    });
});
