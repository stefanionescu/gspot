import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { keptMode } from '#tests/support/cli/platforms.ts';
import { statSync, chmodSync, readFileSync } from 'node:fs';
import { openOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';

test.each(['.gspot', '.gspot/.gspot', '.automation/.gspot'])(
    'obsolete ownership in %s remains unowned and unchanged',
    async (directory) => {
        await using repository = await testdir();
        const log = `${directory}/ownership.json`;
        const backup = `${directory}/recovery/original`;
        await createFileTree(repository.path, {
            [log]: 'obsolete log bytes\n',
            [backup]: 'authored recovery bytes\n',
            'config.txt': 'unowned configuration\n',
        });
        chmodSync(join(repository.path, log), 0o640);
        chmodSync(join(repository.path, backup), 0o400);
        expect(readOwnership(repository.path).files).toStrictEqual([]);
        const owner = openOwner(repository.path);
        try {
            expect(owner.paths()).toStrictEqual([]);
            expect(owner.restore('config.txt')).toBe('preserved');
            owner.replace('current.txt', { bytes: Buffer.from('current'), mode: 0o644 }, 'config');
            expect(owner.restore('current.txt')).toBe('changed');
        } finally {
            owner.close();
        }
        expect(readFileSync(join(repository.path, 'config.txt'), 'utf8')).toBe('unowned configuration\n');
        expect(readFileSync(join(repository.path, log), 'utf8')).toBe('obsolete log bytes\n');
        expect(statSync(join(repository.path, log)).mode & 0o777).toBe(keptMode(0o640));
        expect(readFileSync(join(repository.path, backup), 'utf8')).toBe('authored recovery bytes\n');
        expect(statSync(join(repository.path, backup)).mode & 0o777).toBe(keptMode(0o400));
    },
);
