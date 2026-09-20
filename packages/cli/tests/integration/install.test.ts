import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import * as processes from '#cli/platform/spawn.ts';
import { upgradeCommand } from '#cli/lifecycle/upgrade/command.ts';

test('an installer failure stops upgrade before changing its version pin', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n[runner]\ntool = "bun"\n',
        '.gspot/version': '0.0.1\n',
        'package.json': '{"private":true}',
    });
    const installer = spyOn(processes, 'run').mockResolvedValue({
        code: 1,
        missing: false,
        duration: 1,
        stdout: '',
        stderr: 'Planted installation failure.',
    });
    try {
        await rejects(
            upgradeCommand({ cwd: sandbox.path, yes: true, install: true, isDryRun: false }),
            /installation command bun install failed/,
        );
    } finally {
        installer.mockRestore();
    }
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
});
