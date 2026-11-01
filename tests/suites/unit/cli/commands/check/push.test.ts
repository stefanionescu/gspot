import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/engine/run.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { CommandFailureJson } from '#cli/types/system.ts';
import { CHECK_COMMAND } from '#tests/config/setup/programs.ts';
import type { PushReport } from '#cli/types/commands/reports.ts';
import { CLI_BIN, runGspot } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PUSH_CHECK_COMMAND } from '#tests/config/commands/check.ts';
import { PUSH_CONTENT, BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox, preparePushRepository } from '#tests/setup/sandboxes/repositories.ts';

async function assertWorkingTreeKept(root: string, head: string): Promise<void> {
    expect(runGitStep(root, ['rev-parse', 'HEAD'])).toBe(head);
    expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(PUSH_CONTENT.settings);
    expect(await readFile(join(root, 'changed.sh'), 'utf8')).toBe(PUSH_CONTENT.working);
}

async function runBrokenPushCheck(root: string, base: string, broken: string): Promise<RunReport> {
    const result = await runGspot(
        root,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n` },
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    return (JSON.parse(result.stdout) as PushReport).revisions[0]!.report;
}

test('a missing local commit stops a pre-push check and leaves the working tree as it was', async () => {
    await using sandbox = await createGitSandbox({});
    const { base, broken } = await preparePushRepository(sandbox.path);
    const absent = 'f'.repeat(base.length);
    const missing = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        {
            stdin: `refs/heads/reviewed ${absent} refs/heads/main ${base}\n`,
        },
    );
    expect(missing.code, missing.stdout + missing.stderr).toBe(2);
    expect(JSON.parse(missing.stdout) as CommandFailureJson).toMatchObject({
        error: 'git',
        message: `Cannot find the commit ${absent} that the push sends.`,
    });
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('a new branch compares with the remote-tracking commit, and with a fetch mapping with the mapped commit', async () => {
    await using sandbox = await createGitSandbox({});
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    runGitStep(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    const protocol = { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` };
    const createdRef = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
    expect(createdRef.code, createdRef.stdout + createdRef.stderr).toBe(0);
    expect((JSON.parse(createdRef.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    runGitStep(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']);
    runGitStep(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']);
    runGitStep(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]);
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

test('a new branch still compares with refs/remotes/origin/main when the fetch refspecs map branches elsewhere or exclude main', async () => {
    await using sandbox = await createGitSandbox({});
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    runGitStep(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    runGitStep(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    runGitStep(sandbox.path, ['config', '--add', 'remote.origin.fetch', '^refs/heads/main']);
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

test('a new branch whose remote has no fetched commits checks every file of the tree', async () => {
    await using sandbox = await createGitSandbox({});
    const { reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    const noRemote = await runGspot(
        sandbox.path,
        [...PUSH_CHECK_COMMAND.slice(0, -2), 'unseen', 'unused'],
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
    await using sandbox = await createGitSandbox({});
    const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    runGitStep(sandbox.path, ['tag', '-a', '-m', 'reviewed tag', 'reviewed-tag', reviewed]);
    const tag = runGitStep(sandbox.path, ['rev-parse', 'reviewed-tag']);
    const blob = runGitStep(sandbox.path, ['hash-object', '-w', 'changed.sh']);
    runGitStep(sandbox.path, ['tag', '-a', '-m', 'data tag', 'data', blob]);
    const tagged = runGitStep(sandbox.path, ['rev-parse', 'refs/tags/data']);
    const pushed = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
        {
            stdin: `refs/tags/reviewed-tag ${tag} refs/tags/reviewed-tag ${base}\nrefs/tags/data ${tagged} refs/tags/data ${'e'.repeat(base.length)}\nrefs/tags/blob ${blob} refs/tags/blob ${zero}\n(delete) ${zero} refs/heads/removed ${'f'.repeat(base.length)}\n`,
        },
    );
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
    const report = JSON.parse(pushed.stdout) as PushReport;
    expect(report.revisions.map(({ hash }) => hash)).toStrictEqual([reviewed]);
    expect(report.skipped).toStrictEqual([
        { ref: 'refs/tags/data', hash: tagged, reason: 'non-commit object' },
        { ref: 'refs/tags/blob', hash: blob, reason: 'non-commit object' },
        { ref: 'refs/heads/removed', hash: zero, reason: 'deleted ref' },
    ]);
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('the pre-push report prints a command that reproduces the same findings', async () => {
    await using sandbox = await createGitSandbox({});
    const { base, broken } = await preparePushRepository(sandbox.path);
    const failedReport = await runBrokenPushCheck(sandbox.path, base, broken);
    const reproduction = failedReport.checks.map(({ rerun }) => rerun);
    expect(reproduction).toStrictEqual([`gspot check --only project/bash-syntax --base ${base.slice(0, 7)}`]);
    await using checkout = await testdir();
    runGitStep(sandbox.path, ['worktree', 'add', '--detach', checkout.path, broken]);
    const repeated = await runCommand(
        [
            'bash',
            '-c',
            'runtime=$1; cli=$2; gspot() { "$runtime" "$cli" "$@"; }; eval "$3"',
            'rerun',
            process.execPath,
            CLI_BIN,
            reproduction[0]!.replace(CHECK_COMMAND, 'gspot check --json'),
        ],
        { cwd: checkout.path },
    );
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = JSON.parse(repeated.stdout) as RunReport;
    expect(repeatedReport.checks[0]?.findings).toStrictEqual(failedReport.checks[0]?.findings);
    runGitStep(sandbox.path, ['worktree', 'remove', '--force', checkout.path]);
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('pre-push reports each pushed ref against its own commit', async () => {
    await using sandbox = await createGitSandbox({});
    const { base, reviewed, broken } = await preparePushRepository(sandbox.path);
    const multiple = await runGspot(
        sandbox.path,
        PUSH_CHECK_COMMAND,
        {},
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
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('pre-push checks a commit pushed to two refs once', async () => {
    await using sandbox = await createGitSandbox({});
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
    expect(
        (JSON.parse(duplicated.stdout) as PushReport).revisions.map(({ hash, refs }) => ({ hash, refs })),
    ).toStrictEqual([{ hash: reviewed, refs: ['refs/heads/reviewed', 'refs/heads/also-reviewed'] }]);
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('pre-push of a forced rewind checks the rewound commit', async () => {
    await using sandbox = await createGitSandbox({});
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

test('a pushed commit that changes gspot.toml checks every file of that commit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'changed.sh': 'echo base\n',
        'legacy.sh': BROKEN_IF_SCRIPT,
    });

    commitAll(sandbox.path);
    const base = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'changed.sh'), 'echo changed\n');
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK + '[hooks]\n' }),
    );
    runGitStep(sandbox.path, ['add', 'gspot.toml', 'changed.sh']);
    runGitStep(sandbox.path, ['commit', '-qm', 'full pushed tree']);
    const pushedCommit = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    const all = await runGspot(
        sandbox.path,
        ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json', '--', 'origin', 'unused'],
        {},
        {
            stdin: `refs/heads/main ${pushedCommit} refs/heads/main ${base}\n`,
        },
    );
    expect(all.code, all.stdout + all.stderr).toBe(1);
    expect(
        new Set(
            (JSON.parse(all.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ),
    ).toStrictEqual(new Set(['legacy.sh']));
});

test('push skips pre-adoption and unchanged refs without opening a copy or parsing settings', async () => {
    await using sandbox = await createGitSandbox({ 'legacy.sh': 'echo before adoption\n' });
    const preAdoption = commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    const adopted = commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), 'invalid = [');
    await writeFile(join(sandbox.path, '.gspot-copies'), 'A copy cannot be created here.');
    for (const [hash, remoteHash, reason] of [
        [preAdoption, '0'.repeat(preAdoption.length), 'the commit has no gspot.toml'],
        [adopted, adopted, 'no changed paths'],
    ] as const) {
        const protocol = { stdin: `refs/heads/legacy ${hash} refs/heads/legacy ${remoteHash}\n` };
        const skipped = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
        expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
        expect(JSON.parse(skipped.stdout) as PushReport).toMatchObject({
            revisions: [],
            skipped: [{ ref: 'refs/heads/legacy', hash, reason }],
            exitCode: 0,
        });
        const text = await runGspot(
            sandbox.path,
            PUSH_CHECK_COMMAND.filter((argument) => argument !== '--json'),
            {},
            protocol,
        );
        expect(text.stdout).toBe(`refs/heads/legacy: ${reason}; no checks apply.\n`);
    }
    expect(await readFile(join(sandbox.path, '.gspot-copies'), 'utf8')).toBe('A copy cannot be created here.');
});
