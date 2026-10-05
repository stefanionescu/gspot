// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { gspot, spawnGspot } from '#tests/harness/gspot.ts';
import type { CommandFailureJson } from '#cli/types/output.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { PUSH_CHECK_ARGV } from '#tests/config/cli/commands/push.ts';
import type { PushRepository } from '#tests/types/cli/commands/push.ts';

/** Creates reviewed and broken commits beneath conflicting working-tree bytes for push selection. */
async function preparePushRepository(root: string): Promise<PushRepository> {
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'changed.sh': 'echo base\n',
        'legacy.sh': 'if then\n',
    });
    commitAll(root);
    const base = gitOutput(root, ['rev-parse', 'HEAD']);
    writeFileSync(join(root, 'changed.sh'), 'echo reviewed\n');
    gitOutput(root, ['add', 'changed.sh']);
    gitOutput(root, ['commit', '-qm', 'reviewed']);
    const reviewed = gitOutput(root, ['rev-parse', 'HEAD']);
    gitOutput(root, ['branch', 'reviewed', reviewed]);
    writeFileSync(join(root, 'changed.sh'), 'if then\n');
    gitOutput(root, ['add', 'changed.sh']);
    gitOutput(root, ['commit', '-qm', 'unreviewed']);
    const broken = gitOutput(root, ['rev-parse', 'HEAD']);
    writeFileSync(join(root, 'changed.sh'), 'echo repaired only in the working tree\n');
    writeFileSync(join(root, 'gspot.toml'), 'invalid working policy');
    return { base, reviewed, broken, command: PUSH_CHECK_ARGV, zero: '0'.repeat(base.length) };
}

/** Require the pushed tree and uncommitted source and policy to stay unchanged. */
function expectWorkingTreeKept(root: string, head: string): void {
    expect(gitOutput(root, ['rev-parse', 'HEAD'])).toBe(head);
    expect(readFileSync(join(root, 'gspot.toml'), 'utf8')).toBe('invalid working policy');
    expect(readFileSync(join(root, 'changed.sh'), 'utf8')).toBe('echo repaired only in the working tree\n');
}

test('new references compare against fetched objects using default and mapped destinations', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
    expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]).code).toBe(0);
    const createdRef = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(createdRef.code, createdRef.stdout + createdRef.stderr).toBe(0);
    expect((JSON.parse(createdRef.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]).code).toBe(0);
    const mapped = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(mapped.code, mapped.stdout + mapped.stderr).toBe(0);
    expect((JSON.parse(mapped.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed]);
    expectWorkingTreeKept(sandbox.path, broken);
});

test('negative fetch selectors exclude comparison objects until replaced by an exact mapping', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
    expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
    expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]).code).toBe(0);
    expect(git(sandbox.path, ['config', '--add', 'remote.origin.fetch', '^refs/heads/main']).code).toBe(0);
    const excluded = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(1);
    expect(
        new Set(
            (JSON.parse(excluded.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ),
    ).toStrictEqual(new Set(['legacy.sh']));
    expect(git(sandbox.path, ['config', '--unset-all', 'remote.origin.fetch']).code).toBe(0);
    expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/main:refs/fetched/origin/main']).code).toBe(
        0,
    );
    const exact = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(exact.code, exact.stdout + exact.stderr).toBe(0);
    expect((JSON.parse(exact.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed]);
    expectWorkingTreeKept(sandbox.path, broken);
});

test('new references without fetched comparison objects check the full tree', async () => {
    await using sandbox = await testdir();
    const { reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
    const noFetched = await spawnGspot(
        sandbox.path,
        command.slice(0, -2).concat('unseen', 'unused'),
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
    expectWorkingTreeKept(sandbox.path, broken);
});

test('annotated tags resolve to commits while deleted and non-commit references are not applicable', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
    expect(git(sandbox.path, ['tag', '-a', '-m', 'reviewed tag', 'reviewed-tag', reviewed]).code).toBe(0);
    const tag = git(sandbox.path, ['rev-parse', 'reviewed-tag']).stdout.trim();
    const tagged = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/tags/reviewed-tag ${tag} refs/tags/reviewed-tag ${base}\n` },
    );
    expect(tagged.code, tagged.stdout + tagged.stderr).toBe(0);
    expect((JSON.parse(tagged.stdout) as PushReport).revisions[0]!.object).toBe(reviewed);
    const deleted = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `(delete) ${zero} refs/heads/main ${broken}\n` },
    );
    expect(deleted.code, deleted.stdout + deleted.stderr).toBe(0);
    const skipped = JSON.parse(deleted.stdout) as PushReport;
    expect(skipped.revisions).toStrictEqual([]);
    expect(skipped.skipped[0]!.reason).toBe('deleted ref');
    const blob = git(sandbox.path, ['hash-object', '-w', 'changed.sh']).stdout.trim();
    const nonCommit = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/tags/data ${blob} refs/tags/data ${zero}\n` },
    );
    expect(nonCommit.code, nonCommit.stdout + nonCommit.stderr).toBe(0);
    expect((JSON.parse(nonCommit.stdout) as PushReport).skipped[0]!.reason).toBe('non-commit object');
    expectWorkingTreeKept(sandbox.path, broken);
});

test('missing remote comparison objects fail selection without touching the working tree', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
    const missing = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/main ${'f'.repeat(base.length)}\n` },
    );
    expect(missing.code, missing.stdout + missing.stderr).toBe(2);
    expect((JSON.parse(missing.stdout) as CommandFailureJson).error).toBe('selection');
    expectWorkingTreeKept(sandbox.path, broken);
});

test('pre-push checks exact supplied objects despite conflicting working-tree repairs', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
    const passing = await spawnGspot(
        sandbox.path,
        command,
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
    const failing = await spawnGspot(
        sandbox.path,
        command,
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
    expectWorkingTreeKept(sandbox.path, broken);
});

test('pre-push text supplies an executable reproduction of the same committed findings', async () => {
    await using sandbox = await testdir();
    const { base, broken, command } = await preparePushRepository(sandbox.path);
    const failing = await spawnGspot(
        sandbox.path,
        command,
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
    expectWorkingTreeKept(sandbox.path, broken);
});

test('pre-push reports multiple objects once per object and handles forced rewinds', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
    const multiple = await spawnGspot(
        sandbox.path,
        command,
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
    const duplicated = await spawnGspot(
        sandbox.path,
        command,
        {},
        {
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/one ${base}\nrefs/heads/also-reviewed ${reviewed} refs/heads/two ${base}\n`,
        },
    );
    expect(duplicated.code, duplicated.stdout + duplicated.stderr).toBe(0);
    const merged = JSON.parse(duplicated.stdout) as PushReport;
    expect(merged.revisions).toHaveLength(1);
    expect(merged.revisions[0]!.refs).toHaveLength(2);
    const forced = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/heads/rewound ${base} refs/heads/main ${broken}\n` },
    );
    expect(forced.code, forced.stdout + forced.stderr).toBe(0);
    expect((JSON.parse(forced.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    expectWorkingTreeKept(sandbox.path, broken);
});
