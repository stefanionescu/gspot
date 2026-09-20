import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFixture } from 'fs-fixture';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { existsSync, readFileSync } from 'node:fs';
import { sarifText } from '#cli/run/report/write.ts';
import { reportSchema } from '#cli/run/report/schema.ts';

const policy = `version = 1
presets = []
[[check]]
name = "fixture/identity"
command = ${JSON.stringify([process.execPath, '-e', 'process.stdout.write("A fixture finding."); process.exitCode = 1'])}
paths = ["source.txt"]
stage = "commit"
[check.output]
format = "lines"
`;

test('serializes check definitions and references without changing external SARIF identifiers', async () => {
    await using fixture = await createFixture({ 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(fixture.path);
    const outcome = await executeRun(session, {
        stage: 'all',
        skips: [],
        localSkips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    expect(session.policyFiles.policy.checks[0]?.name).toBe('fixture/identity');
    expect(outcome.report.checks[0]?.check).toBe('fixture/identity');
    expect(outcome.report.checks[0]?.findings[0]?.check).toBe('fixture/identity');
    expect(reportSchema.safeParse(outcome.report).success).toBe(true);
    const saved = readFileSync(join(fixture.path, '.gspot/report.json'), 'utf8');
    expect(JSON.parse(saved)).toEqual(outcome.report);
    expect(existsSync(join(fixture.path, '.gspot/report.sarif'))).toBe(true);
    expect(outcome.report.coverage).toEqual({ checked: 1, unchecked: 1 });
    expect(JSON.parse(sarifText(outcome.report))).toHaveProperty('runs.0.results.0.ruleId', 'fixture/identity');
});
