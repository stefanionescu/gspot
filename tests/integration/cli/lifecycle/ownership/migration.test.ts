import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';

const backup = '.gspot/recovery/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.original';
const identity = (text: string, mode: number) => ({ hash: createHash('sha256').update(text).digest('hex'), mode });

test.each(['', '.gspot/'])('legacy %s ownership restores original bytes and modes after conversion', async (prefix) => {
    await using directory = await testdir();
    const original = 'authored hook\n';
    const installed = 'installed hook\n';
    const path = `${prefix}hooks/pre-commit`;
    await createFileTree(directory.path, {
        [path]: installed,
        [`${prefix}${backup}`]: original,
        [`${prefix}.gspot/ownership.json`]: JSON.stringify({
            version: 1,
            files: [
                {
                    path: 'hooks/pre-commit',
                    kind: 'hook',
                    installed: identity(installed, 0o644),
                    original: { ...identity(original, 0o750), backup },
                },
            ],
        }),
    });
    expect(readOwnership(directory.path).files[0]?.path).toBe(path);
    const owner = openLifecycleOwner(directory.path);
    expect(owner.restore(path)).toBe('changed');
    owner.close();
    expect(readFileSync(join(directory.path, path), 'utf8')).toBe(original);
    expect(statSync(join(directory.path, path)).mode & 0o777).toBe(0o750);
    expect(existsSync(join(directory.path, `${prefix}.gspot/ownership.json`))).toBe(false);
    expect(readFileSync(join(directory.path, backup.replace('.gspot/recovery', '.gspot/state/recovery')), 'utf8')).toBe(
        original,
    );
    if (prefix !== '') expect(existsSync(join(directory.path, '.gspot/.gspot'))).toBe(false);
});

test('legacy interrupted replacement recovers a missing file and refuses a later edit', async () => {
    await using directory = await testdir();
    const before = identity('original\n', 0o640);
    const after = identity('generated\n', 0o444);
    await createFileTree(directory.path, {
        [backup]: 'original\n',
        '.gspot/ownership.json': JSON.stringify({
            version: 1,
            files: [],
            pending: [
                {
                    path: 'config.txt',
                    before,
                    beforeBackup: { ...before, backup },
                    after,
                    entry: { path: 'config.txt', kind: 'config', installed: after, original: { ...before, backup } },
                },
            ],
        }),
    });
    const owner = openLifecycleOwner(directory.path);
    expect(owner.read('config.txt')).toEqual({ bytes: Buffer.from('original\n'), mode: 0o640 });
    owner.close();
    expect(readOwnership(directory.path).pending).toBeUndefined();
    await createFileTree(directory.path, {
        'config.txt': 'later edit\n',
        '.gspot/state/ownership.json': JSON.stringify({
            version: 1,
            files: [
                {
                    path: 'config.txt',
                    kind: 'config',
                    installed: after,
                    original: { ...before, backup: backup.replace('.gspot/recovery', '.gspot/state/recovery') },
                },
            ],
        }),
    });
    const reopened = openLifecycleOwner(directory.path);
    expect(reopened.restore('config.txt')).toBe('preserved');
    reopened.close();
    expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('later edit\n');
});

test.each(['.automation/hooks', '.gspot/hooks', '.git/hooks', 'external', 'project/.automation/hooks'])(
    'hook destination %s converts its legacy journal under the shared writer boundary',
    async (destination) => {
        const { runBlocking } = await import('#cli/platform/spawn.ts');
        const { hookLocation } = await import('#cli/lifecycle/hooks.ts');
        await using repository = await testdir();
        await using external = await testdir();
        expect(runBlocking(['git', 'init'], { cwd: repository.path }).code).toBe(0);
        const hooks = destination === 'external' ? join(external.path, 'hooks') : destination;
        expect(runBlocking(['git', 'config', 'core.hooksPath', hooks], { cwd: repository.path }).code).toBe(0);
        const parent =
            destination === 'external'
                ? external.path
                : join(repository.path, destination.slice(0, destination.lastIndexOf('/')));
        const installed = 'managed hook\n';
        const original = 'authored hook\n';
        await createFileTree(parent, {
            'hooks/pre-commit': installed,
            [backup]: original,
            '.gspot/ownership.json': JSON.stringify({
                version: 1,
                files: [
                    {
                        path: 'hooks/pre-commit',
                        kind: 'hook',
                        installed: identity(installed, 0o644),
                        original: { ...identity(original, 0o750), backup },
                    },
                ],
            }),
        });
        const location = hookLocation(destination.startsWith('project/') ? join(repository.path, 'project') : repository.path);
        const owner = openLifecycleOwner(location.root, location.stateDirectory);
        const path = `${location.directory}/pre-commit`;
        expect(() => openLifecycleOwner(location.root, location.stateDirectory)).toThrow();
        expect(owner.restore(path)).toBe('changed');
        owner.close();
        expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
        expect(statSync(join(location.absolute, 'pre-commit')).mode & 0o777).toBe(0o750);
        expect(existsSync(join(parent, '.gspot/ownership.json'))).toBe(false);
        expect(existsSync(join(location.root, location.stateDirectory, 'ownership.json'))).toBe(true);
    },
);
