import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';

import {
    PARENT_REQUIREMENT_SETTINGS,
    PARENT_CONFIGURATION_SETTINGS,
    INHERITED_CONFIGURATION_SETTINGS,
} from '#tests/data/commands/configurations.ts';

test('remove bash --scope api writes removed_configurations to the scope when the scope inherits bash', async () => {
    await using sandbox = await testdir({
        'gspot.toml': INHERITED_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
    });
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    const reads = createReadCache(sandbox.path);
    const { settings } = readSettings(sandbox.path, reads);
    expect(settings.configurations).toStrictEqual(['markdown', 'bash']);
    expect(settings.scopes['api']?.configurations).toStrictEqual([]);
    expect(settings.scopes['api']?.removed_configurations).toStrictEqual(['bash']);
    const manifests = readManifests(reads);
    expect(selectForScope(settings, '', manifests).map((manifest) => manifest.configuration.name)).toContain('bash');
    expect(selectForScope(settings, 'api', manifests).map((manifest) => manifest.configuration.name)).not.toContain(
        'bash',
    );
});

test('remove in a child drops a parent configuration and preserves its own other configuration and ancestors', async () => {
    await using sandbox = await testdir({
        'gspot.toml': PARENT_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'api/child/entry.py': 'value = 1\n',
    });
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--scope', 'api/child', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    const reads = createReadCache(sandbox.path);
    const { settings } = readSettings(sandbox.path, reads);
    expect(settings.configurations).toStrictEqual(['markdown']);
    expect(settings.scopes['api']?.configurations).toStrictEqual(['bash']);
    expect(settings.scopes['api']?.removed_configurations).toStrictEqual([]);
    expect(settings.scopes['api/child']?.configurations).toStrictEqual(['python']);
    expect(settings.scopes['api/child']?.removed_configurations).toStrictEqual(['bash']);
    const manifests = readManifests(reads);
    expect(selectForScope(settings, 'api', manifests).map((manifest) => manifest.configuration.name)).toContain('bash');
    const selected = selectForScope(settings, 'api/child', manifests).map((manifest) => manifest.configuration.name);
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
    const result = await runGspot(sandbox.path, ['remove', 'javascript', '--scope', 'api/child', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message:
            'Cannot remove `javascript`: typescript requires javascript. Remove `typescript` first, or keep `javascript`.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
