import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PIN_MESSAGE, UPGRADE_PIN_MESSAGE } from '#tests/config/version-pin.ts';
import { readVersionPin, assertVersionPin } from '#cli/repository/version-pin.ts';

test('the version pin is written, read, and refused when it differs', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    expect(readVersionPin(sandbox.path)).toBeUndefined();
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readVersionPin(sandbox.path)).toBe(cliPackage.version);
    assertVersionPin(sandbox.path);
    await writeFile(join(sandbox.path, GSPOT_PATHS.versionPin), '9.9.9\n');
    const refused = await captureRejection(
        Promise.try(() => {
            assertVersionPin(sandbox.path);
        }),
    );
    expect(refused.message).toBe(PIN_MESSAGE);
});

test('a newer CLI keeps the apply advice for an older repository pin', async () => {
    await using sandbox = await createGitSandbox({ '.gspot/version': '0.0.0\n' });
    expect(() => {
        assertVersionPin(sandbox.path);
    }).toThrow(UPGRADE_PIN_MESSAGE);
});
