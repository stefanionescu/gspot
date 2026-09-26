import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { reportSchema } from '#cli/execution/report.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';

test('a path-specific Vale ignore retains findings elsewhere and reports its actual matches', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nconfigurations = ["prose"]\n[rules]\ninstall = false\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'guide.md': '# Schedule\n\nRelease on 03/04/2026.\n',
        'archive.md': '# Schedule\n\nRelease on 03/04/2026.\n',
    });
    const environment = { PATH: toolsPath(['vale']) };
    const applied = await run(directory.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    for (const [key, value] of [
        ['prose.disabled', '{"rule":"gspot.dates","reason":"Archived example"}'],
        ['tools.vale.enabled', 'false'],
    ]) {
        const refused = await run(directory.path, ['set', key!, value!], environment);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    }
    const command = ['check', '--only', 'prose/vale', '--no-cache', '--json'];
    const before = await run(directory.path, command, environment);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(
        reportSchema
            .parse(JSON.parse(before.stdout))
            .checks[0]?.findings.map(({ file, rule, line }) => ({ file, rule, line })),
    ).toStrictEqual([
        { file: 'archive.md', rule: 'gspot.dates', line: 3 },
        { file: 'guide.md', rule: 'gspot.dates', line: 3 },
    ]);
    const ignored = await run(
        directory.path,
        ['ignore', 'prose/vale', '--rule', 'gspot.dates', '--paths', 'archive.md'],
        environment,
    );
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const after = await run(directory.path, command, environment);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const report = reportSchema.parse(JSON.parse(after.stdout));
    expect(report.checks[0]?.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'guide.md', rule: 'gspot.dates' },
    ]);
    expect(report.ignores).toContainEqual(containing({ check: 'prose/vale', rule: 'gspot.dates', matched: 1 }));
    writeFileSync(join(directory.path, 'guide.md'), '# Schedule\n\nRelease on March 4, 2026.\n');
    const corrected = await run(directory.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const obsoletePolicy = `${policy}\n[tools.vale]\nenabled = false\n`;
    writeFileSync(join(directory.path, 'gspot.toml'), obsoletePolicy);
    const obsolete = await run(directory.path, command, environment);
    expect(obsolete.code, obsolete.stdout + obsolete.stderr).toBe(1);
    const obsoleteChecks = reportSchema.parse(JSON.parse(obsolete.stdout)).checks;
    expect(obsoleteChecks.map((check) => check.check)).toStrictEqual(['prose/vale', 'integrity/policy']);
    expect(obsoleteChecks[1]?.findings).toMatchObject([
        { file: 'gspot.toml', line: 7, message: textContaining('tools.vale.enabled') },
    ]);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(obsoletePolicy);
});
