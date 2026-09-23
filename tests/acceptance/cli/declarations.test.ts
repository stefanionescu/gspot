import { run } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('generated and vendored settings classify directories and removal returns files to source checks', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\npresets = ["bash"]\n[rules]\ninstall = false\n',
        'entry.sh': 'echo example\n',
        'output types/broken.sh': 'if then\n',
        'upstream/broken.sh': 'if then\n',
    });
    for (const [kind, path] of [
        ['generated', 'output types'],
        ['vendored', 'upstream'],
    ]) {
        const changed = await run(directory.path, ['set', kind!, path!]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    }
    const before = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect((JSON.parse(before.stdout) as { checks: { files: number }[] }).checks[0]?.files).toBe(1);
    const removed = await run(directory.path, ['set', 'generated', 'output types', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const after = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const checked = (JSON.parse(after.stdout) as { checks: { files: number; findings: { file: string }[] }[] })
        .checks[0];
    expect(checked?.files).toBe(2);
    expect(checked?.findings.map((finding) => finding.file)).toEqual([
        'output types/broken.sh',
        'output types/broken.sh',
    ]);
    writeFileSync(join(directory.path, 'output types/broken.sh'), 'echo corrected\n');
    const corrected = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const obsolete = await run(directory.path, ['declare', 'entry.sh', '--vendored']);
    expect(obsolete.code).toBe(2);
});

test('declarations retain producer metadata and reasons while removing individual paths', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\npresets = ["bash"]\nrequire_reasons = true\n[rules]\ninstall = false\n',
        'a.sh': 'if then\n',
        'b.sh': 'if then\n',
    });
    const original = readFileSync(join(directory.path, 'gspot.toml'), 'utf8');
    const refused = await run(directory.path, ['set', 'generated', 'a.sh']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(original);
    const accepted = await run(directory.path, [
        'set',
        'generated',
        '{"paths":["a.sh","b.sh"],"produced_by":"bun generate.ts"}',
        '--reason',
        'Build output retained for consumers',
    ]);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const removed = await run(directory.path, ['set', 'generated', 'a.sh', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(
        (Bun.TOML.parse(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')) as Record<string, unknown>)[
            'generated'
        ],
    ).toEqual([{ paths: ['b.sh'], produced_by: 'bun generate.ts', reason: 'Build output retained for consumers' }]);
    writeFileSync(join(directory.path, 'gspot.toml'), `${original}\n[[declare]]\npaths = ["a.sh"]\nvendored = true\n`);
    const legacy = await run(directory.path, ['check', '--only', 'bash/syntax']);
    expect(legacy.code, legacy.stdout + legacy.stderr).toBe(2);
});
