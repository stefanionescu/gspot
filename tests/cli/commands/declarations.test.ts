import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/execution/check.ts';

test('generated and vendored settings classify directories and removal returns files to source checks', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'entry.sh': 'echo example\n',
        'output types/broken.sh': 'if then\n',
        'upstream/broken.sh': 'if then\n',
    });
    for (const [kind, path] of [
        ['generated', 'output types'],
        ['vendored', 'upstream'],
    ]) {
        const changed = await runGspot(directory.path, [
            'set',
            kind!,
            JSON.stringify({ paths: [path], reason: 'External files retained for consumers' }),
        ]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    }
    const before = await runGspot(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect((JSON.parse(before.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/bash-syntax', status: 'passed', fileCount: 1, findings: [] },
    ]);
    const removed = await runGspot(directory.path, ['set', 'generated', 'output types', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const after = await runGspot(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const checked = (JSON.parse(after.stdout) as RunReport).checks[0];
    expect(checked).toMatchObject({ check: 'bash/bash-syntax', status: 'failed' });
    expect(checked?.fileCount).toBe(2);
    expect(new Set(checked?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['output types/broken.sh']),
    );
    await writeFile(join(directory.path, 'output types/broken.sh'), 'echo corrected\n');
    const corrected = await runGspot(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/bash-syntax', status: 'passed', fileCount: 2, findings: [] },
    ]);
});

test('declarations retain producer metadata and reasons while removing individual paths', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'a.sh': 'if then\n',
        'b.sh': 'if then\n',
    });
    const original = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
    const refused = await runGspot(directory.path, ['set', 'generated', '{"paths":["a.sh"]}']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
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

test('excluded directories stay out of checks until the policy removes their exclusion', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], {
            tables: 'exclude = ["legacy scripts"]\n[agent_rules]\nenabled = false\n',
        }),
        'entry.sh': 'echo example\n',
        'legacy scripts/broken.sh': 'if then\n',
    });
    const before = await runGspot(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect((JSON.parse(before.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/bash-syntax', status: 'passed', fileCount: 1, findings: [] },
    ]);
    const changed = await runGspot(directory.path, ['set', 'exclude', 'legacy scripts', '--remove']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const after = await runGspot(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const checked = (JSON.parse(after.stdout) as RunReport).checks[0];
    expect(checked).toMatchObject({ check: 'bash/bash-syntax', status: 'failed' });
    expect(checked?.fileCount).toBe(2);
    expect(new Set(checked?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['legacy scripts/broken.sh']),
    );
    await writeFile(join(directory.path, 'legacy scripts/broken.sh'), 'echo corrected\n');
    const corrected = await runGspot(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/bash-syntax', status: 'passed', fileCount: 2, findings: [] },
    ]);
});
