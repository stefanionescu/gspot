import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { checkReportSchema, pushOutputSchema } from '#cli/schemas/commands.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import { PUSH_CHECK_COMMAND } from '#tests/config/commands/check.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { CHECK_COMMAND } from '#tests/config/setup/programs.ts';
import { BASH_SYNTAX_CHECK, BASH_SYNTAX_PUSH_CHECK } from '#tests/config/setup/sandboxes.ts';
import { CLI_BIN, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { assertWorkingTreeKept, createGitSandbox, preparePushRepository } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

async function runBrokenPushCheck(root: string, base: string, broken: string): Promise<RunReport> {
    const result = await runGspot(
        root,
        PUSH_CHECK_COMMAND,
        {},
        { stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n` },
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    return pushOutputSchema.parse(JSON.parse(result.stdout)).revisions[0]!.report;
}

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
    const repeatedReport = checkReportSchema.parse(JSON.parse(repeated.stdout));
    expect(repeatedReport.checks[0]?.findings).toStrictEqual(failedReport.checks[0]?.findings);
    runGitStep(sandbox.path, ['worktree', 'remove', '--force', checkout.path]);
    await assertWorkingTreeKept(sandbox.path, broken);
});

test('a pushed commit that changes gspot.toml checks every file of that commit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_PUSH_CHECK }),
        'changed.sh': 'echo base\n',
        'legacy.sh': BROKEN_IF_SCRIPT,
    });

    commitAll(sandbox.path);
    const base = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'changed.sh'), 'echo changed\n');
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_PUSH_CHECK + '[hooks]\n' }),
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
    const { revisions } = pushOutputSchema.parse(JSON.parse(all.stdout));
    expect(new Set(revisions[0]?.report.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['legacy.sh']),
    );
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
        expect(pushOutputSchema.parse(JSON.parse(skipped.stdout))).toMatchObject({
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

test('a pre-push run checks the push stage and leaves the commit stage to the commit hook', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_CHECK }),
        'entry.sh': 'echo base\n',
    });
    const base = commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'entry.sh'), BROKEN_IF_SCRIPT);
    const head = commitAll(sandbox.path, 'broken');
    const stdin = `refs/heads/main ${head} refs/heads/main ${base}\n`;
    const result = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, { stdin });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ exitCode: 0 });
});
