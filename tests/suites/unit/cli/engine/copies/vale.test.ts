import { existsSync } from 'node:fs';
import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { copyValePackages } from '#cli/engine/copies/vale.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('a revision copy whose .gspot is a link gets no Vale package link outside the copy', async () => {
    await using sandbox = await testdir({ 'work/.gspot/vale/styles/.keep': '', 'copy/.keep': '', 'outside/.keep': '' });
    await symlink(join(sandbox.path, 'outside'), join(sandbox.path, 'copy/.gspot'), 'dir');
    expect(() => {
        copyValePackages(join(sandbox.path, 'work'), join(sandbox.path, 'copy'));
    }).toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' }));
    expect(existsSync(join(sandbox.path, 'outside/vale'))).toBe(false);
});
