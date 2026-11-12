import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { PRETTIER_SCRIPT_NOTE } from '#cli/config/generation/setup.ts';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { getTable } from '#cli/settings/scopes.ts';
import * as installers from '#cli/tools/installers/install.ts';
import type { FormatSettings } from '#cli/types/configurations/language.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { initOutputSchema } from '#tests/schemas/setup.ts';
import { planSandboxInit, runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

const FORMAT_FILE_CASES = [
    {
        name: 'partial Prettier JSON configuration',
        files: { '.prettierrc.json': '{"tabWidth":3}' },
        expected: { indent_width: 3, print_width: 80, quotes: 'double' },
    },
    {
        name: 'Prettier .prettierrc configuration',
        files: { '.prettierrc': 'printWidth: 100\ntabWidth: 4\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier .prettierrc.json5 configuration',
        files: { '.prettierrc.json5': '{ printWidth: 100, tabWidth: 4, }\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier ignore file beside EditorConfig',
        files: { '.prettierignore': 'dist/\n', '.editorconfig': '[*]\nindent_size = 4\nmax_line_length = 100\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier .prettierrc.toml configuration',
        files: { '.prettierrc.toml': 'printWidth = 100\ntabWidth = 4\n' },
        expected: { indent_width: 4, print_width: 100 },
    },
    {
        name: 'Prettier package configuration',
        files: { 'package.json': '{"prettier":{"tabWidth":6,"printWidth":100,"singleQuote":true}}' },
        expected: { indent_width: 6, print_width: 100, quotes: 'single' },
    },
    {
        name: 'EditorConfig project settings and section overrides',
        files: { '.editorconfig': '[*]\nindent_size = 4\n[*.json]\nindent_size = 2\n', 'data.json': '{}\n' },
        expected: { indent_width: 4, override: [{ paths: ['**/*.json'], indent_width: 2 }] },
    },
    {
        name: 'EditorConfig before declared Prettier defaults',
        files: {
            'package.json': '{"devDependencies":{"prettier":"3.8.1"}}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 6, print_width: 96, quotes: 'double' },
    },
] as const;

const SCOPE_FORMAT_FILES = {
    '.prettierrc.json': '{"tabWidth":2,"printWidth":90,"singleQuote":false}',
    'app/.prettierrc.json': '{"tabWidth":6,"printWidth":100,"singleQuote":true}',
    'app/source.js': 'export const app = 1;\n',
    'app/deep/source.js': 'export const deep = 1;\n',
    'sibling/source.js': 'export const sibling = 1;\n',
} as const;

const PRETTIER_FORMAT_OPTIONS = {
    quotes: 'double',
    override: [
        { paths: ['**/*.ts', 'src/**/*.css'], indent_width: 2, print_width: 100 },
        { paths: ['**/*.py'], print_width: 88, quotes: 'single' },
    ],
} as const;

const FORMAT_WORKSPACE_FILES = {
    'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
    'app/package.json': '{"private":true}',
    'app/deep/package.json': '{"private":true}',
    'sibling/package.json': '{"private":true}',
} as const;

const UNREADABLE_PRETTIER_FILES = [
    { path: 'prettier.config.mjs', text: "import missing from './missing.mjs';\nexport default missing;\n" },
    { path: '.prettierrc.json5', text: '// formatting\n{ tabWidth: 4, }\n' },
] as const;

async function readInitFormatOptions(root: string, commandArguments: string[]): Promise<FormatSettings[]> {
    const result = await runGspot(root, [...commandArguments, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = initOutputSchema.parse(JSON.parse(result.stdout)).settingsText;
    const session = await openSession(root, { settings: readSettings(text, root) });
    return session.scopes.map(({ settings }) => getTable(settings, 'format'));
}

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({ 'source.txt': 'source\n', ...files });
    commitAll(sandbox.path);
    const options = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(options[0]).toMatchObject(expected);
});

test('init reads the format settings of each scope', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir(SCOPE_FORMAT_FILES);
    await createFileTree(sandbox.path, FORMAT_WORKSPACE_FILES);
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = initOutputSchema.parse(JSON.parse(result.stdout)).settingsText;
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({
        '.editorconfig': '[*]\nindent_size = 2\n[*.py]\nindent_size = 4\n[Makefile]\nindent_style = tab\n',
        'source.js': 'export const value = 1;\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect((parse(settingsText) as TomlTable)['format']).not.toHaveProperty('override');
});

test.each([...UNREADABLE_PRETTIER_FILES])(
    'init names the format settings it cannot read from $path',
    async ({ path, text }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        await using sandbox = await testdir({
            [path]: text,
            'source.js': 'export const count = 1;\n',
        });
        commitAll(sandbox.path);
        const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
        expect([...plan.deleted, ...plan.write].find((file) => file.path === path)?.note).toContain(
            PRETTIER_SCRIPT_NOTE,
        );
    },
);

test.each([
    { path: 'prettier.config.mjs', text: 'export default { printWidth: 100, semi: false };\n' },
    { path: '.prettierrc.cjs', text: 'module.exports = { printWidth: 100, semi: false };\n' },
])('init reads the JavaScript Prettier config $path', async ({ path, text }) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({ [path]: text, 'source.js': 'export const count = 1;\n' });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(formats[0]).toMatchObject({ print_width: 100, semicolons: false });
});

test('init runs no Prettier config outside the root and the scopes', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({
        '.prettierrc.json': '{"bracketSpacing":false,"arrowParens":"avoid","proseWrap":"always"}',
        'source.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(formats[0]).toMatchObject({ bracket_spacing: false, arrow_parens: 'avoid', prose_wrap: 'always' });
});

test('init carries the Ruff line length, indent, and quotes into the Python override', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({
        'main.py': 'value = 1\n',
        'App.swift': 'let value = 1\n',
        'schema.sql': 'select 1;\n',
        'source.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, ['init', '--configurations', 'format']);
    expect(formats[0]).toHaveProperty('override', [
        { paths: ['**/*.py'], indent_width: 4, print_width: 88 },
        { paths: ['**/*.swift'], indent_width: 4, print_width: 120 },
        { paths: ['**/*.sql'], indent_width: 4 },
    ]);
});

test('init names only the script extension that the repository tracks, because gspot/unmatched-paths reports the other', async () => {
    await using sandbox = await createGitSandbox({
        'run.sh': 'main() {\n    echo ready\n}\n',
        'source.ts': 'export {};\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings).toHaveProperty('format.override', [{ paths: ['**/*.sh'], indent_width: 4 }]);
});

test.each([
    { indent: ' '.repeat(4), written: { indent_width: 4 } },
    { indent: '\t', written: { indent_style: 'tab' } },
])('init records the indent of the scripts when it differs: $written', async ({ indent, written }) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({
        'run.sh': `main() {\n${indent}if true; then\n${indent}${indent}echo ready\n${indent}fi\n}\n`,
        'tools/build.bash': `for name in a b; do\n${indent}echo "$name"\ndone\n`,
        hook: '#!/bin/sh\nif true; then\n  echo ready\nfi\n',
        'source.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(parse(settingsText) as TomlTable).toHaveProperty('format.override', [
        { paths: ['**/*.sh', '**/*.bash'], ...written },
    ]);
});

test('init keeps the house style for a repository without code', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({ 'README.md': '# Project\n', '.gitignore': 'dist/\n' });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(parse(settingsText) as TomlTable).not.toHaveProperty('format');
});
