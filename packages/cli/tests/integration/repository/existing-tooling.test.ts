import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { runBlocking } from '#cli/platform/spawn.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';

test('hook discovery preserves path whitespace and refuses malformed Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await createSandbox({ [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });
    const initialized = runBlocking(['git', 'init', '-q'], { cwd: sandbox.path });
    expect(initialized.code, initialized.stderr).toBe(0);
    const configured = runBlocking(['git', 'config', 'core.hooksPath', hooksPath], { cwd: sandbox.path });
    expect(configured.code, configured.stderr).toBe(0);
    expect(existingTooling(sandbox.path, [], [], []).hooks).toEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
    writeFileSync(join(sandbox.path, '.git/config'), '[core\n');
    expect(() => existingTooling(sandbox.path, [], [], [])).toThrow('Git configuration core.hooksPath failed');
});
