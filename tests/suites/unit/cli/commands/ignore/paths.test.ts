import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse, stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import type { TomlTable } from '#cli/types/settings.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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

test('ignore refuses check IDs and unmatched --paths values before writing', async () => {
    const settings = buildSandboxSettings([], {
        tables: stringify({
            command_check: [{ id: 'project/sample', command: ['true'], stage: 'commit', paths: ['source.txt'] }],
        }),
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'source.txt': 'Input.\n',
        'bash/shellcheck': 'A file that shares a check name.\n',
    });
    for (const path of ['bash/shellcheck', 'missing/**']) {
        const result = await runGspot(sandbox.path, [
            'ignore',
            '--paths',
            path,
            '--reason',
            'Generated samples stay outside lint checks.',
            '--json',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({
            error: 'arguments',
            message: expect.stringContaining(path) as string,
        });
    }
});
