// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { gspot, spawnGspot } from '#tests/harness/gspot.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
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
    return { base, reviewed, broken, command: [...PUSH_CHECK_ARGV, 'origin', 'unused'], zero: '0'.repeat(base.length) };
}

/** Require the pushed tree and uncommitted source and policy to stay unchanged. */
function expectWorkingTreeKept(root: string, head: string): void {
    expect(gitOutput(root, ['rev-parse', 'HEAD'])).toBe(head);
    expect(readFileSync(join(root, 'gspot.toml'), 'utf8')).toBe('invalid working policy');
    expect(readFileSync(join(root, 'changed.sh'), 'utf8')).toBe('echo repaired only in the working tree\n');
}

test('new references compare with remote-tracking commits and scan custom destinations conservatively', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
    expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]).code).toBe(0);
    const protocol = { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` };
    const createdRef = await spawnGspot(sandbox.path, command, {}, protocol);
    expect(createdRef.code, createdRef.stdout + createdRef.stderr).toBe(0);
    expect((JSON.parse(createdRef.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]).code).toBe(0);
    const mapped = await spawnGspot(sandbox.path, command, {}, protocol);
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
    expectWorkingTreeKept(sandbox.path, broken);
});

test('fetch mapping selectors do not override the native remote-tracking namespace', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
    expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
    expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(0);
    expect(git(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]).code).toBe(0);
    expect(git(sandbox.path, ['config', '--add', 'remote.origin.fetch', '^refs/heads/main']).code).toBe(0);
    const excluded = await spawnGspot(
        sandbox.path,
        command,
        {},
        { stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n` },
    );
    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
    expect((JSON.parse(excluded.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed]);
    expectWorkingTreeKept(sandbox.path, broken);
});

test('new references without fetched comparison objects check the full tree', async () => {
    await using sandbox = await testdir();
    const { reviewed, broken, zero } = await preparePushRepository(sandbox.path);
    const noFetched = await spawnGspot(
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
    expectWorkingTreeKept(sandbox.path, broken);
});

test('annotated commits resolve while blob tags, blobs, and deleted refs remain skipped', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
    gitOutput(sandbox.path, ['tag', '-a', '-m', 'reviewed tag', 'reviewed-tag', reviewed]);
    const tag = gitOutput(sandbox.path, ['rev-parse', 'reviewed-tag']);
    const blob = gitOutput(sandbox.path, ['hash-object', '-w', 'changed.sh']);
    gitOutput(sandbox.path, ['tag', '-a', '-m', 'data tag', 'data', blob]);
    const data = gitOutput(sandbox.path, ['rev-parse', 'refs/tags/data']);
    const selected = await spawnGspot(
        sandbox.path,
        command,
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
    expectWorkingTreeKept(sandbox.path, broken);
});

test.each(['local', 'remote'] as const)(
    'missing %s objects fail selection without touching the working tree',
    async (side) => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
        const missing = await spawnGspot(
            sandbox.path,
            command,
            {},
            {
                stdin: `refs/heads/reviewed ${side === 'local' ? 'f'.repeat(base.length) : reviewed} refs/heads/main ${side === 'remote' ? 'f'.repeat(base.length) : base}\n`,
            },
        );
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect((JSON.parse(missing.stdout) as CommandFailureJson).error).toBe('selection');
        expectWorkingTreeKept(sandbox.path, broken);
    },
);

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
    const trace = join(sandbox.path, 'git-trace.jsonl');
    const multiple = await spawnGspot(
        sandbox.path,
        command,
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
    const batches = readFileSync(trace, 'utf8')
        .split('\n')
        .filter(
            (line) => line.includes('"event":"start"') && line.includes('"--batch-check=%(objectname) %(objecttype)"'),
        );
    expect(batches).toHaveLength(1);
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

test.each(['origin', undefined, 'file:///unused', '/unused'] as const)(
    'the hook remote %s selects its native tracking range',
    async (remote) => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
        gitOutput(sandbox.path, ['remote', 'add', 'origin', 'unused']);
        gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
        gitOutput(sandbox.path, ['update-ref', 'refs/remotes/other/main', reviewed]);
        const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`;
        const selected = await selectPush(sandbox.path, protocol, remote);
        expect(selected.revisions[0]?.commits).toStrictEqual(remote === 'origin' ? [reviewed] : []);
        expect(selected.revisions[0]?.paths).toStrictEqual(remote === 'origin' ? ['changed.sh'] : []);
        expectWorkingTreeKept(sandbox.path, broken);
    },
);

test('native shallow ranges distinguish unobserved history from already advertised commits', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const { base, reviewed } = await preparePushRepository(source);
    const branch = gitOutput(source, ['branch', '--show-current']);
    gitOutput(sandbox.path, [
        'clone',
        '--quiet',
        '--depth=1',
        '--branch',
        'reviewed',
        pathToFileURL(source).href,
        'checkout',
    ]);
    const checkout = join(sandbox.path, 'checkout');
    gitOutput(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]);
    const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${'0'.repeat(reviewed.length)}\n`;
    const unobserved = await selectPush(checkout, protocol, 'unseen');
    expect(unobserved.revisions[0]).toMatchObject({ commits: [reviewed], historyComplete: false });
    expect(unobserved.revisions[0]?.paths).toStrictEqual(['changed.sh', 'gspot.toml', 'legacy.sh']);
    const advertised = await selectPush(checkout, protocol);
    expect(advertised.revisions[0]).toMatchObject({ commits: [], paths: [], historyComplete: true });
    gitOutput(checkout, ['fetch', '--unshallow']);
    const complete = await selectPush(checkout, protocol, 'unseen');
    expect(complete.revisions[0]).toMatchObject({ commits: [reviewed, base], historyComplete: true });
    expect(gitOutput(source, ['branch', '--show-current'])).toBe(branch);
});
