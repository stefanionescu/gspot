import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import type { InitJson } from '#cli/types/commands/edits.ts';
import type { FormatSettings } from '#cli/types/configurations/language.ts';
import { INVALID_PRETTIER_OPTIONS, UNREADABLE_PRETTIER_FILES } from '#tests/config/generation/carryover.ts';

import {
    FORMAT_FILE_CASES,
    SCOPE_FORMAT_FILES,
    WORKSPACE_PYTHON_FILES,
    FORMAT_WORKSPACE_FILES,
    PRETTIER_FORMAT_OPTIONS,
} from '#tests/config/generation/settings.ts';

test.each(INVALID_PRETTIER_OPTIONS)(
    'init drops $field of $file, which gspot.toml cannot hold, and goes on',
    async ({ file, field, text }) => {
        await using sandbox = await testdir({
            ...FORMAT_WORKSPACE_FILES,
            'source.js': 'export const value = 1;\n',
            'app/source.js': 'export const value = 2;\n',
            [file]: text,
        });
        commitAll(sandbox.path);
        const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
        expect(plan.carryover.find(({ path }) => path === file)?.dropped).toStrictEqual([field]);
    },
);

async function readInitFormatOptions(root: string, commandArguments: string[]): Promise<FormatSettings[]> {
    const result = await runGspot(root, [...commandArguments, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = (JSON.parse(result.stdout) as InitJson).settingsText;
    const session = await openSession(root, { settings: readSettings(text, root) });
    return session.scopes.map(({ settings }) => getTable(settings, 'format'));
}

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    await using sandbox = await testdir({ 'source.txt': 'source\n', ...files });
    commitAll(sandbox.path);
    const options = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(options[0]).toMatchObject(expected);
});

test('init reads the format settings of each scope', async () => {
    await using sandbox = await testdir(SCOPE_FORMAT_FILES);
    await createFileTree(sandbox.path, FORMAT_WORKSPACE_FILES);
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = (JSON.parse(result.stdout) as InitJson).settingsText;
    const session = await openSession(sandbox.path, {
        settings: readSettings(text, sandbox.path),
    });
    expect(
        session.scopes.map(({ path, settings }) => {
            const { indent_width, print_width, quotes } = getTable(settings, 'format');
            return [path, indent_width, print_width, quotes];
        }),
    ).toStrictEqual([
        ['', 2, 90, 'double'],
        ['app', 6, 100, 'single'],
        ['app/deep', 6, 100, 'single'],
        ['sibling', 2, 90, 'double'],
    ]);
});

test('init turns Prettier overrides and the Ruff quote style into format overrides', async () => {
    await using sandbox = await testdir({
        '.prettierrc.json': JSON.stringify({
            tabWidth: 4,
            printWidth: 120,
            overrides: [{ files: ['*.ts', 'src/**/*.css'], options: { tabWidth: 2, printWidth: 100 } }],
        }),
        'ruff.toml': '[format]\nquote-style = "single"\n',
        'main.py': 'value = 1\n',
        'package.json': '{"private":true,"devDependencies":{"prettier":"3.8.1"}}',
        'source.ts': 'export {};\n',
        'src/style.css': 'a {}\n',
    });
    commitAll(sandbox.path);
    const options = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(options[0]).toMatchObject(PRETTIER_FORMAT_OPTIONS);
});

test('init leaves out an override that matches no tracked file', async () => {
    await using sandbox = await testdir({
        '.editorconfig': '[*]\nindent_size = 2\n[*.py]\nindent_size = 4\n[Makefile]\nindent_style = tab\n',
        'source.js': 'export const value = 1;\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settingsText'>>;
    expect(settingsText).not.toContain('override');
});

test.each([...UNREADABLE_PRETTIER_FILES])(
    'init names the format settings it cannot read from $path',
    async ({ path, text }) => {
        await using sandbox = await testdir({
            [path]: text,
            'source.js': 'export const count = 1;\n',
        });
        commitAll(sandbox.path);
        const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan, settingsText } = JSON.parse(result.stdout) as InitJson;
        expect([...plan.delete, ...plan.write].find((file) => file.path === path)?.note).toContain(
            'gspot could not load this Prettier config, so set format.indent_width and format.print_width by hand',
        );
        expect(parse(settingsText) as TomlTable).toHaveProperty('format', {
            indent_width: 2,
            print_width: 80,
            quotes: 'double',
        });
    },
);

test.each([
    { path: 'prettier.config.mjs', text: 'export default { printWidth: 100, semi: false };\n' },
    { path: '.prettierrc.cjs', text: 'module.exports = { printWidth: 100, semi: false };\n' },
])('init reads the JavaScript Prettier config $path', async ({ path, text }) => {
    await using sandbox = await testdir({ [path]: text, 'source.js': 'export const count = 1;\n' });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(formats[0]).toMatchObject({ print_width: 100, semicolons: false });
});

test('init runs no Prettier config outside the root and the scopes', async () => {
    await using sandbox = await testdir({
        'tests/samples/prettier.config.mjs':
            "import { writeFileSync } from 'node:fs';\nwriteFileSync(new URL('ran', import.meta.url), '');\nexport default {};\n",
        'source.js': 'export const count = 1;\n',
    });
    commitAll(sandbox.path);
    await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(existsSync(join(sandbox.path, 'tests/samples/ran'))).toBe(false);
});

test('init carries the bracket, arrow, and prose options of Prettier', async () => {
    await using sandbox = await testdir({
        '.prettierrc.json': '{"bracketSpacing":false,"arrowParens":"avoid","proseWrap":"always"}',
        'source.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(formats[0]).toMatchObject({ bracket_spacing: false, arrow_parens: 'avoid', prose_wrap: 'always' });
});

test('init carries the Ruff line length, indent, and quotes into the Python override', async () => {
    await using sandbox = await testdir({
        'pyproject.toml':
            '[project]\nname = "app"\n\n[tool.ruff]\nline-length = 100\nindent-width = 3\n\n[tool.ruff.format]\nquote-style = "single"\nindent-style = "tab"\n',
        'main.py': 'value = 1\n',
    });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(formats[0]).toHaveProperty('override', [
        {
            paths: ['**/*.py'],
            indent_style: 'tab',
            indent_width: 3,
            print_width: 100,
            quotes: 'single',
        },
    ]);
});

test('init preserves tabs, semicolons and trailing commas from Prettier', async () => {
    await using sandbox = await testdir({
        '.prettierrc.json': '{"useTabs":true,"semi":false,"trailingComma":"none"}',
        'source.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(formats[0]).toMatchObject({
        indent_style: 'tab',
        semicolons: false,
        trailing_commas: 'none',
    });
});

test('init gives code without a style config the defaults of each formatter', async () => {
    await using sandbox = await testdir({
        'main.py': 'value = 1\n',
        'App.swift': 'let value = 1\n',
        'schema.sql': 'select 1;\n',
        'source.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(parse((JSON.parse(result.stdout) as InitJson).settingsText) as TomlTable).toHaveProperty('format', {
        indent_width: 2,
        print_width: 80,
        quotes: 'double',
        override: [
            { paths: ['**/*.py'], indent_width: 4, print_width: 88 },
            { paths: ['**/*.swift'], indent_width: 4, print_width: 120 },
            { paths: ['**/*.sql', '**/*.pgsql', '**/*.psql'], indent_width: 4 },
        ],
    });
});

test('init writes the formatter defaults once, for the Python files of every scope', async () => {
    await using sandbox = await testdir(WORKSPACE_PYTHON_FILES);
    commitAll(sandbox.path);
    const options = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    const override = [{ paths: ['**/*.py'], indent_width: 4, print_width: 88 }];
    expect(options).toMatchObject([{ override }, { override }]);
});

test('init keeps the house style for a repository without code', async () => {
    await using sandbox = await testdir({ 'README.md': '# Project\n', '.gitignore': 'dist/\n' });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(parse((JSON.parse(result.stdout) as InitJson).settingsText) as TomlTable).not.toHaveProperty('format');
});
