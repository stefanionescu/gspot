import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { sarifText } from '#cli/output/report.ts';
import { existsSync, readFileSync } from 'node:fs';
import { reportSchema } from '#cli/run/report-schema.ts';

const policy = `version = 1
presets = []
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
    const saved = readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8');
    expect(JSON.parse(saved)).toEqual(outcome.report);
    expect(existsSync(join(sandbox.path, '.gspot/report.sarif'))).toBe(true);
    expect(outcome.report.coverage).toEqual({ checked: 1, unchecked: 1 });
    expect(JSON.parse(sarifText(outcome.report))).toHaveProperty('runs.0.results.0.ruleId', 'sandbox/identity');
});
