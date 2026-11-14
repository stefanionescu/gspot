import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { getTable } from '#cli/settings/tables.ts';
import { openSession } from '#cli/engine/session.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { planSandboxInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const PRETTIER_FORMAT_OPTIONS = {
    quotes: 'double',
    override: [{ paths: ['**/*.ts', 'src/**/*.css'], indent_width: 2, print_width: 100 }],
} as const;

test('init keeps the format overrides of a scope', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"workspaces":["app"]}',
        'app/package.json': '{"private":true}',
        'app/.editorconfig': '[*.md]\nindent_size = 4\n',
        'app/README.md': '# Example\n',
        'source.js': 'export const value = 1;\n',
    });
    const { settings } = await planSandboxInit(sandbox.path);
    expect(settings['scope']).toMatchObject([
        { path: 'app', format: { override: [{ paths: ['**/*.md'], indent_width: 4 }] } },
    ]);
});

test('init turns Prettier overrides into format overrides', async () => {
    await using sandbox = await testdir({
        '.prettierrc.json': JSON.stringify({
            tabWidth: 4,
            printWidth: 120,
            overrides: [{ files: ['*.ts', 'src/**/*.css'], options: { tabWidth: 2, printWidth: 100 } }],
        }),
        'package.json': '{"private":true,"devDependencies":{"prettier":"3.8.1"}}',
        'source.ts': 'export {};\n',
        'src/style.css': 'a {}\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings['format']).toMatchObject(PRETTIER_FORMAT_OPTIONS);
});

test('init keeps the EditorConfig overrides beside the overrides of a Prettier config', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*.md]\nmax_line_length = 100\n',
        '.prettierrc': '{"overrides":[{"files":"*.md","options":{"proseWrap":"always"}}]}\n',
        'README.md': '# Example\n',
        'source.js': 'export const value = 1;\n',
    });
    const { settings } = await planSandboxInit(sandbox.path);
    expect((settings['format'] as TomlTable)['override']).toStrictEqual([
        { paths: ['**/*.md'], print_width: 100 },
        { paths: ['**/*.md'], prose_wrap: 'always' },
    ]);
});

test('init carries the Ruff line length, indent, and quotes into the Python override', async () => {
    await using sandbox = await testdir({
        'pyproject.toml':
            '[project]\nname = "app"\n\n[tool.ruff]\nline-length = 100\nindent-width = 3\n\n[tool.ruff.format]\nquote-style = "single"\nindent-style = "tab"\n',
        'main.py': 'value = 1\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings).toHaveProperty('format.override', [
        {
            paths: ['**/*.py'],
            indent_style: 'tab',
            indent_width: 3,
            print_width: 100,
            quotes: 'single',
        },
    ]);
});

test('init gives the code of each formatter without a style config its own override', async () => {
    await using sandbox = await testdir({
        'main.py': 'value = 1\n',
        'App.swift': 'let value = 1\n',
        'schema.sql': 'select 1;\n',
        'source.ts': 'export {};\n',
    });
    const { settingsText } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    const session = await openSession(sandbox.path, { settings: parseSettings(settingsText, sandbox.path) });
    const { override } = getTable(session.scopes[0]!.settings, 'format');
    expect(override.map(({ paths }) => paths)).toStrictEqual([['**/*.py'], ['**/*.swift'], ['**/*.sql']]);
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
    await using sandbox = await testdir({
        'run.sh': `main() {\n${indent}if true; then\n${indent}${indent}echo ready\n${indent}fi\n}\n`,
        'tools/build.bash': `for name in a b; do\n${indent}echo "$name"\ndone\n`,
        hook: '#!/bin/sh\nif true; then\n  echo ready\nfi\n',
        'source.ts': 'export {};\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings).toHaveProperty('format.override', [{ paths: ['**/*.sh', '**/*.bash'], ...written }]);
});

test('init keeps the house style for a repository without code', async () => {
    await using sandbox = await testdir({ 'README.md': '# Project\n', '.gitignore': 'dist/\n' });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings).not.toHaveProperty('format');
});
