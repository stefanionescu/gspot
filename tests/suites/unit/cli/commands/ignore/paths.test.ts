import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import type { TomlTable } from '#cli/types/settings.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

test('repeated --paths keeps commas literal and leaves the following check positional from a subfolder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'input,one.txt': 'Root input.\n',
        'app/input,one.txt': 'First input.\n',
        'app/second.txt': 'Second input.\n',
    });
    const cwd = join(sandbox.path, 'app');
    const ignored = await runGspot(cwd, [
        'ignore',
        '--paths',
        'input,one.txt',
        'structure/lone-files',
        '--paths',
        'second.txt',
        '--reason',
        'These samples deliberately contain one file each.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const settingsPath = join(sandbox.path, 'gspot.toml');
    const saved = parse(await readFile(settingsPath, 'utf8')) as TomlTable;
    expect(saved['ignore']).toMatchObject([
        { check: 'structure/lone-files', paths: ['app/input,one.txt', 'app/second.txt'] },
    ]);
});

test.each([
    {
        path: 'bash/shellcheck',
        message: '--paths bash/shellcheck names a check. Give the check as a positional argument.',
    },
    {
        path: 'missing/**',
        message: "--paths 'missing/**' matches no repository file. Name an existing file, folder, or matching glob.",
    },
    {
        path: 'source.txt/[draft]',
        message:
            "--paths 'source.txt/[draft]' matches no repository file. Name an existing file, folder, or matching glob.",
    },
])('ignore refuses --paths $path and writes nothing', async ({ path, message }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [{ id: 'project/sample', command: ['true'], stage: 'commit', paths: ['source.txt'] }],
            }),
        }),
        'source.txt': 'Input.\n',
        'bash/shellcheck': 'A file that shares a check name.\n',
    });
    const failure = await assertRefusalWithoutWrites(
        sandbox.path,
        ['ignore', '--paths', path, '--reason', 'Generated samples stay outside lint checks.'],
        'arguments',
    );
    expect(failure.message).toBe(message);
});
