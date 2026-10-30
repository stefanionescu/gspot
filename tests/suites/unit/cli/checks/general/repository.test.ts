import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { unlink, symlink, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { LOCAL_FILE_PATHS, LARGE_FILE_TABLES } from '#tests/config/checks/general/general.ts';
import { runSandboxCheck, getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

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
    const found = await getBuiltInCheck('repository/local-files')(session, input);
    expect(found.toSorted((left, right) => compareText(left.file, right.file))).toStrictEqual(
        [...refused, ...indexOnly].toSorted(compareText).map((file) => ({
            check: 'repository/local-files',
            file,
            line: 1,
            rule: 'tracked-file',
            fixable: false,
            help: 'Add the reported file or folder to .gitignore and remove it from the index with `git rm --cached`.',
            message: `${file} is tracked; its selected configuration declares it untracked. Remove it from the Git index and add it to .gitignore.`,
        })),
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

    expect(failed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
        ['app/big.bin', 'big.bin'].map((file) => ({
            check: 'repository/large-files',
            file,
            rule: 'size',
            line: 1,
            fixable: false,
            message:
                '1 kB is over the 1 kB limit; mark it as generated or vendored in .gitattributes, move it to LFS, or ignore this finding with a reason.',
            help: 'Track the file with Git LFS, classify it as generated or vendored in .gitattributes, or raise repository.max_file_kilobytes with a reason.',
        })),
    );
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
    await symlink(relative(sandbox.path, outside.path), join(sandbox.path, 'outside'), 'dir');
    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-A']);
    const findings = await runSandboxCheck(sandbox.path, 'repository/local-files');
    expect(findings).toStrictEqual([
        {
            check: 'repository/local-files',
            file: 'outside',
            line: 1,
            rule: 'outward-link',
            fixable: false,
            message: 'outside links outside the repository.',
            help: 'Replace the link with the file or folder it points to, or delete it.',
        },
    ]);
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
    expect(await runSandboxCheck(sandbox.path, 'repository/encoding')).toStrictEqual([
        {
            check: 'repository/encoding',
            file: 'latin1.md',
            line: 1,
            fixable: false,
            help: 'Save the reported file as UTF-8, then run the check again.',
            rule: 'encoding',
            message: 'latin1.md is not UTF-8 text. Save it as UTF-8, then run the command again.',
        },
    ]);
});

test('large files use the size limit of their owning scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: '[repository]\nmax_file_kilobytes = 1\n[[scope]]\npath = "app"\n[scope.repository]\nmax_file_kilobytes = 2\n',
        }),
        'root.bin': Buffer.alloc(BYTES_PER_KILOBYTE + 1),
        'app/accepted.bin': Buffer.alloc(BYTES_PER_KILOBYTE + 1),
    });
    expect(await runSandboxCheck(sandbox.path, 'repository/large-files')).toMatchObject([
        { file: 'root.bin', rule: 'size' },
    ]);
});

test('absolute links inside the repository are reported and an indexed link replaced by a file is ignored', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'source.txt': 'Source.\n',
    });
    await symlink(join(sandbox.path, 'source.txt'), join(sandbox.path, 'link.txt'));
    runGitStep(sandbox.path, ['add', 'link.txt']);
    expect(await runSandboxCheck(sandbox.path, 'repository/local-files')).toStrictEqual([
        {
            check: 'repository/local-files',
            file: 'link.txt',
            rule: 'absolute-link',
            line: 1,
            fixable: false,
            message: 'link.txt uses an absolute link target.',
            help: 'Use a relative link target inside the repository.',
        },
    ]);
    await unlink(join(sandbox.path, 'link.txt'));
    await writeFile(join(sandbox.path, 'link.txt'), 'Now a regular file.\n');
    expect(await runSandboxCheck(sandbox.path, 'repository/local-files')).toStrictEqual([]);
});
