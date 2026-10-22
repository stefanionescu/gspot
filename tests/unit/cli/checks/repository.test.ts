import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGit } from '#tests/setup/system/git.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { LOCAL_FILE_PATHS, LARGE_FILE_TABLES, LARGE_FILE_ATTRIBUTES } from '#tests/data/checks/repository.ts';

test(`local-files reports each tracked path that a scope's configurations leave untracked, once, including a path only in the Git index`, async () => {
    await using sandbox = await testdir();
    const { refused, allowed, scopes, indexOnly } = LOCAL_FILE_PATHS;
    const settings = buildSandboxSettings(['javascript'], { level: 'all', tables: scopes });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        ...Object.fromEntries([...refused, ...allowed].map((path) => [path, 'PUBLIC_EXAMPLE=value\n'])),
    });

    expect(runGit(sandbox.path, ['init', '-q']).code).toBe(0);
    const staged = runGit(sandbox.path, ['add', '-f', '.']);
    expect(staged.code, staged.stderr).toBe(0);

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'repository/local-files', { paths: [] });
    session.repository.index = [
        ...session.repository.index,
        ...session.repository.index,
        ...indexOnly.map((path) => ({ ...session.repository.index[0]!, path })),
    ];
    const found = await findBuiltInCheck('repository/local-files')(session, input);
    expect(found.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        [...refused, ...indexOnly].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(found.every(({ rule, line }) => rule === 'tracked-file' && line === 1)).toBe(true);
});

test('large files are reported in every scope except LFS, generated and vendored files, and pass once shrunk', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: LARGE_FILE_TABLES,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        '.gitattributes': LARGE_FILE_ATTRIBUTES,
        ...Object.fromEntries(
            ['big.bin', 'app/big.bin', 'lfs.bin', 'data/big.bin', 'vendor/big.bin'].map((path) => [
                path,
                Buffer.alloc(BYTES_PER_KILOBYTE + 1),
            ]),
        ),
        'small.txt': 'small',
    });

    expect(runGit(sandbox.path, ['init', '-q']).code).toBe(0);
    expect(runGit(sandbox.path, ['add', '-f', '.']).code).toBe(0);
    const failed = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['repository/large-files'] }),
    );

    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, rule, line }) => ({ file, rule, line }))),
    ).toStrictEqual([
        { file: 'app/big.bin', rule: 'size', line: 1 },
        { file: 'big.bin', rule: 'size', line: 1 },
    ]);
    await writeFile(join(sandbox.path, 'app/big.bin'), Buffer.alloc(BYTES_PER_KILOBYTE));
    await writeFile(join(sandbox.path, 'big.bin'), Buffer.alloc(BYTES_PER_KILOBYTE));

    expect(runGit(sandbox.path, ['add', '-f', 'app/big.bin', 'big.bin']).code).toBe(0);
    const fixed = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['repository/large-files'] }),
    );

    expect(fixed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
