import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { MANAGED_KEYS_NOTE } from '#cli/config/commands/edits.ts';
import { TOOLS_CHANGED_NOTE } from '#cli/config/generation/files.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { settingsEditOutputSchema } from '#tests/schemas/setup.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('remove deletes settings that only the removed configuration exposes and names the deleted keys', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['sql', 'bash'], {
            tables: '[sql]\ndialect = "sqlite"\n[limits]\nmax_file_lines = 250\n',
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
    expect(result.stdout).toContain('sql.dialect');
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['limits']).toStrictEqual({ max_file_lines: 250 });
});

test('remove licenses deletes its table and its records and names the deleted keys', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses', 'bash'], {
            tables: '[licenses]\nallowed = ["MIT"]\n[[licenses.allowed_package]]\nname = "example"\nversion = "1.0.0"\nreason = "Reviewed by legal."\n',
        }),
        'source.sh': 'echo example\n',
    });
    const result = await runGspot(sandbox.path, [
        'remove',
        'licenses',
        '--reason',
        'The legal review moved elsewhere.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('Removed settings licenses.allowed, licenses.allowed_package.');
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['licenses']).toBeUndefined();
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
    const settings = parseSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
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
    expect(settingsEditOutputSchema.parse(JSON.parse(css.stdout)).notes).toContain(MANAGED_KEYS_NOTE);
    const bash = await runGspot(sandbox.path, ['remove', 'bash', '--reason', reason, '--json']);
    expect(bash.code, bash.stdout + bash.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(bash.stdout)).notes).not.toContain(MANAGED_KEYS_NOTE);
});

test('remove after add says nothing about tools once the tool lockfiles match again', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, buildToolLockfiles(session.toolConfigurations));
    const added = await runGspot(sandbox.path, ['add', 'bash', '--json']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(added.stdout)).notes).toStrictEqual([TOOLS_CHANGED_NOTE]);
    const removed = await runGspot(sandbox.path, [
        'remove',
        'bash',
        '--reason',
        'The scripts moved to another repository.',
        '--json',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(removed.stdout)).notes).toStrictEqual([]);
});
