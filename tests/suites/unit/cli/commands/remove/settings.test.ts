import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { readSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/planning/session.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { MANAGED_KEYS_NOTE } from '#tests/config/messages.ts';
import { buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import type { TomlTable } from '#cli/types/settings/settings.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { TOOLS_CHANGED_NOTE } from '#tests/config/commands/samples.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('remove deletes settings that only the removed configuration exposes and names the deleted keys', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['sql', 'bash'], {
            tables: '[tools.sqlfluff]\ndialect = "sqlite"\n[limits]\nfile_lines = 250\n',
        }),
        'query.sql': 'SELECT 1;\n',
        'source.sh': 'echo example\n',
    });
    const result = await runGspot(sandbox.path, [
        'remove',
        'sql',
        '--reason',
        'This project no longer owns database queries.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('Removed settings tools.sqlfluff.dialect.');
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect((written['tools'] as TomlTable | undefined)?.['sqlfluff']).toBeUndefined();
    expect(written['limits']).toStrictEqual({ file_lines: 250 });
});

test('remove names only removed configurations in a mixed request', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': 'echo example\n',
    });
    const result = await runGspot(sandbox.path, [
        'remove',
        'bash',
        'python',
        '--reason',
        'The scripts moved to another repository.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n', 1)[0]).toBe('Removed bash. python is not selected.');
    const settings = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(settings.configurations).toStrictEqual([]);
    expect(settings.removed_configurations).toStrictEqual(['bash']);
});

test('remove notes the package.json keys that stay after css goes, and bash adds no such note', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css', 'bash']),
        'style.css': 'a { color: red; }\n',
        'source.sh': 'echo example\n',
    });
    const reason = 'The front end moved to another repository.';
    const css = await runGspot(sandbox.path, ['remove', 'css', '--reason', reason, '--json']);
    expect(css.code, css.stdout + css.stderr).toBe(0);
    expect((JSON.parse(css.stdout) as ApplyReport).notes).toContain(MANAGED_KEYS_NOTE);
    const bash = await runGspot(sandbox.path, ['remove', 'bash', '--reason', reason, '--json']);
    expect(bash.code, bash.stdout + bash.stderr).toBe(0);
    expect((JSON.parse(bash.stdout) as ApplyReport).notes).not.toContain(MANAGED_KEYS_NOTE);
});

test('remove after add says nothing about tools once the tool lockfiles match again', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, buildToolLockfiles(session.toolConfigurations));
    const added = await runGspot(sandbox.path, ['add', 'bash', '--json']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect((JSON.parse(added.stdout) as ApplyReport).notes).toStrictEqual([TOOLS_CHANGED_NOTE]);
    const removed = await runGspot(sandbox.path, [
        'remove',
        'bash',
        '--reason',
        'The scripts moved to another repository.',
        '--json',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect((JSON.parse(removed.stdout) as ApplyReport).notes).toStrictEqual([]);
});
