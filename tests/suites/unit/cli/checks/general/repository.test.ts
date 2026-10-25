import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { symlink, writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { LOCAL_FILE_PATHS, LARGE_FILE_TABLES } from '#tests/config/checks/general/repository.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

test(`local-files reports each tracked path that a scope's configurations leave untracked, once, including a path only in the Git index`, async () => {
    await using sandbox = await testdir();
    const { refused, allowed, scopes, indexOnly } = LOCAL_FILE_PATHS;
    const settings = buildSandboxSettings(['javascript'], { level: 'all', tables: scopes });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        ...Object.fromEntries([...refused, ...allowed].map((path) => [path, 'PUBLIC_EXAMPLE=value\n'])),
    });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-f', '.']);

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'repository/local-files', { paths: [] });
    session.repository.index = [
        ...session.repository.index,
        ...session.repository.index,
        ...indexOnly.map((path) => ({ ...session.repository.index[0]!, path })),
    ];
    const found = await findBuiltInCheck('repository/local-files')(session, input);
    expect(
        found
            .map(({ file, line, rule }) => ({ file, line, rule }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual(
        [...refused, ...indexOnly]
            .toSorted((left, right) => left.localeCompare(right))
            .map((file) => ({ file, line: 1, rule: 'tracked-file' })),
    );
});

test('large files are reported in every scope except LFS, generated and vendored files, and pass once shrunk', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: LARGE_FILE_TABLES,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        '.gitattributes': `lfs.bin filter=lfs
data/** linguist-generated
vendor/** linguist-vendored
`,
        ...Object.fromEntries(
            ['big.bin', 'app/big.bin', 'lfs.bin', 'data/big.bin', 'vendor/big.bin'].map((path) => [
                path,
                Buffer.alloc(BYTES_PER_KILOBYTE + 1),
            ]),
        ),
        'small.txt': 'small',
    });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-f', '.']);
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

    runGitStep(sandbox.path, ['add', '-f', 'app/big.bin', 'big.bin']);
    const fixed = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['repository/large-files'] }),
    );

    expect(fixed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('a tracked outward symlink is a local-files finding', async () => {
    await using outside = await testdir({ 'external.ts': 'export {};\n' });
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    await symlink(outside.path, join(sandbox.path, 'outside'), 'dir');
    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-A']);
    const findings = await runSandboxCheck(sandbox.path, 'repository/local-files');
    expect(findings).toMatchObject([{ file: 'outside', rule: 'outward-link' }]);
});

test('oversized and invalid UTF-8 files get one repository finding and leave other checks', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { tables: '[repository]\nmax_file_kilobytes = 1\n' }),
        'large.md': 'x'.repeat(1025),
        'latin1.md': Buffer.from([35, 32, 67, 97, 102, 233]),
    });
    runGitStep(sandbox.path, ['add', '-A']);
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['format/prettier'] })[0]!;
    expect(planned.files.map(({ path }) => path)).not.toContain('large.md');
    expect(planned.files.map(({ path }) => path)).not.toContain('latin1.md');
    expect(await runSandboxCheck(sandbox.path, 'repository/encoding')).toMatchObject([
        {
            file: 'latin1.md',
            rule: 'encoding',
            message: 'latin1.md is not UTF-8 text. Save it as UTF-8, then run the command again.',
        },
    ]);
});
