import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { HOOKS_PATH_CASES, HOOK_NAMED_SOURCE } from '#tests/config/commands/setup.ts';

test.each([...HOOKS_PATH_CASES])(
    'the init plan tells hook scripts in the source apart from the hooks folder Git uses ($hooksPath)',
    async ({ hooksPath, named, unnamed }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        await using sandbox = await createGitSandbox({
            'hooks/use-thing.ts': HOOK_NAMED_SOURCE,
            ...(hooksPath !== '' && { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });

        if (hooksPath !== '') runGitStep(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        const result = await runGspot(sandbox.path, ['init', '--configurations', 'bash,javascript,spelling,markdown']);
        expect(result.code).toBe(0);
        const lines = result.stdout.split('\n').filter((printed) => printed.startsWith('existing hooks '));
        expect(lines).toHaveLength(1);
        for (const text of named) expect(lines[0]).toContain(text);
        for (const text of unnamed) expect(lines[0]).not.toContain(text);
        expect(await readFile(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toBe(HOOK_NAMED_SOURCE);
    },
);

test('init lists at most five unchecked paths of an unsupported extension', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true}\n',
        infra: Object.fromEntries(
            Array.from({ length: 6 }, (_, index) => [`plan-${String(index)}.tf`, 'terraform {}\n']),
        ),
        'README.md': '# Project\n',
    });
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const rows = result.stdout.split('\n').filter((line) => line.startsWith('not checked'));
    expect(rows).toHaveLength(5);
    for (const [index, row] of rows.entries())
        expect(row).toContain(`infra/plan-${String(index)}.tf (no configuration reads .tf files)`);
    expect(result.stdout).not.toContain('not checked          README.md');
});
