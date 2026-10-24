import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { readSettings } from '#cli/settings/read.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { listToolInstallFiles } from '#tests/setup/cli/tools.ts';
import { recordNpmCommands } from '#tests/setup/system/fakes.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';

import {
    PARENT_REQUIREMENT_SETTINGS,
    PARENT_CONFIGURATION_SETTINGS,
    EXCLUDED_CONFIGURATION_SETTINGS,
} from '#tests/config/commands/remove.ts';
import {
    API_BASH_FILES,
    TOOLS_CHANGED_NOTE,
    ALWAYS_SELECTED_RESULTS,
    UNKNOWN_CONFIGURATION_REFUSALS,
    INHERITED_CONFIGURATION_SETTINGS,
} from '#tests/config/commands/samples.ts';

test('remove deletes settings that only the removed configuration exposes and names the deleted keys', async () => {
    await using sandbox = await testdir({
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
async function removeBashSelection(root: string, scope: string) {
    const result = await runGspot(root, [
        'remove',
        'bash',
        '--scope',
        scope,
        '--reason',
        'The API uses another language.',
        '--json',
    ]);
    return { result, settings: readSettings(root).settings };
}

test('remove bash --scope api writes removed_configurations to the scope when the scope inherits bash', async () => {
    await using sandbox = await testdir({
        'gspot.toml': INHERITED_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
    });
    const { result, settings } = await removeBashSelection(sandbox.path, 'api');
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    expect(settings.configurations).toStrictEqual(['markdown', 'bash']);
    expect(settings.scopes['api']?.configurations).toStrictEqual([]);
    expect(settings.scopes['api']?.removed_configurations).toStrictEqual(['bash']);
    const configurations = readConfigurations();
    expect(selectForScope(settings, '', configurations).map((configuration) => configuration.name)).toContain('bash');
    expect(selectForScope(settings, 'api', configurations).map((configuration) => configuration.name)).not.toContain(
        'bash',
    );
});

test('remove in a child drops a parent configuration and preserves its own other configuration and ancestors', async () => {
    await using sandbox = await testdir({
        'gspot.toml': PARENT_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'api/child/entry.py': 'value = 1\n',
    });
    const { result, settings } = await removeBashSelection(sandbox.path, 'api/child');
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    expect(settings.configurations).toStrictEqual(['markdown']);
    expect(settings.scopes['api']?.configurations).toStrictEqual(['bash']);
    expect(settings.scopes['api']?.removed_configurations).toStrictEqual([]);
    expect(settings.scopes['api/child']?.configurations).toStrictEqual(['python']);
    expect(settings.scopes['api/child']?.removed_configurations).toStrictEqual(['bash']);
    const configurations = readConfigurations();
    expect(selectForScope(settings, 'api', configurations).map((configuration) => configuration.name)).toContain(
        'bash',
    );
    const selected = selectForScope(settings, 'api/child', configurations).map((configuration) => configuration.name);
    expect(selected).not.toContain('bash');
    expect(selected).toContain('python');
});

test('remove refuses a dependency required by a parent configuration and leaves all files unchanged', async () => {
    await using sandbox = await testdir({
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
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['bash'], { rules: true }) });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message: 'gspot remove needs --reason "<why>".',
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
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))).toHaveProperty('removed_configurations', {
        value: ['bash', 'python'],
        reason,
    });
    const added = await runGspot(sandbox.path, ['add', 'bash']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))).toHaveProperty('removed_configurations', {
        value: ['python'],
        reason,
    });
    const restored = await runGspot(sandbox.path, ['add', 'python']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))).not.toHaveProperty(
        'removed_configurations',
    );
});

test('remove --scope writes removed_configurations with its reason and applies it without an npm install', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'api', configurations: ['bash'] }] }),
        'README.md': '# Example\n',
        'api/entry.sh': 'echo api\n',
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
        removed: API_BASH_FILES,
        notes: [TOOLS_CHANGED_NOTE],
    });
    expect(npm.installations).toStrictEqual([]);
    const saved = readSettings(sandbox.path).settings;
    expect(saved.scopes['api']!.configurations).toStrictEqual([]);
    expect(saved.configurations).toStrictEqual(['markdown']);
    expect((parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['scope']).toStrictEqual([
        { path: 'api', removed_configurations: { value: ['bash'], reason } },
    ]);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, findManifestTarget('bash', 'shellcheckrc')))).toBe(false);
    expect(await listToolInstallFiles(sandbox.path)).toStrictEqual([]);
});

test('remove security exits 2, names gspot set level, and writes nothing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'source.py': 'PORT = 8080\n',
    });
    const before = await readTree(sandbox.path);
    expect(
        await runGspot(sandbox.path, [
            'remove',
            'security',
            '--reason',
            'The project does not use this configuration.',
        ]),
    ).toStrictEqual(ALWAYS_SELECTED_RESULTS.text);
    expect(
        await runGspot(sandbox.path, [
            'remove',
            'security',
            '--reason',
            'The project does not use this configuration.',
            '--json',
        ]),
    ).toStrictEqual(ALWAYS_SELECTED_RESULTS.json);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
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

test('remove checks requirements against the effective scope selection', async () => {
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

test('remove names every unknown configuration before changing the settings', async () => {
    const text = 'configurations = []\n';
    await using sandbox = await testdir({ 'gspot.toml': text });
    const result = await runGspot(sandbox.path, [
        'remove',
        'not-a-real-config-a',
        'not-a-real-config-b',
        '--reason',
        'Refuse unknown configurations before removing them.',
    ]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(UNKNOWN_CONFIGURATION_REFUSALS);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
});

test('remove names only removed configurations in a mixed request', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, [
        'remove',
        'bash',
        'python',
        '--reason',
        'The scripts moved to another repository.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n', 1)[0]).toBe('Removed bash. python was not selected.');
    const settings = readSettings(sandbox.path).settings;
    expect(settings.configurations).toStrictEqual([]);
    expect(settings.removed_configurations).toStrictEqual(['bash']);
});
