import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

test('a path-specific Vale ignore retains findings elsewhere and reports its actual matches', async () => {
    await using directory = await testdir();
    const policy = buildPolicy([]);
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'guide.md': '# Schedule\n\nRelease on 03/04/2026.\n',
        'archive.md': '# Schedule\n\nRelease on 03/04/2026.\n',
    });
    const environment = { PATH: buildToolsPath(['vale']) };
    const applied = await spawnGspot(directory.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'prose/vale', '--json'];
    const before = await spawnGspot(directory.path, command, environment);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(
        (JSON.parse(before.stdout) as RunReport).checks[0]?.findings.map(({ file, rule, line }) => ({
            file,
            rule,
            line,
        })),
    ).toStrictEqual([
        { file: 'archive.md', rule: 'gspot.dates', line: 3 },
        { file: 'guide.md', rule: 'gspot.dates', line: 3 },
    ]);
    const ignored = await spawnGspot(
        directory.path,
        [
            'ignore',
            'prose/vale',
            '--rule',
            'gspot.dates',
            '--paths',
            'archive.md',
            '--reason',
            'Archived dates retain their original notation.',
        ],
        environment,
    );
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const after = await spawnGspot(directory.path, command, environment);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const report = JSON.parse(after.stdout) as RunReport;
    expect(report.checks[0]?.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'guide.md', rule: 'gspot.dates' },
    ]);
    expect(report.ignores).toContainEqual(containing({ check: 'prose/vale', rule: 'gspot.dates', matched: 1 }));
    await writeFile(join(directory.path, 'guide.md'), '# Schedule\n\nRelease on March 4, 2026.\n');
    const corrected = await spawnGspot(directory.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
