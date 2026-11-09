import { expect, test } from 'bun:test';

import type { TomlTable } from '#cli/types/settings.ts';
import { runInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('init names the Prettier options that no setting holds', async () => {
    await using sandbox = await createGitSandbox({
        '.prettierrc.json': '{"semi":false,"quoteProps":"consistent"}',
        'source.ts': 'export {};\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find(({ path }) => path === '.prettierrc.json')).toMatchObject({
        carried: ['semi'],
        dropped: ['quoteProps'],
    });
});

test('init keeps the format overrides of a scope', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"workspaces":["app"]}',
        'app/package.json': '{"private":true}',
        'app/.editorconfig': '[*.md]\nindent_size = 4\n',
        'app/README.md': '# Example\n',
        'source.js': 'export const value = 1;\n',
    });
    const { settings } = await runInit(sandbox.path);
    expect(settings['scope']).toMatchObject([
        { path: 'app', format: { override: [{ paths: ['**/*.md'], indent_width: 4 }] } },
    ]);
});

test('init leaves out an EditorConfig indent style of unset', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*]\nindent_style = space\n[vendor/**]\nindent_style = unset\nindent_size = 3\n',
        'vendor/a.js': 'export const a = 1;\n',
    });
    const { settings } = await runInit(sandbox.path);
    expect((settings['format'] as TomlTable)['override']).toStrictEqual([{ paths: ['vendor/**'], indent_width: 3 }]);
});

test('init reads the EditorConfig quote type, as Prettier does', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*]\nquote_type = single\n',
        'source.js': 'export const value = 1;\n',
    });
    const { plan, settings } = await runInit(sandbox.path);
    expect((settings['format'] as TomlTable)['quotes']).toBe('single');
    expect(plan.carryover.find(({ path }) => path === '.editorconfig')?.carried).toContain('quote_type');
});

test('init names an EditorConfig line width of off, which gspot.toml cannot hold', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*]\nmax_line_length = 100\n[*.md]\nmax_line_length = off\n',
        'README.md': '# Example\n',
        'source.js': 'export const value = 1;\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find(({ path }) => path === '.editorconfig')?.dropped).toStrictEqual(['max_line_length']);
});

test('init names an EditorConfig line setting that differs from what gspot writes', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*]\nend_of_line = lf\n[*.bat]\nend_of_line = crlf\n',
        'run.bat': 'echo done\n',
        'README.md': '# Example\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find(({ path }) => path === '.editorconfig')?.dropped).toStrictEqual(['end_of_line']);
});

test('init keeps the EditorConfig overrides beside the overrides of a Prettier config', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*.md]\nmax_line_length = 100\n',
        '.prettierrc': '{"overrides":[{"files":"*.md","options":{"proseWrap":"always"}}]}\n',
        'README.md': '# Example\n',
        'source.js': 'export const value = 1;\n',
    });
    const { settings } = await runInit(sandbox.path);
    expect((settings['format'] as TomlTable)['override']).toStrictEqual([
        { paths: ['**/*.md'], print_width: 100 },
        { paths: ['**/*.md'], prose_wrap: 'always' },
    ]);
});

test('init names the excludeFiles of a Prettier override', async () => {
    await using sandbox = await createGitSandbox({
        '.prettierrc': '{"overrides":[{"files":"*.js","excludeFiles":"vendor/**","options":{"semi":false}}]}\n',
        'source.js': 'export const value = 1;\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find(({ path }) => path === '.prettierrc')?.dropped).toStrictEqual(['excludeFiles']);
});
