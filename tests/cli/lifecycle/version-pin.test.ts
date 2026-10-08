import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { GspotError } from '#cli/platform/public.ts';
import { unlink, writeFile } from 'node:fs/promises';
import { buildPolicy } from '#tests/harness/policy.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { readVersionPin, writeVersionPin, assertVersionPin } from '#cli/lifecycle/public.ts';

const { version: RUNNING_VERSION } = packageManifest;

test('the version pin is written, read, and refused when it differs', async () => {
    await using sandbox = await testdir();
    expect(readVersionPin(sandbox.path)).toBeUndefined();
    {
        using log = openOwnership(sandbox.path);
        writeVersionPin(log);
    }
    expect(readVersionPin(sandbox.path)).toBe(RUNNING_VERSION);
    expect(() => {
        assertVersionPin(sandbox.path);
    }).not.toThrow();
    await writeFile(join(sandbox.path, '.gspot/version'), '9.9.9\n');
    let refused: unknown;
    try {
        assertVersionPin(sandbox.path);
    } catch (error) {
        refused = error;
    }
    expect(refused).toBeInstanceOf(GspotError);
    expect(refused).toMatchObject({
        code: 'pin',
        message: [
            `This repository pins gspot 9.9.9 and this binary is ${RUNNING_VERSION}.`,
            "Two ways forward: install the pinned version (mise install, or your package manager's install),",
            'or move the pin to this version: gspot apply',
        ].join('\n'),
    });
});

test('a different saved version refuses check and doctor reports both remedies until apply repairs it', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildPolicy(['bash']), 'script.sh': CLEAN_BASH_SCRIPT });
    const prepared = await runGspot(sandbox.path, ['apply', '--json']);
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    await Bun.write(join(sandbox.path, '.gspot/version'), '9.9.9\n');
    const check = await runGspot(sandbox.path, ['check', '--json']);
    expect(check.code, check.stdout + check.stderr).toBe(2);
    expect(check.stdout).toContain('mise install');
    expect(check.stdout).toContain('gspot apply');
    const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    const refused = await runGspot(sandbox.path, ['apply', '--json']);
    expect(refused.code).toBe(2);
    expect(refused.stdout).toContain('Delete it, then run gspot apply.');
    await unlink(join(sandbox.path, '.gspot/version'));
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readVersionPin(sandbox.path)).toBe(RUNNING_VERSION);
});
