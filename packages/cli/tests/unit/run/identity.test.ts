import { expect, test } from 'bun:test';
import { createFixture } from 'fs-fixture';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { sarifText } from '#cli/run/record/write.ts';
import { cacheKey, textHash } from '#cli/run/cache.ts';
import { recordSchema } from '#cli/run/record/schema.ts';
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
    expect(outcome.record.checks[0]?.check).toBe('fixture/identity');
    expect(outcome.record.checks[0]).not.toHaveProperty('id');
    expect(outcome.record.checks[0]?.findings[0]?.check).toBe('fixture/identity');
    expect(recordSchema.safeParse(outcome.record).success).toBe(true);
    expect(JSON.parse(sarifText(outcome.record))).toHaveProperty('runs.0.results.0.ruleId', 'fixture/identity');
    expect(() => parsePolicyText(policy.replace('name =', 'id ='), 'gspot.toml')).toThrow('`id`');
    const stale = {
        ...outcome.record,
        checks: outcome.record.checks.map(({ check, ...result }) => ({ ...result, id: check })),
    };
    expect(recordSchema.safeParse(stale).success).toBe(false);
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
