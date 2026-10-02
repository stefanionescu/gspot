// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { git } from '#tests/harness/cli/git.ts';
import * as processes from '#cli/platform/spawn.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { gspot, runGspot } from '#tests/harness/cli/command.ts';
import type { CommandFailureJson } from '#cli/types/commands/commands.ts';
import { expectWorkingTreeKept, preparePushRepository } from '#tests/harness/planted/push.ts';

test(
    'new references compare against fetched objects using default and mapped destinations',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
        expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
        expect(git(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]).code).toBe(0);
        const createdRef = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(createdRef.code, createdRef.stdout + createdRef.stderr).toBe(0);
        expect((JSON.parse(createdRef.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
        expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(
            0,
        );
        expect(git(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']).code).toBe(0);
        expect(git(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]).code).toBe(0);
        const mapped = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(mapped.code, mapped.stdout + mapped.stderr).toBe(0);
        expect((JSON.parse(mapped.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed]);
        expectWorkingTreeKept(sandbox.path, broken);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'negative fetch selectors exclude comparison objects until replaced by an exact mapping',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
        expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
        expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(
            0,
        );
        expect(git(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]).code).toBe(0);
        expect(git(sandbox.path, ['config', '--add', 'remote.origin.fetch', '^refs/heads/main']).code).toBe(0);
        const excluded = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(excluded.code, excluded.stdout + excluded.stderr).toBe(1);
        expect(
            (JSON.parse(excluded.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ).toStrictEqual(['legacy.sh', 'legacy.sh']);
        expect(git(sandbox.path, ['config', '--unset-all', 'remote.origin.fetch']).code).toBe(0);
        expect(
            git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/main:refs/fetched/origin/main']).code,
        ).toBe(0);
        const exact = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(exact.code, exact.stdout + exact.stderr).toBe(0);
        expect((JSON.parse(exact.stdout) as PushReport).revisions[0]?.commits).toStrictEqual([reviewed]);
        expectWorkingTreeKept(sandbox.path, broken);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'new references without fetched comparison objects check the full tree',
    async () => {
        await using sandbox = await testdir();
        const { reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
        const noFetched = await processes.run(command.slice(0, -2).concat('unseen', 'unused'), {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(noFetched.code, noFetched.stdout + noFetched.stderr).toBe(1);
        expect(
            (JSON.parse(noFetched.stdout) as PushReport).revisions[0]!.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ).toStrictEqual(['legacy.sh', 'legacy.sh']);
        expectWorkingTreeKept(sandbox.path, broken);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'annotated tags resolve to commits while deleted and non-commit references are not applicable',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command, zero } = await preparePushRepository(sandbox.path);
        expect(git(sandbox.path, ['tag', '-a', '-m', 'reviewed tag', 'reviewed-tag', reviewed]).code).toBe(0);
        const tag = git(sandbox.path, ['rev-parse', 'reviewed-tag']).stdout.trim();
        const tagged = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/tags/reviewed-tag ${tag} refs/tags/reviewed-tag ${base}\n`,
        });
        expect(tagged.code, tagged.stdout + tagged.stderr).toBe(0);
        expect((JSON.parse(tagged.stdout) as PushReport).revisions[0]!.object).toBe(reviewed);
        const deleted = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `(delete) ${zero} refs/heads/main ${broken}\n`,
        });
        expect(deleted.code, deleted.stdout + deleted.stderr).toBe(0);
        const skipped = JSON.parse(deleted.stdout) as PushReport;
        expect(skipped.revisions).toStrictEqual([]);
        expect(skipped.notApplicable[0]!.reason).toBe('deleted ref');
        const blob = git(sandbox.path, ['hash-object', '-w', 'changed.sh']).stdout.trim();
        const nonCommit = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/tags/data ${blob} refs/tags/data ${zero}\n`,
        });
        expect(nonCommit.code, nonCommit.stdout + nonCommit.stderr).toBe(0);
        expect((JSON.parse(nonCommit.stdout) as PushReport).notApplicable[0]!.reason).toBe('non-commit object');
        expectWorkingTreeKept(sandbox.path, broken);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'missing remote comparison objects fail selection without touching the working tree',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
        const missing = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/main ${'f'.repeat(base.length)}\n`,
        });
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect((JSON.parse(missing.stdout) as CommandFailureJson).error).toBe('selection');
        expectWorkingTreeKept(sandbox.path, broken);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'pre-push checks exact supplied objects despite conflicting working-tree repairs',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
        const passing = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/reviewed ${base}\n`,
        });
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        const first = (JSON.parse(passing.stdout) as PushReport).revisions;
        expect(first).toHaveLength(1);
        const firstReport = first[0]!.report;
        expect(firstReport.comparison).toStrictEqual({ content: 'commit', reference: reviewed });
        expect(firstReport.checks[0]?.status).toBe('passed');
        expect(firstReport.checks[0]?.fileCount).toBe(1);
        const failing = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n`,
        });
        expect(failing.code, failing.stdout + failing.stderr).toBe(1);
        expect(
            (JSON.parse(failing.stdout) as PushReport).revisions[0]!.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ).toStrictEqual(['changed.sh', 'changed.sh']);
        expectWorkingTreeKept(sandbox.path, broken);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'pre-push text supplies an executable reproduction of the same committed findings',
    async () => {
        await using sandbox = await testdir();
        const { base, broken, command } = await preparePushRepository(sandbox.path);
        const failing = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n`,
        });
        const failedReport = (JSON.parse(failing.stdout) as PushReport).revisions[0]!.report;
        const reproduction = failedReport.checks[0]?.reproduce;
        expect(reproduction).toBeDefined();
        const repeated = await processes.run(
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
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'pre-push reports multiple objects once per object and handles forced rewinds',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
        const multiple = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/broken ${broken} refs/heads/one ${base}\nrefs/heads/reviewed ${reviewed} refs/heads/two ${base}\n`,
        });
        expect(multiple.code, multiple.stdout + multiple.stderr).toBe(1);
        const pushed = JSON.parse(multiple.stdout) as PushReport;
        expect(pushed.revisions.map((revision) => revision.report.exitCode)).toStrictEqual([1, 0]);
        expect(pushed.revisions.map((revision) => revision.report.comparison?.reference)).toStrictEqual([
            broken,
            reviewed,
        ]);
        expect(
            pushed.revisions.map((revision) => revision.report.checks.flatMap((check) => check.findings).length),
        ).toStrictEqual([2, 0]);
        const duplicated = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/one ${base}\nrefs/heads/also-reviewed ${reviewed} refs/heads/two ${base}\n`,
        });
        expect(duplicated.code, duplicated.stdout + duplicated.stderr).toBe(0);
        const merged = JSON.parse(duplicated.stdout) as PushReport;
        expect(merged.revisions).toHaveLength(1);
        expect(merged.revisions[0]!.refs).toHaveLength(2);
        const forced = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/rewound ${base} refs/heads/main ${broken}\n`,
        });
        expect(forced.code, forced.stdout + forced.stderr).toBe(0);
        expect((JSON.parse(forced.stdout) as PushReport).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
        expectWorkingTreeKept(sandbox.path, broken);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'full-tree pre-push policy checks unchanged files in the pushed object',
    async () => {
        await using sandbox = await testdir();
        const { broken, command } = await preparePushRepository(sandbox.path);
        writeFileSync(join(sandbox.path, 'gspot.toml'), policyOf(['bash'], '[hooks]\n[rules]\ninstall = false\n'));
        const configured = await runGspot(sandbox.path, ['set', 'hooks.push', 'all']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        expect(git(sandbox.path, ['add', 'gspot.toml', 'changed.sh']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'full pushed tree']).code).toBe(0);
        const pushedCommit = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        const all = await processes.run(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${pushedCommit} refs/heads/main ${broken}\n`,
        });
        expect(all.code, all.stdout + all.stderr).toBe(1);
        expect(
            (JSON.parse(all.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ).toStrictEqual(['legacy.sh', 'legacy.sh']);
    },
    PLANTED_TIMEOUT_MS,
);
