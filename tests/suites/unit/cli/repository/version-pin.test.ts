import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { captureRejection } from '#tests/setup/matchers.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
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
    expect(refused.message).toBe(
        [
            `This repository pins gspot 9.9.9, and you are running gspot ${cliPackage.version}.`,
            'Install the pinned version: mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9',
            'To upgrade the repository pin to this version: gspot apply',
        ].join('\n'),
    );
});

test('a different saved version blocks checks and fixes until apply updates the pin', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'script.sh': CLEAN_BASH_SCRIPT,
    });
    const firstApply = await runGspot(sandbox.path, ['apply', '--json']);
    expect(firstApply.code, firstApply.stdout + firstApply.stderr).toBe(0);
    await writeFile(join(sandbox.path, GSPOT_PATHS.versionPin), '9.9.9\n');
    const check = await runGspot(sandbox.path, ['check', '--only', 'bash/safety', '--json']);
    expect(check.code, check.stdout + check.stderr).toBe(2);
    expect(check.stderr).toBe('');
    const failure = JSON.parse(check.stdout) as CommandFailureJson;
    expect(failure).toStrictEqual({
        error: 'pin',
        message: [
            `This repository pins gspot 9.9.9, and you are running gspot ${cliPackage.version}.`,
            'Install the pinned version: mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9',
            'To upgrade the repository pin to this version: gspot apply',
        ].join('\n'),
    });
    const fixed = await runGspot(sandbox.path, ['check', '--fix', '--only', 'bash/safety', '--json']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(2);
    expect(JSON.parse(fixed.stdout) as CommandFailureJson).toStrictEqual(failure);
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readVersionPin(sandbox.path)).toBe(cliPackage.version);
});
