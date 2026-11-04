import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { copyValePackages } from '#cli/engine/copies/vale.ts';

test('a revision copy whose .gspot is a link gets no Vale package link outside the copy', async () => {
    await using sandbox = await testdir({ 'work/.gspot/vale/styles/.keep': '', 'copy/.keep': '', 'outside/.keep': '' });
    await symlink(join(sandbox.path, 'outside'), join(sandbox.path, 'copy/.gspot'), 'dir');
    expect(() => {
        copyValePackages(join(sandbox.path, 'work'), join(sandbox.path, 'copy'), []);
    }).toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' }));
    expect(existsSync(join(sandbox.path, 'outside/vale'))).toBe(false);
});
