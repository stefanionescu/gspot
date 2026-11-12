import { symlink, unlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { BYTES_PER_KILOBYTE } from '#cli/config/engine.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession, runCheckCode, runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/checks.ts';
import { compareText } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { getBuiltInCheck, planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

const LOCAL_FILE_PATHS = {
    indexOnly: ['.env.'],
    refused: [
        '.env',
        '.env.local',
        '.env.example.local',
        'nested/.dev.vars.production',
        'node_modules/.env.example',
        'python/.venv/lib/package.py',
        'python/nested/venv/lib/package.py',
        'python/deep/.venv/lib/package.py',
        'swift/.build/output.bin',
        'sibling/node_modules/package/index.js',
        'sibling/.dev.vars',
    ],
    allowed: [
        '.env.example',
        'nested/.env.example',
        'python/node_modules/package/index.js',
        'swift/node_modules/package/index.js',
        'sibling/.venv/lib/package.py',
        '.venv/lib/package.py',
        '.build/output.bin',
        'python/source.py',
    ],
    scopes: `[[scope]]
path = "python"
configurations = ["python"]
removed_configurations = { javascript = "This scope uses its own language tools without JavaScript dependencies." }
[[scope]]
path = "python/deep"
[[scope]]
path = "swift"
configurations = ["swift"]
removed_configurations = { javascript = "This scope uses its own language tools without JavaScript dependencies." }
[[scope]]
path = "sibling"
`,
} as const;

const LARGE_FILE_TABLES = `[[scope]]
path = "app"

[repository]
max_file_kilobytes = 1
`;

test(`local-files reports each tracked path that a scope's configurations leave untracked, once, including a path only in the Git index`, async () => {
    const { refused, allowed, scopes, indexOnly } = LOCAL_FILE_PATHS;
    const settings = buildSandboxSettings(['javascript'], { level: 'all', tables: scopes });
    await using sandbox = await createGitSandbox({
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
        'support.rst': 'Support\n=======\n\nAsk on the forum.\n',
        'license.md': 'License\n=======\n\n>>>>>>> branch\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'repository/conflict-markers');
    expect(findings.map(({ file, line }) => [file, line])).toStrictEqual([
        ['license.md', 4],
        ['notes.txt', 2],
        ['notes.txt', 4],
        ['notes.txt', 6],
    ]);
});

test('large files are reported in every scope except LFS, generated and vendored files, and pass once shrunk', async () => {
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: LARGE_FILE_TABLES,
    });
    await using sandbox = await createGitSandbox({
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

    expect(listFindingRows(fixed.report)).toStrictEqual([]);
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
    const run = async (staged: string[]) => {
        const [planned] = planChecks(session, {
            stage: 'commit',
            selection: { content: 'index', paths: staged },
            only: ['repository/local-files'],
        });
        const check = planned as PlannedCheck;
        const result = await runCheckCode(
            buildCheckSession(session, CHECK_GENERATION),
            check,
            selectCheckCode(check.check),
            {},
        );
        return result.findings.map(({ file, rule, line }) => ({ file, rule, line }));
    };
    expect(await run(['outside'])).toStrictEqual([{ file: 'outside', rule: 'outward-link', line: 1 }]);
    expect(await run(['notes.txt'])).toStrictEqual([]);
});

test('oversized and invalid UTF-8 files leave other checks, and the invalid UTF-8 file gets one encoding finding', async () => {
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
            message: expect.stringContaining('latin1.md') as string,
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
            message: expect.stringContaining('link.txt') as string,
        }),
    ]);
    await unlink(join(sandbox.path, 'link.txt'));
    await writeFile(join(sandbox.path, 'link.txt'), 'Now a regular file.\n');
    expect(await runSandboxCheck(sandbox.path, 'repository/local-files')).toStrictEqual([]);
});
