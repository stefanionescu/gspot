import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { GSPOT_PACKAGES } from '#cli/config/generation/file-edits.ts';

test('npm reads both gspot packages from the release hold excludes that apply writes', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildSettingsText(['dependencies']),
        'package.json': '{"private":true}\n',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}\n',
    });
    commitAll(repository.path);
    const applied = await spawnGspot(repository.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const excludes = await runCommand(['npm', 'config', 'get', 'min-release-age-exclude'], { cwd: repository.path });
    expect(excludes.stdout.trim().split(',')).toStrictEqual([...GSPOT_PACKAGES]);
});
