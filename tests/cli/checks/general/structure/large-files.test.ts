// The repository-shape integrity analyses: suppressions, policy patterns, large files, and configuration purity.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { BYTES_PER_KB } from '#cli/config/platform/runtime.ts';
import { REPOSITORY_SHAPE_POLICY } from '#tests/config/samples/structure.ts';

test('a file over the limit that is neither declared nor under LFS is reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'big.bin': Buffer.alloc(BYTES_PER_KB + 1),
        'data/big.bin': Buffer.alloc(BYTES_PER_KB + 1),
        'small.txt': 'small',
    });
    const paths = ['big.bin', 'data/big.bin', 'small.txt'];
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({ level: 'all', ...REPOSITORY_SHAPE_POLICY, limits: { file_kb: 1 } }),
    );
    const found = BUILT_IN_CHECKS['structure/large-files'].input(
        buildCheckInput(await openSession(sandbox.path), 'structure/large-files', { paths: paths }),
    );
    expect(found.map((finding) => finding.file)).toStrictEqual(['big.bin']);
});
