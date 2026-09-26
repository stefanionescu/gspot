// Planted repository: a [[check]] entry of the repository itself, with an output format that gives file and line.
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { ENTRY } from '#tests/constants/acceptance/source/cli/checks.ts';

describe('a [[check]] entry', () => {
    test('reruns a repository check when an input outside its selected paths changes', async () => {
        const command = [
            process.execPath,
            '-e',
            "process.exit((await Bun.file('state.txt').text()) === 'valid' ? 0 : 1)",
        ];
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gitignore': '.gspot/\n',
            'gspot.toml': `version = 1
configurations = []

[[check]]
name = "notes/state"
command = ${JSON.stringify(command)}
paths = ["selected.txt"]
stage = "commit"
`,
            'selected.txt': 'unchanged trigger',
            'state.txt': 'invalid',
        });
        const failed = await run(sandbox.path, ['check', '--only', 'notes/state', '--json']);
        expect(failed.code).toBe(1);
        expect(reportSchema.parse(JSON.parse(failed.stdout)).checks).toMatchObject([
            { check: 'notes/state', status: 'fail' },
        ]);

        await Bun.write(join(sandbox.path, 'state.txt'), 'valid');
        const passed = await run(sandbox.path, ['check', '--only', 'notes/state', '--json']);
        expect(passed.code).toBe(0);
        expect(reportSchema.parse(JSON.parse(passed.stdout)).checks).toMatchObject([
            { check: 'notes/state', status: 'ok' },
        ]);

        await Bun.write(join(sandbox.path, 'state.txt'), 'invalid');
        const failedAgain = await run(sandbox.path, ['check', '--only', 'notes/state', '--json']);
        expect(failedAgain.code).toBe(1);
        expect(reportSchema.parse(JSON.parse(failedAgain.stdout)).checks).toMatchObject([
            { check: 'notes/state', status: 'fail' },
        ]);
    });

    test(
        'runs the command of the repository and reports file and line through its output format',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/a.sh': script,
                'notes/plan.txt': 'one\nFIXME later\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(
                sandbox.path,
                ['init', '--yes', '--configurations', 'bash', '--no-runner', '--no-ci', '--no-rules', '--no-install'],
                environment,
            );
            const policy = join(sandbox.path, 'gspot.toml');
            await Bun.write(policy, `${await Bun.file(policy).text()}${ENTRY}`);
            const check = await run(sandbox.path, ['check', '--only', 'notes/no-fixme', '--json'], environment);
            expect(check.code).toBe(1);
            expect(reportSchema.parse(JSON.parse(check.stdout)).checks).toMatchObject([
                {
                    check: 'notes/no-fixme',
                    status: 'fail',
                    findings: [{ file: 'notes/plan.txt', line: 2, message: 'FIXME later' }],
                },
            ]);
            await Bun.write(join(sandbox.path, 'notes/plan.txt'), 'one\nCompleted task\n');
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'notes/no-fixme', '--json', '--no-cache'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'notes/no-fixme', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS,
    );
});

test('a declared check maps nested JSON output into findings', async () => {
    const diagnostic = {
        files: [
            { path: 'source.txt', messages: [{ row: 0, column: 2, code: 'sandbox-rule', text: 'A planted defect.' }] },
        ],
    };
    const command = [
        process.execPath,
        '-e',
        `if ((await Bun.file('source.txt').text()) === 'defect') { console.log(${JSON.stringify(JSON.stringify(diagnostic))}); process.exitCode = 1; } else console.log(JSON.stringify({files:[]}));`,
    ];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'defect',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "sandbox/json"
command = ${JSON.stringify(command)}
paths = ["source.txt"]
stage = "commit"
[check.output]
format = "json"
items = "files"
children = "messages"
line_base = 0
[check.output.fields]
file = "path"
line = "row"
column = "column"
rule = "code"
message = "text"
`,
    });
    const result = await run(sandbox.path, ['check', '--json']);
    expect(result.code).toBe(1);
    const report = reportSchema.parse(JSON.parse(result.stdout));
    expect(report.checks).toMatchObject([{ check: 'sandbox/json', status: 'fail' }]);
    expect(report.checks[0]?.findings).toMatchObject([
        {
            check: 'sandbox/json',
            file: 'source.txt',
            line: 1,
            column: 3,
            rule: 'sandbox-rule',
            message: 'A planted defect.',
        },
    ]);
    await Bun.write(join(sandbox.path, 'source.txt'), 'corrected');
    const corrected = await run(sandbox.path, ['check', '--json', '--no-cache']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
        { check: 'sandbox/json', status: 'ok', findings: [] },
    ]);
});
