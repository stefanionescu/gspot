import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import type { TomlTable } from '#cli/types/settings.ts';
import { planSandboxInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('init leaves out an override that matches no tracked file', async () => {
    await using sandbox = await testdir({
        '.editorconfig': '[*]\nindent_size = 2\n[*.py]\nindent_size = 4\n[Makefile]\nindent_style = tab\n',
        'source.js': 'export const value = 1;\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(settings['format']).not.toHaveProperty('override');
});

test('init leaves out an EditorConfig indent style of unset', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*]\nindent_style = space\n[vendor/**]\nindent_style = unset\nindent_size = 3\n',
        'vendor/a.js': 'export const a = 1;\n',
    });
    const { settings } = await planSandboxInit(sandbox.path);
    expect((settings['format'] as TomlTable)['override']).toStrictEqual([{ paths: ['vendor/**'], indent_width: 3 }]);
});

test('init reads the EditorConfig quote type, as Prettier does', async () => {
    await using sandbox = await createGitSandbox({
        '.editorconfig': '[*]\nquote_type = single\n',
        'source.js': 'export const value = 1;\n',
    });
    const { plan, settings } = await planSandboxInit(sandbox.path);
    expect((settings['format'] as TomlTable)['quotes']).toBe('single');
    expect(plan.carryover.find(({ path }) => path === '.editorconfig')?.carried).toContain('quote_type');
});
