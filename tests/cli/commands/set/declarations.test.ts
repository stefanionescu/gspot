import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { DECLARATION_CASES } from '#tests/config/cli/commands/set/declarations.ts';

test.each(DECLARATION_CASES)(
    '$kind directories return to source checks when their declaration is removed',
    async ({ kind, directory, tables, files, setup }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], { tables }),
            'entry.sh': 'echo example\n',
            ...Object.fromEntries(files),
        });
        for (const command of setup) {
            const changed = await runGspot(sandbox.path, command);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        }
        const before = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        expect(before.report.checks).toMatchObject([
            { check: 'bash/bash-syntax', status: 'passed', fileCount: 1, findings: [] },
        ]);
        const removed = await runGspot(sandbox.path, ['set', kind, directory, '--remove']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        const after = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
        expect(after.code, after.stdout + after.stderr).toBe(1);
        const checked = after.report.checks[0];
        expect(checked).toMatchObject({ check: 'bash/bash-syntax', status: 'failed', fileCount: 2 });
        expect(new Set(checked?.findings.map((finding) => finding.file))).toStrictEqual(
            new Set([`${directory}/broken.sh`]),
        );
    },
);

test('declarations retain producer metadata and reasons while removing individual paths', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash']),
        'a.sh': 'if then\n',
        'b.sh': 'if then\n',
    });
    const original = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
    const refused = await runGspot(directory.path, ['set', 'generated', '{"paths":["a.sh"]}']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('reason');
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(original);
    const accepted = await runGspot(directory.path, [
        'set',
        'generated',
        '{"paths":["a.sh","b.sh"],"generator":"bun generate.ts"}',
        '--reason',
        'Build output retained for consumers',
    ]);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const merged = await runGspot(directory.path, [
        'set',
        'generated',
        '{"paths":["a.sh","b.sh"]}',
        '--reason',
        'Regenerated output retained for consumers',
    ]);
    expect(merged.code, merged.stdout + merged.stderr).toBe(0);
    const removed = await runGspot(directory.path, ['set', 'generated', 'a.sh', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(
        (Bun.TOML.parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8')) as Record<string, unknown>)[
            'generated'
        ],
    ).toStrictEqual([
        { paths: ['b.sh'], generator: 'bun generate.ts', reason: 'Regenerated output retained for consumers' },
    ]);
});
