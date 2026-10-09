// The repository-shape integrity analyses: suppressions, policy patterns, large files, and configuration purity.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { checkReport } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { BYTES_PER_KB } from '#cli/config/platform/runtime.ts';

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
        stringify({
            level: 'all',
            generated: [{ paths: ['data/**'], reason: 'The sandbox owns generated output.' }],
            limits: { file_kb: 1 },
        }),
    );
    const found = BUILT_IN_CHECKS['repository/large-files'].input(
        buildCheckInput(await openSession(sandbox.path), 'repository/large-files', { paths: paths }),
    );
    expect(found.map((finding) => finding.file)).toStrictEqual(['big.bin']);
});

test.each(['recommended', 'all'] as const)(
    '%s repository size findings retain child, LFS, declared, and corrected-file behavior',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['javascript'], {
            level,
            tables: '[limits]\nfile_kb = 1\n[[generated]]\npaths = ["data/**"]\nreason = "The isolated sandbox owns generated data."\n[[vendored]]\npaths = ["vendor/**"]\nreason = "The isolated sandbox owns external data."\n[scope.app]\n',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            '.gitattributes': 'lfs.bin filter=lfs\n',
            ...Object.fromEntries(
                ['big.bin', 'app/big.bin', 'lfs.bin', 'data/big.bin', 'vendor/big.bin'].map((path) => [
                    path,
                    Buffer.alloc(BYTES_PER_KB + 1),
                ]),
            ),
            'small.txt': 'small',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-f', '.']).code).toBe(0);
        const command = ['check', '--only', 'repository/large-files', '--json'];
        const failed = await checkReport(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(
            failed.report.checks.flatMap(({ findings }) =>
                findings.map(({ file, rule, line }) => ({ file, rule, line })),
            ),
        ).toStrictEqual([
            { file: 'app/big.bin', rule: 'size', line: 1 },
            { file: 'big.bin', rule: 'size', line: 1 },
        ]);
        await Bun.write(join(sandbox.path, 'app/big.bin'), Buffer.alloc(BYTES_PER_KB));
        await Bun.write(join(sandbox.path, 'big.bin'), Buffer.alloc(BYTES_PER_KB));
        expect(git(sandbox.path, ['add', '-f', 'app/big.bin', 'big.bin']).code).toBe(0);
        const fixed = await checkReport(sandbox.path, command);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(fixed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        const bytes = await Bun.file(join(sandbox.path, 'data/big.bin')).bytes();
        expect(bytes.byteLength).toBe(BYTES_PER_KB + 1);
    },
);
