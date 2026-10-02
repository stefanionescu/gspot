// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/cli/git.ts';
import * as processes from '#cli/platform/spawn.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { preparePushRepository } from '#tests/harness/planted/push.ts';
import type { CommandFailureJson } from '#cli/types/commands/commands.ts';

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
        expect((JSON.parse(createdRef.stdout) as PushReport).revisions[0]!.report.checks[0]?.files).toBe(1);
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
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
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
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
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
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
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
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
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
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
    },
    PLANTED_TIMEOUT_MS,
);
