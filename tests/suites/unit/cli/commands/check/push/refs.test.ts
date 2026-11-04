import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { pushOutputSchema } from '#cli/schemas/commands.ts';
import type { CommandFailureJson } from '#cli/types/system.ts';
import { PUSH_CHECK_COMMAND } from '#tests/config/commands/check.ts';
import { createGitSandbox, assertWorkingTreeKept, preparePushRepository } from '#tests/setup/sandboxes/repositories.ts';

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
        message: expect.stringContaining(absent) as string,
    });
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
    const report = pushOutputSchema.parse(JSON.parse(pushed.stdout));
    expect(report.revisions.map(({ hash }) => hash)).toStrictEqual([reviewed]);
    expect(report.skipped).toStrictEqual([
        { ref: 'refs/tags/data', hash: tagged, reason: 'non-commit object' },
        { ref: 'refs/tags/blob', hash: blob, reason: 'non-commit object' },
        { ref: 'refs/heads/removed', hash: zero, reason: 'deleted ref' },
    ]);
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
    const pushed = pushOutputSchema.parse(JSON.parse(multiple.stdout));
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
        pushOutputSchema.parse(JSON.parse(duplicated.stdout)).revisions.map(({ hash, refs }) => ({ hash, refs })),
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
        { stdin: `refs/heads/rewound ${base} refs/heads/feature ${broken}\n` },
    );
    expect(forced.code, forced.stdout + forced.stderr).toBe(0);
    expect(pushOutputSchema.parse(JSON.parse(forced.stdout)).revisions[0]!.report.checks[0]?.fileCount).toBe(1);
    await assertWorkingTreeKept(sandbox.path, broken);
});
