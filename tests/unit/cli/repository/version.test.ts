import * as fs from 'node:fs';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { readFile, writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { readVersionPin, assertVersionPin } from '#cli/repository/version.ts';

test('a failed version pin write leaves the old version', async () => {
    await using repository = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/version': '0.0.1\n',
    });

    const rename = fs.renameSync;
    using _failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(repository.path, '.gspot/version')) throw new Error('Pin write denied');
        rename(source, target);
    });

    const refused = await runGspot(repository.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('Pin write denied');
    expect(await readFile(join(repository.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
});

test('the version pin is written, read, and refused when it differs', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    expect(readVersionPin(sandbox.path)).toBeUndefined();
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readVersionPin(sandbox.path)).toBe(cliPackage.version);
    await assertVersionPin(sandbox.path);
    await writeFile(join(sandbox.path, '.gspot/version'), '9.9.9\n');
    const refused: unknown = await assertVersionPin(sandbox.path).catch((error: unknown) => error);
    expect(refused).toHaveProperty(
        'message',
        [
            `This repository pins gspot 9.9.9, and you are running gspot ${cliPackage.version}.`,
            'Install the pinned version: mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9',
            'To upgrade the repository pin to this version: gspot apply',
        ].join('\n'),
    );
    expect(refused).toMatchObject({ code: 'pin' });
});

test('a different saved version permits checks and blocks fixes until apply updates the pin', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'script.sh': CLEAN_BASH_SCRIPT,
    });
    const prepared = await runGspot(sandbox.path, ['apply', '--json']);
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    await writeFile(join(sandbox.path, '.gspot/version'), '9.9.9\n');
    const check = await runGspot(sandbox.path, ['check', '--only', 'bash/safety', '--json']);
    expect(check.code, check.stdout + check.stderr).toBe(0);
    const fixed = await runGspot(sandbox.path, ['check', '--fix', '--only', 'bash/safety', '--json']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(2);
    expect(fixed.stdout).toContain('mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9');
    expect(fixed.stdout).toContain('gspot apply');
    const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readVersionPin(sandbox.path)).toBe(cliPackage.version);
});
