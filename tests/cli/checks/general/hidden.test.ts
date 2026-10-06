import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';

test('a document cannot suppress Vale findings with a native directive', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['prose'], { level: 'all' }),
        'guide.md': '# A page\n\n<!-- vale off -->\n\nText hidden from the prose check.\n',
    });
    const failed = await runGspot(sandbox.path, ['check', '--only', 'prose/hidden', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
        { check: 'prose/hidden', status: 'failed', findings: [{ file: 'guide.md', rule: 'vale-directive', line: 3 }] },
    ]);
    await Bun.write(`${sandbox.path}/guide.md`, '# A page\n\nText remains visible to the prose check.\n');
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'prose/hidden', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
