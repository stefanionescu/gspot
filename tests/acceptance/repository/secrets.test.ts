// Planted repository for the secrets preset: a staged key, a pushed key, a tracked environment file and a baseline with no reason.
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';

import {
    commitAll,
    install,
    git,
    PLANTED_TIMEOUT_MS,
    run,
    runPlanted,
    script,
    toolsPath,
} from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'secrets',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
// Built from halves so no scanner of this repository reads a key in the test itself.
const KEY_ID = ['AKIA', 'IOSFODNN7', 'EXAMPLA'].join('');
const SETTINGS = `aws_access_key_id = "${KEY_ID}"\n`;
const BASELINE = JSON.stringify([
    { Fingerprint: 'old.py:aws-access-token:1', File: 'old.py', RuleID: 'aws-access-token' },
    { Fingerprint: 'abc123:gone.md:generic-api-key:4', File: 'gone.md', RuleID: 'generic-api-key', Commit: 'abc123' },
]);

describe('the secrets preset', () => {
    test(
        'a staged key, a pushed key, a tracked environment file and an unexplained baseline entry are each reported',
        async () => {
            await using sandbox = await createSandbox({ 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['gitleaks']) };
            await install(sandbox.path, INIT, environment);
            const clean = await run(sandbox.path, ['check', '--at', 'commit', '--no-cache'], environment);
            expect(clean.code).toBe(0);

            await Bun.write(join(sandbox.path, 'settings.py'), SETTINGS);
            git(sandbox.path, ['add', 'settings.py']);
            const staged = await run(
                sandbox.path,
                ['check', '--only', 'secrets/gitleaks-staged', '--no-cache'],
                environment,
            );
            expect(staged.code, staged.stdout).toBe(1);
            expect(staged.stdout).toContain('settings.py:1');
            expect(staged.stdout).toContain('aws-access-token');
            expect(staged.stdout).not.toContain(KEY_ID);

            git(sandbox.path, ['commit', '-qm', 'feat: add settings', '--no-verify']);
            const pushed = await run(sandbox.path, ['check', '--only', 'secrets/gitleaks', '--no-cache'], environment);
            expect(pushed.code, pushed.stdout).toBe(1);
            expect(pushed.stdout).toContain('settings.py');

            await Bun.write(join(sandbox.path, '.env'), 'TOKEN=value\n');
            git(sandbox.path, ['add', '-f', '.env']);
            const tracked = await run(
                sandbox.path,
                ['check', '--only', 'integrity/env-files', '--no-cache'],
                environment,
            );
            expect(tracked.code).toBe(1);
            expect(tracked.stdout).toContain('.env is tracked');

            const baseline = await runPlanted(
                sandbox.path,
                {
                    check: 'integrity/gitleaks-baseline',
                    files: { '.gspot/gitleaks-baseline.json': BASELINE },
                    expected: 'has no reason',
                },
                environment,
            );
            expect(baseline.code).toBe(1);
            expect(baseline.stdout).toContain('has no reason');
            expect(baseline.stdout).toContain('names old.py, which is gone');
            // An entry with a commit lives in history, where a deleted file still holds its value.
            expect(baseline.stdout).not.toContain('names gone.md');
            const checked = await run(sandbox.path, ['check', '--at', 'commit', '--json'], environment);
            const network = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(network.checks.map((check) => check.check)).not.toContain('secrets/trufflehog');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
