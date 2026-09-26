import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';

test.each(['.automation/hooks', '.gspot/hooks', '.git/hooks', 'external', 'project/.automation/hooks'])(
    'hook destination %s restores current ownership under the shared writer boundary',
    async (destination) => {
        const { runBlocking } = await import('#cli/platform/spawn.ts');
        const { hookLocation } = await import('#cli/lifecycle/hooks/git.ts');
        await using repository = await testdir();
        await using external = await testdir();
        expect(runBlocking(['git', 'init'], { cwd: repository.path }).code).toBe(0);
        const hooks = destination === 'external' ? join(external.path, 'hooks') : destination;
        expect(runBlocking(['git', 'config', 'core.hooksPath', hooks], { cwd: repository.path }).code).toBe(0);
        const installed = 'managed hook\n';
        const original = 'authored hook\n';
        if (destination.startsWith('project/'))
            await createFileTree(repository.path, { 'project/authored.txt': 'project' });
        const location = hookLocation(
            destination.startsWith('project/') ? join(repository.path, 'project') : repository.path,
        );
        const path = `${location.directory}/pre-commit`;
        await createFileTree(location.root, { [path]: original });
        chmodSync(join(location.root, path), 0o750);
        const initial = openLifecycleOwner(location.root, location.stateDirectory);
        try {
            initial.replace(path, { bytes: Buffer.from(installed), mode: 0o644 }, 'hook', true);
        } finally {
            initial.close();
        }
        const owner = openLifecycleOwner(location.root, location.stateDirectory);
        try {
            expect(() => openLifecycleOwner(location.root, location.stateDirectory)).toThrow();
            expect(owner.restore(path)).toBe('changed');
        } finally {
            owner.close();
        }
        expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
        expect(statSync(join(location.absolute, 'pre-commit')).mode & 0o777).toBe(0o750);
        expect(existsSync(join(location.root, location.stateDirectory, 'ownership.json'))).toBe(true);
    },
);

test.each(['.gspot', '.gspot/.gspot', '.automation/.gspot'])(
    'obsolete ownership in %s remains unowned and unchanged',
    async (directory) => {
        await using repository = await testdir();
        const journal = `${directory}/ownership.json`;
        const backup = `${directory}/recovery/original`;
        await createFileTree(repository.path, {
            [journal]: 'obsolete journal bytes\n',
            [backup]: 'authored recovery bytes\n',
            'config.txt': 'unowned configuration\n',
        });
        chmodSync(join(repository.path, journal), 0o640);
        chmodSync(join(repository.path, backup), 0o400);
        expect(readOwnership(repository.path).files).toStrictEqual([]);
        const owner = openLifecycleOwner(repository.path);
        try {
            expect(owner.paths()).toStrictEqual([]);
            expect(owner.restore('config.txt')).toBe('preserved');
            owner.replace('current.txt', { bytes: Buffer.from('current'), mode: 0o644 }, 'config');
            expect(owner.restore('current.txt')).toBe('changed');
        } finally {
            owner.close();
        }
        expect(readFileSync(join(repository.path, 'config.txt'), 'utf8')).toBe('unowned configuration\n');
        expect(readFileSync(join(repository.path, journal), 'utf8')).toBe('obsolete journal bytes\n');
        expect(statSync(join(repository.path, journal)).mode & 0o777).toBe(0o640);
        expect(readFileSync(join(repository.path, backup), 'utf8')).toBe('authored recovery bytes\n');
        expect(statSync(join(repository.path, backup)).mode & 0o777).toBe(0o400);
    },
);
