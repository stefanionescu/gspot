// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { gspot, runGspot } from '#tests/harness/gspot.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { PUSH_CONTENT } from '#tests/config/samples/git.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { git, gitOutput, preparePushRepository } from '#tests/harness/git.ts';
import { PUSH_CHECK_ARGV, PUSH_CHECK_COMMAND } from '#tests/config/cli/commands/check/pre-push.ts';

/** Require the pushed tree and uncommitted source and policy to stay unchanged. */
async function expectWorkingTreeKept(root: string, head: string): Promise<void> {
    expect(gitOutput(root, ['rev-parse', 'HEAD'])).toBe(head);
    expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(PUSH_CONTENT.policy);
    expect(await readFile(join(root, 'changed.sh'), 'utf8')).toBe(PUSH_CONTENT.working);
}

test('new references compare with remote-tracking commits and scan custom destinations conservatively', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]).code).toBe(0);
    const protocol = { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` };
    const originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
    const createdRef = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
    expect(createdRef.code, createdRef.stdout + createdRef.stderr).toBe(0);
    expect(Object.getOwnPropertyDescriptor(process, 'stdin')).toStrictEqual(originalStdin);
    expect((JSON.parse(createdRef.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]).code).toBe(0);
    const mapped = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
    expect(mapped.code, mapped.stdout + mapped.stderr).toBe(1);
    expect((JSON.parse(mapped.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed, base]);
    expect(
        new Set(
            (JSON.parse(mapped.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ),
    ).toStrictEqual(new Set(['legacy.sh']));
    expect((JSON.parse(mapped.stdout) as PushReport).revisions[0]?.report.checks[0]?.fileCount).toBe(2);
    await expectWorkingTreeKept(sandbox.path, broken);
});

test('fetch mapping selectors do not override the native remote-tracking namespace', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
    expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]).code).toBe(0);
    expect(git(sandbox.path, ['config', '--add', 'remote.origin.fetch', '^refs/heads/main']).code).toBe(0);
    const excluded = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
    expect((JSON.parse(excluded.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed]);
    await expectWorkingTreeKept(sandbox.path, broken);
});

test('new references without fetched comparison objects check the full tree', async () => {
    await using sandbox = await testdir();
    const { reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    const noFetched = await runGspot(
        sandbox.path,
        [...PUSH_CHECK_ARGV, 'unseen', 'unused'],
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(noFetched.code, noFetched.stdout + noFetched.stderr).toBe(1);
    expect(
        new Set(
            (JSON.parse(noFetched.stdout) as PushReport).revisions[0]!.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ),
    ).toStrictEqual(new Set(['legacy.sh']));
    await expectWorkingTreeKept(sandbox.path, broken);
});

test('annotated commits resolve while blob tags, blobs, and deleted refs remain skipped', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    gitOutput(sandbox.path, ['tag', '-a', '-m', 'reviewed tag', 'reviewed-tag', reviewed]);
    const tag = gitOutput(sandbox.path, ['rev-parse', 'reviewed-tag']);
    const blob = gitOutput(sandbox.path, ['hash-object', '-w', 'changed.sh']);
    gitOutput(sandbox.path, ['tag', '-a', '-m', 'data tag', 'data', blob]);
    const data = gitOutput(sandbox.path, ['rev-parse', 'refs/tags/data']);
    const selected = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        {
            stdin: `refs/tags/reviewed-tag ${tag} refs/tags/reviewed-tag ${base}\nrefs/tags/data ${data} refs/tags/data ${'e'.repeat(base.length)}\nrefs/tags/blob ${blob} refs/tags/blob ${zero}\n(delete) ${zero} refs/heads/removed ${'f'.repeat(base.length)}\n`,
        },
    );
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const report = JSON.parse(selected.stdout) as PushReport;
    expect(report.revisions.map(({ object: hash }) => hash)).toStrictEqual([reviewed]);
    expect(report.skipped).toStrictEqual([
        { ref: 'refs/tags/data', object: data, reason: 'non-commit object' },
        { ref: 'refs/tags/blob', object: blob, reason: 'non-commit object' },
        { ref: 'refs/heads/removed', object: zero, reason: 'deleted ref' },
    ]);
    await expectWorkingTreeKept(sandbox.path, broken);
});

test.each(['local', 'remote'] as const)(
    'missing %s objects fail selection without touching the working tree',
    async (side) => {
        await using sandbox = await testdir();
        const { base, reviewed, broken } = await preparePushRepository(sandbox.path);
        const missing = await runGspot(
            sandbox.path,
            PUSH_CHECK_COMMAND,
            {},
            {
                stdin: `refs/heads/reviewed ${side === 'local' ? 'f'.repeat(base.length) : reviewed} refs/heads/main ${side === 'remote' ? 'f'.repeat(base.length) : base}\n`,
            },
        );
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect((JSON.parse(missing.stdout) as CommandFailureJson).error).toBe('selection');
        await expectWorkingTreeKept(sandbox.path, broken);
    },
);

test('pre-push checks exact supplied objects despite conflicting working-tree repairs', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken } = await preparePushRepository(sandbox.path);
    const passing = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/reviewed ${base}\n` },
    );
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    const first = (JSON.parse(passing.stdout) as PushReport).revisions;
    expect(first).toHaveLength(1);
    const firstReport = first[0]!.report;
    expect(firstReport.comparison).toStrictEqual({ content: 'commit', reference: reviewed });
    expect(firstReport.checks[0]?.status).toBe('passed');
    expect(firstReport.checks[0]?.fileCount).toBe(1);
    const failing = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n` },
    );
    expect(failing.code, failing.stdout + failing.stderr).toBe(1);
    expect(
        new Set(
            (JSON.parse(failing.stdout) as PushReport).revisions[0]!.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ),
    ).toStrictEqual(new Set(['changed.sh']));
    await expectWorkingTreeKept(sandbox.path, broken);
});

test('pre-push text supplies an executable reproduction of the same committed findings', async () => {
    await using sandbox = await testdir();
    const { base, broken } = await preparePushRepository(sandbox.path);
    const failing = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n` },
    );
    expect(failing.code, failing.stdout + failing.stderr).toBe(1);
    const failedReport = (JSON.parse(failing.stdout) as PushReport).revisions[0]!.report;
    const reproduction = failedReport.checks[0]?.reproduce;
    expect(reproduction).toBeDefined();
    const repeated = await runTestCommand(
        [
            'bash',
            '-c',
            'runtime=$1; cli=$2; gspot() { "$runtime" "$cli" "$@"; }; eval "$3"',
            'reproduce',
            process.execPath,
            gspot,
            reproduction!.replace('gspot check', 'gspot check --json'),
        ],
        { cwd: sandbox.path },
    );
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = JSON.parse(repeated.stdout) as PushReport;
    expect(repeatedReport.revisions[0]?.object).toBe(broken);
    expect(repeatedReport.revisions[0]?.report.checks[0]?.findings).toStrictEqual(failedReport.checks[0]?.findings);
    await expectWorkingTreeKept(sandbox.path, broken);
});

test('pre-push reports multiple objects once per object and handles forced rewinds', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken } = await preparePushRepository(sandbox.path);
    const trace = join(sandbox.path, 'git-trace.jsonl');
    const multiple = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        { GIT_TRACE2_EVENT: trace },
        {
            stdin: `refs/heads/broken ${broken} refs/heads/one ${base}\nrefs/heads/reviewed ${reviewed} refs/heads/two ${base}\n`,
        },
    );
    expect(multiple.code, multiple.stdout + multiple.stderr).toBe(1);
    const pushed = JSON.parse(multiple.stdout) as PushReport;
    expect(pushed.revisions.map((revision) => revision.report.exitCode)).toStrictEqual([1, 0]);
    expect(pushed.revisions.map((revision) => revision.report.comparison?.reference)).toStrictEqual([broken, reviewed]);
    expect(
        new Set(pushed.revisions[0]!.report.checks.flatMap((check) => check.findings.map((finding) => finding.file))),
    ).toStrictEqual(new Set(['changed.sh']));
    expect(pushed.revisions[1]!.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
    const entries = await readFile(trace, 'utf8');
    const batches = entries
        .split('\n')
        .filter(
            (line) => line.includes('"event":"start"') && line.includes('"--batch-check=%(objectname) %(objecttype)"'),
        );
    expect(batches).toHaveLength(1);
    const duplicated = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        {
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/one ${base}\nrefs/heads/also-reviewed ${reviewed} refs/heads/two ${base}\n`,
        },
    );
    expect(duplicated.code, duplicated.stdout + duplicated.stderr).toBe(0);
    const merged = JSON.parse(duplicated.stdout) as PushReport;
    expect(merged.revisions).toHaveLength(1);
    expect(merged.revisions[0]!.refs).toHaveLength(2);
    const forced = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/rewound ${base} refs/heads/main ${broken}\n` },
    );
    expect(forced.code, forced.stdout + forced.stderr).toBe(0);
    expect((JSON.parse(forced.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    await expectWorkingTreeKept(sandbox.path, broken);
});
