import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';

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
