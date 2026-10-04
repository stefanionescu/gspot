import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';

test('a path-specific Vale ignore retains findings elsewhere and reports its actual matches', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['prose'], { tables: '[agent_rules]\nenabled = false\n' });
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'guide.md': '# Schedule\n\nRelease on 03/04/2026.\n',
        'archive.md': '# Schedule\n\nRelease on 03/04/2026.\n',
    });
    const environment = { PATH: buildToolsPath(['vale']) };
    const applied = await spawnGspot(directory.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const reconciledPolicy = readFileSync(join(directory.path, 'gspot.toml'), 'utf8');
    for (const [key, value] of [
        ['prose.disabled', '{"rule":"gspot.dates","reason":"Archived example"}'],
        ['tools.vale.enabled', 'false'],
    ]) {
        const refused = await spawnGspot(directory.path, ['set', key!, value!], environment);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(reconciledPolicy);
    }
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
        ['ignore', 'prose/vale', '--rule', 'gspot.dates', '--paths', 'archive.md'],
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
    writeFileSync(join(directory.path, 'guide.md'), '# Schedule\n\nRelease on March 4, 2026.\n');
    const corrected = await spawnGspot(directory.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
