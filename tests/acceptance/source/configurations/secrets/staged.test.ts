// Planted repository for the secrets configuration: a staged key, a tracked environment file and a baseline with no reason.
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';
import { PLANTED_KEY_ID, PLANTED_SETTINGS } from '#tests/support/cli/secrets.ts';
import { expectCorrected, runPlanted, script } from '#tests/support/cli/planted.ts';

const INIT = initArgs(['secrets']);
const BASELINE = JSON.stringify([
    { Fingerprint: 'old.py:aws-access-token:1', File: 'old.py', RuleID: 'aws-access-token' },
    { Fingerprint: 'abc123:gone.md:generic-api-key:4', File: 'gone.md', RuleID: 'generic-api-key', Commit: 'abc123' },
]);

describe('the secrets configuration', () => {
    test(
        'staged secrets, tracked environment files and unexplained baselines fail and accept corrections',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['gitleaks']) };
            await installAtLevel(sandbox.path, INIT, environment);
            const clean = await run(sandbox.path, ['check', '--stage', 'commit', '--no-cache'], environment);
            expect(clean.code).toBe(0);

            await Bun.write(join(sandbox.path, 'settings.py'), PLANTED_SETTINGS);
            git(sandbox.path, ['add', 'settings.py']);
            const staged = await run(
                sandbox.path,
                ['check', '--only', 'secrets/gitleaks-staged', '--no-cache', '--json'],
                environment,
            );
            expect(staged.code, staged.stdout).toBe(1);
            expect(reportSchema.parse(JSON.parse(staged.stdout)).checks).toMatchObject([
                {
                    check: 'secrets/gitleaks-staged',
                    status: 'fail',
                    findings: [containing({ file: 'settings.py', rule: 'aws-access-token', line: 1 })],
                },
            ]);
            expect(staged.stdout).not.toContain(PLANTED_KEY_ID);

            await Bun.write(
                join(sandbox.path, 'settings.py'),
                'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
            );
            expect(git(sandbox.path, ['add', 'settings.py']).code).toBe(0);
            await expectCorrected(sandbox.path, 'secrets/gitleaks-staged', environment);

            await Bun.write(join(sandbox.path, '.env'), 'TOKEN=value\n');
            git(sandbox.path, ['add', '-f', '.env']);
            const tracked = await run(
                sandbox.path,
                ['check', '--only', 'integrity/env-files', '--no-cache', '--json'],
                environment,
            );
            expect(tracked.code).toBe(1);
            expect(reportSchema.parse(JSON.parse(tracked.stdout)).checks).toMatchObject([
                {
                    check: 'integrity/env-files',
                    status: 'fail',
                    findings: [{ file: '.env', rule: 'tracked-environment-file', line: 1 }],
                },
            ]);
            expect(git(sandbox.path, ['rm', '--cached', '.env']).code).toBe(0);
            await expectCorrected(sandbox.path, 'integrity/env-files', environment);
            expect(await Bun.file(join(sandbox.path, '.env')).text()).toBe('TOKEN=value\n');

            const baseline = await runPlanted(
                sandbox.path,
                {
                    check: 'integrity/gitleaks-baseline',
                    files: { '.gspot/gitleaks-baseline.json': BASELINE },
                },
                environment,
            );
            expect(baseline.code).toBe(1);
            const baselineReport = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(baselineReport.checks).toMatchObject([
                {
                    check: 'integrity/gitleaks-baseline',
                    status: 'fail',
                    findings: [
                        {
                            file: '.gspot/gitleaks-baseline.json',
                            rule: 'no-reason',
                            line: 1,
                            message: textContaining('old.py:aws-access-token:1'),
                        },
                        {
                            file: '.gspot/gitleaks-baseline.json',
                            rule: 'stale-entry',
                            line: 1,
                            message: textContaining('names old.py'),
                        },
                        {
                            file: '.gspot/gitleaks-baseline.json',
                            rule: 'no-reason',
                            line: 1,
                            message: textContaining('abc123:gone.md:generic-api-key:4'),
                        },
                    ],
                },
            ]);
            const explained = await runPlanted(
                sandbox.path,
                {
                    check: 'integrity/gitleaks-baseline',
                    files: {
                        '.gspot/gitleaks-baseline.json': BASELINE,
                        'old.py': '# A reviewed historical fixture.\n',
                    },
                    policy: '[[tools.gitleaks.baseline_reasons]]\nfingerprint = "old.py:aws-access-token:1"\nreason = "An inert documented example."\n[[tools.gitleaks.baseline_reasons]]\nfingerprint = "abc123:gone.md:generic-api-key:4"\nreason = "An inert example retained in history."\n',
                },
                environment,
            );
            expect(explained.code, explained.stdout + explained.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([
                { check: 'integrity/gitleaks-baseline', status: 'ok', findings: [] },
            ]);
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const network = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(network.checks.map((check) => check.check)).not.toContain('secrets/trufflehog');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
