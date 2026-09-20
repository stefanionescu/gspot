import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFixture } from 'fs-fixture';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { existsSync, readFileSync } from 'node:fs';
import { sarifText } from '#cli/run/report/write.ts';
import { cacheKey, textHash } from '#cli/run/cache.ts';
import { reportSchema } from '#cli/run/report/schema.ts';
import { parsePolicyText } from '#cli/policy/read-policy.ts';

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
    expect(outcome.report.checks[0]).not.toHaveProperty('id');
    expect(outcome.report.checks[0]?.findings[0]?.check).toBe('fixture/identity');
    expect(reportSchema.safeParse(outcome.report).success).toBe(true);
    expect(outcome.report).not.toHaveProperty('root');
    const saved = readFileSync(join(fixture.path, '.gspot/report.json'), 'utf8');
    expect(JSON.parse(saved)).toEqual(outcome.report);
    expect(reportSchema.safeParse({ ...outcome.report, root: fixture.path }).success).toBe(false);
    expect(existsSync(join(fixture.path, '.gspot/report.sarif'))).toBe(true);
    expect(existsSync(join(fixture.path, '.gspot/last.json'))).toBe(false);
    expect(existsSync(join(fixture.path, '.gspot/last.sarif'))).toBe(false);
    expect(outcome.report.coverage).toEqual({ checked: 1, unchecked: 1 });
    expect(outcome.report).not.toHaveProperty('inspection');
    expect(JSON.parse(sarifText(outcome.report))).toHaveProperty('runs.0.results.0.ruleId', 'fixture/identity');
    expect(() => parsePolicyText(policy.replace('name =', 'id ='), 'gspot.toml')).toThrow('`id`');
    const stale = {
        ...outcome.report,
        checks: outcome.report.checks.map(({ check, ...result }) => ({ ...result, id: check })),
    };
    expect(reportSchema.safeParse(stale).success).toBe(false);
});

test('does not reuse a cache key from the removed result identity contract', () => {
    const input = {
        check: 'fixture/identity',
        scope: '',
        toolVersion: '1',
        configurationHash: 'config',
        files: [{ path: 'source.txt', hash: 'content' }],
    };
    const previous = textHash('fixture/identity\n\n1\nconfig\n\nsource.txt:content');
    expect(cacheKey(input)).not.toBe(previous);
    expect(cacheKey({ ...input, check: 'fixture/another' })).not.toBe(cacheKey(input));
});
