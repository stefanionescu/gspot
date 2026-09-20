import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { rejects } from 'node:assert/strict';
import { expect, spyOn, test } from 'bun:test';
import * as processes from '#cli/platform/spawn.ts';
import { upgradeCommand } from '#cli/lifecycle/upgrade/command.ts';

test('an installer failure stops upgrade before changing its version pin', async () => {
    await using fixture = await createFixture({
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
            upgradeCommand({ cwd: fixture.path, yes: true, install: true, isDryRun: false }),
            /installation command bun install failed/,
        );
    } finally {
        installer.mockRestore();
    }
    expect(readFileSync(join(fixture.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
});
