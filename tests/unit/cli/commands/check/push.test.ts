import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/processes.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { PUSH_CONTENT } from '#tests/data/test-setup.ts';
import { CLI_BIN, runGspot } from '#tests/setup/run-gspot.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { PUSH_CHECK_ARGUMENTS } from '#tests/data/parsers/git.ts';
import { PUSH_CHECK_COMMAND } from '#tests/data/commands/check.ts';
import { readGitOutput, preparePushRepository } from '#tests/setup/git.ts';

/** Require the pushed tree and uncommitted source and settings to stay unchanged. */
async function assertWorkingTreeKept(root: string, head: string): Promise<void> {
    expect(readGitOutput(root, ['rev-parse', 'HEAD'])).toBe(head);
    expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(PUSH_CONTENT.settings);
    expect(await readFile(join(root, 'changed.sh'), 'utf8')).toBe(PUSH_CONTENT.working);
}

async function checkBrokenPush(root: string, base: string, broken: string): Promise<RunReport> {
    const result = await runGspot(
        root,
        PUSH_CHECK_COMMAND,
        {},
        {
            stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n`,
        },
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    return (JSON.parse(result.stdout) as PushReport).revisions[0]!.report;
}

test.each(['local', 'remote'] as const)(
    'missing %s objects stop a pre-push check and leave the working tree as it was',
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
        expect((JSON.parse(missing.stdout) as CommandFailureJson).error).toBe('git');
        await assertWorkingTreeKept(sandbox.path, broken);
    },
);

test('new references compare with remote-tracking commits and scan custom destinations conservatively', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    readGitOutput(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    readGitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    const protocol = { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` };
    const createdRef = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
    expect(createdRef.code, createdRef.stdout + createdRef.stderr).toBe(0);
    expect((JSON.parse(createdRef.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    readGitOutput(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']);
    readGitOutput(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']);
    readGitOutput(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]);
    const mapped = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
    expect(mapped.code, mapped.stdout + mapped.stderr).toBe(1);
    const mappedReport = JSON.parse(mapped.stdout) as PushReport;
    expect(mappedReport.revisions[0]?.commits).toStrictEqual([reviewed, base]);
    expect(new Set(mappedReport.revisions[0]?.report.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['legacy.sh']),
    );
    expect(mappedReport.revisions[0]?.report.checks[0]?.fileCount).toBe(2);
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('fetch mapping selectors do not override the remote-tracking namespace', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    readGitOutput(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    readGitOutput(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']);
    readGitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    readGitOutput(sandbox.path, ['config', '--add', 'remote.origin.fetch', '^refs/heads/main']);
    const excluded = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
    expect((JSON.parse(excluded.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed]);
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('new references without fetched comparison objects check the full tree', async () => {
    await using sandbox = await testdir();
    const { reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    const noRemote = await runGspot(
        sandbox.path,
        [...PUSH_CHECK_ARGUMENTS, 'unseen', 'unused'],
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(noRemote.code, noRemote.stdout + noRemote.stderr).toBe(1);
    expect(
        new Set(
            (JSON.parse(noRemote.stdout) as PushReport).revisions[0]!.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ),
    ).toStrictEqual(new Set(['legacy.sh']));
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('an annotated tag of a commit is checked while blob tags, blobs, and deleted refs are skipped', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    readGitOutput(sandbox.path, ['tag', '-a', '-m', 'reviewed tag', 'reviewed-tag', reviewed]);
    const tag = readGitOutput(sandbox.path, ['rev-parse', 'reviewed-tag']);
    const blob = readGitOutput(sandbox.path, ['hash-object', '-w', 'changed.sh']);
    readGitOutput(sandbox.path, ['tag', '-a', '-m', 'data tag', 'data', blob]);
    const data = readGitOutput(sandbox.path, ['rev-parse', 'refs/tags/data']);
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
    expect(report.revisions.map(({ hash }) => hash)).toStrictEqual([reviewed]);
    expect(report.skipped).toStrictEqual([
        { ref: 'refs/tags/data', hash: data, reason: 'non-commit object' },
        { ref: 'refs/tags/blob', hash: blob, reason: 'non-commit object' },
        { ref: 'refs/heads/removed', hash: zero, reason: 'deleted ref' },
    ]);
    await assertWorkingTreeKept(sandbox.path, broken);
});

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
    const failedReport = await checkBrokenPush(sandbox.path, base, broken);
    expect(new Set(failedReport.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['changed.sh']),
    );
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('pre-push text supplies an executable reproduction of the same committed findings', async () => {
    await using sandbox = await testdir();
    const { base, broken } = await preparePushRepository(sandbox.path);
    const failedReport = await checkBrokenPush(sandbox.path, base, broken);
    const reproduction = failedReport.checks[0]?.reproduce;
    const repeated = await runCommand(
        [
            'bash',
            '-c',
            'runtime=$1; cli=$2; gspot() { "$runtime" "$cli" "$@"; }; eval "$3"',
            'reproduce',
            process.execPath,
            CLI_BIN,
            reproduction!.replace('gspot check', 'gspot check --json'),
        ],
        { cwd: sandbox.path },
    );
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = JSON.parse(repeated.stdout) as PushReport;
    expect(repeatedReport.revisions[0]?.hash).toBe(broken);
    expect(repeatedReport.revisions[0]?.report.checks[0]?.findings).toStrictEqual(failedReport.checks[0]?.findings);
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('pre-push runs one Git object batch for several pushed refs', async () => {
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
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('pre-push checks a commit pushed to two refs once', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken } = await preparePushRepository(sandbox.path);
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
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('pre-push of a forced rewind checks the rewound commit', async () => {
    await using sandbox = await testdir();
    const { base, broken } = await preparePushRepository(sandbox.path);
    const forced = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/rewound ${base} refs/heads/main ${broken}\n` },
    );
    expect(forced.code, forced.stdout + forced.stderr).toBe(0);
    expect((JSON.parse(forced.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    await assertWorkingTreeKept(sandbox.path, broken);
});
