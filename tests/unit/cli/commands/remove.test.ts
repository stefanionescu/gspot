import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { readTree } from '#tests/setup/files.ts';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { selectForScope } from '#cli/settings/scope-view.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';

import {
    PARENT_REQUIREMENT_SETTINGS,
    PARENT_CONFIGURATION_SETTINGS,
    INHERITED_CONFIGURATION_SETTINGS,
} from '#tests/data/commands/configurations.ts';

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
            'Cannot remove `javascript`: typescript requires javascript. Remove `typescript` first, or keep `javascript`.',
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
        'gspot.toml': buildSandboxSettings(['bash', 'python'], { tables: '[rules]\nenabled = false\n' }),
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
