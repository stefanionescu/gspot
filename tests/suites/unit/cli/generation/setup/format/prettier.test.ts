import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { PRETTIER_SCRIPT_NOTE } from '#cli/config/generation/setup.ts';
import { openSession } from '#cli/engine/session.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { getTable } from '#cli/settings/tables.ts';
import type { FormatSettings } from '#cli/types/configurations/general.ts';
import { planSandboxInit } from '#tests/setup/cli/commands.ts';
import { captureTerminal } from '#tests/setup/system/terminal.ts';

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

async function planScopeFormats(root: string): Promise<Array<{ path: string; format: FormatSettings }>> {
    const { settingsText } = await planSandboxInit(root, ['--configurations', 'format']);
    const session = await openSession(root, { settings: parseSettings(settingsText, root) });
    return session.scopes.map(({ path, settings }) => ({ path, format: getTable(settings, 'format') }));
}

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    await using sandbox = await testdir({ 'source.txt': 'source\n', ...files });
    const formats = await planScopeFormats(sandbox.path);
    expect(formats[0]?.format).toMatchObject(expected);
});

test('init reads the format settings of each scope', async () => {
    await using sandbox = await testdir(SCOPE_FORMAT_FILES);
    await createFileTree(sandbox.path, FORMAT_WORKSPACE_FILES);
    const formats = await planScopeFormats(sandbox.path);
    expect(
        formats.map(({ path, format: { indent_width, print_width, quotes } }) => [
            path,
            indent_width,
            print_width,
            quotes,
        ]),
    ).toStrictEqual([
        ['', 2, 90, 'double'],
        ['app', 6, 100, 'single'],
        ['app/deep', 6, 100, 'single'],
        ['sibling', 2, 90, 'double'],
    ]);
});

test.each([...UNREADABLE_PRETTIER_FILES])(
    'init names the format settings it cannot read from $path',
    async ({ path, text }) => {
        await using sandbox = await testdir({
            [path]: text,
            'source.js': 'export const count = 1;\n',
        });
        const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
        expect([...plan.deleted, ...plan.write].find((file) => file.path === path)?.note).toContain(
            PRETTIER_SCRIPT_NOTE,
        );
    },
);

test.each([
    { path: 'prettier.config.mjs', text: 'export default { printWidth: 100, semi: false };\n' },
    { path: '.prettierrc.cjs', text: 'module.exports = { printWidth: 100, semi: false };\n' },
])('init reads the JavaScript Prettier config $path', async ({ path, text }) => {
    await using sandbox = await testdir({ [path]: text, 'source.js': 'export const count = 1;\n' });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings['format']).toMatchObject({ print_width: 100, semicolons: false });
});

test('init reads a Prettier config that prints without echoing its output', async () => {
    await using sandbox = await testdir({
        'prettier.config.mjs': "process.stdout.write('formatter std');\nexport default { semi: false };\n",
        'source.js': 'export const count = 1;\n',
    });
    using output = captureTerminal();
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings['format']).toMatchObject({ semicolons: false });
    expect(output.stdout.join('') + output.stderr.join('')).not.toContain('formatter std');
});

test('init runs no Prettier config outside the root and the scopes', async () => {
    await using sandbox = await testdir({
        'tests/samples/prettier.config.mjs':
            "import { writeFileSync } from 'node:fs';\nwriteFileSync(new URL('ran', import.meta.url), '');\nexport default {};\n",
        'source.js': 'export const count = 1;\n',
    });
    await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(existsSync(join(sandbox.path, 'tests/samples/ran'))).toBe(false);
});

test('init carries the tab, semicolon, comma, bracket, arrow, and prose options of Prettier', async () => {
    await using sandbox = await testdir({
        '.prettierrc.json': JSON.stringify({
            useTabs: true,
            semi: false,
            trailingComma: 'none',
            bracketSpacing: false,
            arrowParens: 'avoid',
            proseWrap: 'always',
        }),
        'source.ts': 'export {};\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings['format']).toMatchObject({
        indent_style: 'tab',
        semicolons: false,
        trailing_commas: 'none',
        bracket_spacing: false,
        arrow_parens: 'avoid',
        prose_wrap: 'always',
    });
});
