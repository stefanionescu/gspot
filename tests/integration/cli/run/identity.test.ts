import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { sarifText } from '#cli/output/report.ts';
import { createFileTree, testdir } from 'testdirs';
import { existsSync, readFileSync } from 'node:fs';
import { reportSchema } from '#cli/execution/report.ts';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

const policy = `version = 1
configurations = []
[[check]]
name = "sandbox/identity"
command = ${JSON.stringify([process.execPath, '-e', 'process.stdout.write("A sandbox finding."); process.exitCode = 1'])}
paths = ["source.txt"]
stage = "commit"
[check.output]
format = "lines"
`;

test('serializes check definitions and references without changing external SARIF identifiers', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, {
        stage: 'all',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    expect(session.policyFiles.policy.checks[0]?.name).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.check).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.findings[0]?.check).toBe('sandbox/identity');
    expect(reportSchema.safeParse(outcome.report).success).toBe(true);
    const saved = readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8');
    expect(JSON.parse(saved)).toStrictEqual(outcome.report);
    expect(existsSync(join(sandbox.path, '.gspot/reports/report.sarif'))).toBe(true);
    expect(outcome.report.coverage).toStrictEqual({ checked: 1, unchecked: 1, findings: [] });
    expect(JSON.parse(sarifText(outcome.report))).toHaveProperty('runs.0.results.0.ruleId', 'sandbox/identity');
});

test('counted failures survive final filtering without diagnostic locations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy
            .replace('[check.output]', 'count_regex = "A sandbox finding"\n[check.output]')
            .replace('format = "lines"', 'format = "none"')
            .replace('process.exitCode = 1', 'process.exitCode = 0'),
        'source.txt': 'original',
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'all' as const, skips: [], fix: false, isDryRun: false, noCache: true };
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks[0]).toMatchObject({ status: 'fail', findings: [] });
    await Bun.write(join(sandbox.path, '.gspot/version'), GSPOT_VERSION + '\n');
    const cli = Bun.spawnSync(
        [
            process.execPath,
            Bun.resolveSync('#cli/main.ts', import.meta.dir),
            'check',
            '--only',
            'sandbox/identity',
            '--no-cache',
            '--json',
        ],
        { cwd: sandbox.path },
    );
    expect(cli.exitCode, cli.stderr.toString()).toBe(1);

    session.policyFiles.policy.checks[0]!.count_regex = 'No matching output';
    const corrected = await executeRun(session, options);
    expect(corrected.report.exitCode).toBe(0);
});

test.each(['{ broken', '{}', ''])(
    'custom JSON output %j produces inability instead of a discarded finding',
    async (output) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nconfigurations = []\n[[check]]\nname = "sandbox/json"\ncommand = ${JSON.stringify([process.execPath, '-e', `process.stdout.write(${JSON.stringify(output)})`])}\npaths = ["source.txt"]\nstage = "commit"\n[check.output]\nformat = "json"\n`,
            'source.txt': 'original',
            '.gspot/version': GSPOT_VERSION + '\n',
        });
        const cli = Bun.spawnSync(
            [
                process.execPath,
                Bun.resolveSync('#cli/main.ts', import.meta.dir),
                'check',
                '--only',
                'sandbox/json',
                '--no-cache',
                '--json',
            ],
            { cwd: sandbox.path },
        );
        expect(cli.exitCode, cli.stdout.toString() + cli.stderr.toString()).toBe(2);
        expect(JSON.parse(cli.stdout.toString()).checks[0].status).toBe('error');
    },
);
