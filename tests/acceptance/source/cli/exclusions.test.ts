import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

test('excluded directories stay out of checks until the policy removes their exclusion', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['bash'], 'exclude = ["legacy scripts"]\n[guides]\ninstall = false\n'),
        'entry.sh': 'echo example\n',
        'legacy scripts/broken.sh': 'if then\n',
    });
    const before = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect((JSON.parse(before.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/syntax', status: 'ok', files: 1, findings: [] },
    ]);
    const changed = await run(directory.path, ['set', 'exclude', 'legacy scripts', '--remove']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const after = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const checked = (JSON.parse(after.stdout) as RunReport).checks[0];
    expect(checked).toMatchObject({ check: 'bash/syntax', status: 'fail' });
    expect(checked?.files).toBe(2);
    expect(checked?.findings.map((finding) => finding.file)).toStrictEqual([
        'legacy scripts/broken.sh',
        'legacy scripts/broken.sh',
    ]);
    writeFileSync(join(directory.path, 'legacy scripts/broken.sh'), 'echo corrected\n');
    const corrected = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/syntax', status: 'ok', files: 2, findings: [] },
    ]);
});
