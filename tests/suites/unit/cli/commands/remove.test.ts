import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import type { ApplyReport } from '#cli/types/apply.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { listToolInstallFiles } from '#tests/setup/cli/tools.ts';
import { recordNpmCommands } from '#tests/setup/system/fakes.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/apply/generated.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { commitAll, createGitSandbox } from '#tests/setup/system/git.ts';
import { readSandboxSettings, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { API_SCOPE_FILES, TOOLS_CHANGED_NOTE, BASH_CONFIG_FILE_NAMES } from '#tests/config/commands/samples.ts';

import {
    SCOPE_REMOVALS,
    PARENT_REQUIREMENT_SETTINGS,
    EXCLUDED_CONFIGURATION_SETTINGS,
} from '#tests/config/commands/remove.ts';

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

test.each([...SCOPE_REMOVALS])('remove bash --scope $scope: $name', async ({ settings, files, scope, expected }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings, ...files });
    const result = await runGspot(sandbox.path, [
        'remove',
        'bash',
        '--scope',
        scope,
        '--reason',
        'The API uses another language.',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    expect(readSandboxSettings(sandbox.path)).toMatchObject(expected);
});

test('remove refuses a dependency required by a parent configuration and leaves all files unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': PARENT_REQUIREMENT_SETTINGS,
        'api/entry.ts': 'export const VALUE = 1;\n',
        'api/child/entry.sh': 'echo child\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'remove',
        'javascript',
        '--scope',
        'api/child',
        '--reason',
        'The API uses another language.',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message:
            'Cannot remove javascript: typescript requires javascript. Remove typescript first, or keep javascript.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove without --reason exits 2 and writes nothing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash'], { rules: true }) });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message: "Required option '--reason <text>' not specified",
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove writes the reason beside the removed names, and add takes a name out and keeps the reason', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash', 'python']),
    });
    const reason = 'The project uses another language.';
    const removed = await runGspot(sandbox.path, ['remove', 'bash', 'python', '--reason', reason]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const contents: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(contents).toHaveProperty('removed_configurations', {
        value: ['bash', 'python'],
        reason,
    });
    const added = await runGspot(sandbox.path, ['add', 'bash']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const removedSettings: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(removedSettings).toHaveProperty('removed_configurations', {
        value: ['python'],
        reason,
    });
    const restored = await runGspot(sandbox.path, ['add', 'python']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    const restoredSettings: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(restoredSettings).not.toHaveProperty('removed_configurations');
});

test('remove --scope writes removed_configurations with its reason and applies it without an npm install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'api', configurations: ['bash'] }] }),
        ...API_SCOPE_FILES,
    });
    commitAll(sandbox.path);
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, findManifestTarget('bash', 'shellcheckrc')))).toBe(true);
    using npm = recordNpmCommands();
    const reason = 'The API scope no longer uses Bash.';
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--scope', 'api', '--reason', reason, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { written, removed, notes } = JSON.parse(result.stdout) as ApplyReport;
    expect({ written, removed, notes }).toStrictEqual({
        written: [GSPOT_PATHS.miseProject],
        removed: BASH_CONFIG_FILE_NAMES.map((file) => findManifestTarget('bash', file)),
        notes: [TOOLS_CHANGED_NOTE],
    });
    expect(npm.commands).toStrictEqual([]);
    const saved = readSandboxSettings(sandbox.path);
    expect(saved.scopes['api']!.configurations).toStrictEqual([]);
    expect(saved.configurations).toStrictEqual(['markdown']);
    const contents = (parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['scope'];
    expect(contents).toStrictEqual([
        { path: 'api', configurations: [], removed_configurations: { value: ['bash'], reason } },
    ]);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, findManifestTarget('bash', 'shellcheckrc')))).toBe(false);
    expect(await listToolInstallFiles(sandbox.path)).toStrictEqual([]);
});

test('remove reports no change for a configuration the root does not list', async () => {
    const settings = buildSandboxSettings(['typescript'], { scopes: [{ path: 'api', configurations: ['bash'] }] });
    await using sandbox = await testdir({ 'gspot.toml': settings, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const message = 'No change: bash is not selected.';
    const commandArguments = ['remove', 'bash', '--reason', 'The project no longer uses Bash.'];
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toBe(`${message}\n`);
    expect(result.stderr).toBe('');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...commandArguments, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ changed: false });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove checks requirements against the scope selection', async () => {
    await using sandbox = await testdir({
        'gspot.toml': EXCLUDED_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'remove',
        'javascript',
        '--scope',
        'api',
        '--reason',
        'The API scope does not use JavaScript.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toBe('No change: javascript is not selected.\n');
    expect(result.stderr).toBe('');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove names only removed configurations in a mixed request', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, [
        'remove',
        'bash',
        'python',
        '--reason',
        'The scripts moved to another repository.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n', 1)[0]).toBe('Removed bash. python was not selected.');
    const settings = readSandboxSettings(sandbox.path);
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
