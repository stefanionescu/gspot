import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { BASH_SYNTAX_CHECK, PENDING_NOTES_SCRIPT, PENDING_NOTE_RESULTS } from '#tests/config/runs/command.ts';

test('a command check runs its command and reports file and line through its output format', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: String.raw`[[command_check]]
id = "notes/no-pending"
command = ${JSON.stringify([process.execPath, '-e', PENDING_NOTES_SCRIPT, '{files}'])}
paths = ["notes/**"]
stage = "commit"
summary = "Finds pending notes left in the notes folder."

[command_check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        }),
        'notes/plan.txt': 'one\nPENDING later\n',
    });

    const check = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'notes/no-pending', '--json']));
    expect(check.code, check.stdout + check.stderr).toBe(1);
    expect(check.report.checks).toMatchObject([...PENDING_NOTE_RESULTS]);
});

test.skipIf(isWindows)('a command check reports files whose folder names hold a colon or a newline', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    const paths = ['source\nfiles/greet.sh', 'source:files/greet.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        ...Object.fromEntries(paths.map((path) => [path, 'if then\n'])),
    });
    const options = buildRunOptions({ only: ['project/bash-syntax'] });
    const broken = await runChecks(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(
        [...new Set(broken.report.checks[0]!.findings.map((finding) => finding.file))].toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(paths);
});
