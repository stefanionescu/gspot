import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { planChecks } from '#cli/engine/plan.ts';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/engine.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { unlink, symlink, writeFile } from 'node:fs/promises';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runChecks, runCheckCode, buildCheckSession } from '#cli/engine/run.ts';
import { LOCAL_FILE_PATHS, LARGE_FILE_TABLES } from '#tests/config/configurations/general.ts';
import { runSandboxCheck, getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions, CHECK_GENERATION, createRunResources } from '#tests/setup/cli/run.ts';

test(`local-files reports each tracked path that a scope's configurations leave untracked, once, including a path only in the Git index`, async () => {
    await using sandbox = await createGitSandbox({});
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
    expect(found.map(({ file }) => file).toSorted(compareText)).toStrictEqual(
        [...refused, ...indexOnly].toSorted(compareText),
    );
});

test('conflict-markers reports each marker line of a text file at level basic, and passes once resolved', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { level: 'basic' }),
        'notes.txt': 'intro\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n',
        'heading.md': '=== Three signs\n<<<<<<<< eight signs\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'repository/conflict-markers');
    expect(findings.map(({ file, line }) => [file, line])).toStrictEqual([
        ['notes.txt', 2],
        ['notes.txt', 4],
        ['notes.txt', 6],
    ]);
    await writeFile(join(sandbox.path, 'notes.txt'), 'intro\nours\n');
    expect(await runSandboxCheck(sandbox.path, 'repository/conflict-markers')).toStrictEqual([]);
});

test('large files are reported in every scope except LFS, generated and vendored files, and pass once shrunk', async () => {
    await using sandbox = await createGitSandbox({});
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
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual(['app/big.bin', 'big.bin'].map((file) => ({ file, rule: 'size' })));
    await writeFile(join(sandbox.path, 'app/big.bin'), Buffer.alloc(BYTES_PER_KILOBYTE));
    await writeFile(join(sandbox.path, 'big.bin'), Buffer.alloc(BYTES_PER_KILOBYTE));

    runGitStep(sandbox.path, ['add', '-f', 'app/big.bin', 'big.bin']);
    const fixed = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['repository/large-files'] }),
    );

    expect(fixed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('a staged outward link plans local-files, and a run that stages another file leaves the link alone', async () => {
    await using outside = await testdir({ 'external.ts': 'export {};\n' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'notes.txt': 'notes\n',
    });
    await symlink(relative(sandbox.path, outside.path), join(sandbox.path, 'outside'), 'dir');
    runGitStep(sandbox.path, ['add', '-A']);
    using resources = createRunResources();
    const session = await openSession(sandbox.path, { resources });
    const run = async (staged: string[]): Promise<string[]> => {
        const [planned] = planChecks(session, { stage: 'commit', staged, only: ['repository/local-files'] });
        const check = planned as PlannedCheck;
        const result = await runCheckCode(
            buildCheckSession(session, CHECK_GENERATION),
            check,
            selectCheckCode(check.check),
            {},
        );
        return result.findings.map(({ file }) => file);
    };
    expect(await run(['outside'])).toStrictEqual(['outside']);
    expect(await run(['notes.txt'])).toStrictEqual([]);
});

test('a tracked outward symlink is a local-files finding', async () => {
    await using outside = await testdir({ 'external.ts': 'export {};\n' });
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    await symlink(relative(sandbox.path, outside.path), join(sandbox.path, 'outside'), 'dir');
    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-A']);
    const findings = await runSandboxCheck(sandbox.path, 'repository/local-files');
    expect(findings).toStrictEqual([
        expect.objectContaining({
            file: 'outside',
            line: 1,
            rule: 'outward-link',
            message: 'outside links outside the repository.',
        }),
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
        expect.objectContaining({
            file: 'latin1.md',
            line: 1,
            rule: 'encoding',
            message: 'latin1.md is not UTF-8 text. Save it as UTF-8, then run the command again.',
        }),
    ]);
});

test('large files use the size limit of their owning scope', async () => {
    await using sandbox = await createGitSandbox({
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
        expect.objectContaining({
            file: 'link.txt',
            rule: 'absolute-link',
            line: 1,
            message: 'link.txt uses an absolute link target.',
        }),
    ]);
    await unlink(join(sandbox.path, 'link.txt'));
    await writeFile(join(sandbox.path, 'link.txt'), 'Now a regular file.\n');
    expect(await runSandboxCheck(sandbox.path, 'repository/local-files')).toStrictEqual([]);
});
