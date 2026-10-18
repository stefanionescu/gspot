import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { PENDING_NOTES_SCRIPT } from '#tests/data/runs/command-checks.ts';

test('a command check runs its command and reports file and line through its output format', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': String.raw`configurations = []

[[command_check]]
name = "notes/no-pending"
command = ${JSON.stringify([process.execPath, '-e', PENDING_NOTES_SCRIPT, '{files}'])}
paths = ["notes/**"]
stage = "commit"
summary = "Finds pending notes left in the notes folder."

[command_check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        'notes/plan.txt': 'one\nPENDING later\n',
    });
    const check = await checkReport(sandbox.path, ['check', '--only', 'notes/no-pending', '--json']);
    expect(check.code, check.stdout + check.stderr).toBe(1);
    expect(check.report.checks).toMatchObject([
        {
            check: 'notes/no-pending',
            status: 'failed',
            findings: [{ file: 'notes/plan.txt', line: 2, message: 'PENDING later' }],
        },
    ]);
});
