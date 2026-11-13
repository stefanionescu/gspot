import { expect, test } from 'bun:test';

import { PUSH_CHECK_COMMAND } from '#tests/config/commands/check.ts';
import { PUSH_WORKING_TREE } from '#tests/config/setup/sandboxes.ts';
import { pushOutputSchema } from '#tests/schemas/setup.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox, preparePushRepository, readPushWorkingTree } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a new branch compares with the remote-tracking commit, and with a fetch mapping with the mapped commit', async () => {
    await using sandbox = await createGitSandbox({});
    const { base, reviewed, zero } = await preparePushRepository(sandbox.path);
    runGitStep(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    const protocol = { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` };
    const createdRef = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
    expect(createdRef.code, createdRef.stdout + createdRef.stderr).toBe(0);
    runGitStep(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']);
    runGitStep(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']);
    runGitStep(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]);
    const mapped = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, protocol);
    expect(mapped.code, mapped.stdout + mapped.stderr).toBe(1);
    const mappedReport = pushOutputSchema.parse(JSON.parse(mapped.stdout));
    expect(new Set(mappedReport.revisions[0]?.report.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['legacy.sh']),
    );
    expect(mappedReport.revisions[0]?.report.checks[0]?.fileCount).toBe(2);
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
    expect(pushOutputSchema.parse(JSON.parse(excluded.stdout)).revisions[0]?.commits).toStrictEqual([reviewed]);
    expect(await readPushWorkingTree(sandbox.path)).toStrictEqual({ head: broken, ...PUSH_WORKING_TREE });
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
    const { revisions } = pushOutputSchema.parse(JSON.parse(noRemote.stdout));
    expect(new Set(revisions[0]!.report.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['legacy.sh']),
    );
    expect(await readPushWorkingTree(sandbox.path)).toStrictEqual({ head: broken, ...PUSH_WORKING_TREE });
});
