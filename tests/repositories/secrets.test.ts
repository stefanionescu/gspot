// Planted repository for the secrets preset: a staged key, a pushed key, a tracked environment file and a baseline with no reason.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, git, PLANTED_TIMEOUT_MS, run, runPlanted, script, toolsPath } from '#tests/harness/planted.ts';

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
]);

describe('the secrets preset', () => {
    test(
        'a staged key, a pushed key, a tracked environment file and an unexplained baseline entry are each reported',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['gitleaks']) };
            run(fixture.path, INIT, environment);
            expect(run(fixture.path, ['check', '--at', 'commit', '--no-cache'], environment).code).toBe(0);

            await Bun.write(join(fixture.path, 'settings.py'), SETTINGS);
            git(fixture.path, ['add', 'settings.py']);
            const staged = run(fixture.path, ['check', 'secrets/gitleaks-staged', '--no-cache'], environment);
            expect(staged.code, staged.stdout).toBe(1);
            expect(staged.stdout).toContain('settings.py:1');
            expect(staged.stdout).toContain('aws-access-token');
            expect(staged.stdout).not.toContain(KEY_ID);

            git(fixture.path, ['commit', '-qm', 'feat: add settings', '--no-verify']);
            const pushed = run(fixture.path, ['check', 'secrets/gitleaks', '--no-cache'], environment);
            expect(pushed.code, pushed.stdout).toBe(1);
            expect(pushed.stdout).toContain('settings.py');

            await Bun.write(join(fixture.path, '.env'), 'TOKEN=value\n');
            git(fixture.path, ['add', '-f', '.env']);
            const tracked = run(fixture.path, ['check', 'integrity/env-files', '--no-cache'], environment);
            expect(tracked.code).toBe(1);
            expect(tracked.stdout).toContain('.env is tracked');

            const baseline = await runPlanted(
                fixture.path,
                {
                    id: 'integrity/gitleaks-baseline',
                    files: { '.gspot/gitleaks-baseline.json': BASELINE },
                    expected: 'has no reason',
                },
                environment,
            );
            expect(baseline.code).toBe(1);
            expect(baseline.stdout).toContain('has no reason');
            expect(baseline.stdout).toContain('names old.py, which is gone');
            const network = JSON.parse(
                run(fixture.path, ['check', '--at', 'commit', '--json'], environment).stdout,
            ) as {
                checks: { id: string }[];
            };
            expect(network.checks.map((check) => check.id)).not.toContain('secrets/trufflehog');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
