import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { TYPO } from '#tests/config/harness/spelling.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkedFindings } from '#cli/execution/output.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { PENDING } from '#tests/config/cli/execution/parse-output/declared-checks.ts';

const ENTRY = String.raw`configurations = []

[[check]]
name = "notes/no-pending"
command = ${JSON.stringify([process.execPath, '-e', PENDING, '{files}'])}
paths = ["notes/**"]
stage = "commit"
finding_count_pattern = "PENDING"
summary = "Finds pending notes left in the notes folder."

[check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`;

test('pin verification treats a rate limit as an execution error and accepts a completed read', async () => {
    const failure = '429 Too Many Requests';
    await using sandbox = await testdir();
    const workflow = 'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['actions']),
        '.github/workflows/check.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'push', skips: [], only: ['actions/pinact'] });
    const planned = plans[0]!;
    const result = {
        code: 1,
        stdout: '',
        stderr: `ERROR failed to handle a line: GET https://api.github.com/repos/actions/checkout/commits/v4: ${failure}`,
        missing: false,
        duration: 1,
    };
    expect(() => checkedFindings(planned, result, { cwd: sandbox.path, root: sandbox.path })).toThrow(GspotError);
    expect(
        checkedFindings(
            planned,
            { ...result, stderr: 'invalid action pin: .github/workflows/check.yml:4' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual([
        containing({
            check: 'actions/pinact',
            message: 'invalid action pin: .github/workflows/check.yml:4',
        }),
    ]);
    expect(
        checkedFindings(planned, { ...result, code: 0, stderr: '' }, { cwd: sandbox.path, root: sandbox.path }),
    ).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, '.github/workflows/check.yml')).text()).toBe(workflow);
});

test('spelling distinguishes native findings from fatal exits for configuration and declared checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['spelling']),
        'sample.txt': `${TYPO.the}\n`,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', only: ['spelling/typos'], skips: [] });
    const planned = plans[0]!;
    const declared = { ...planned };
    delete declared.manifest;
    const stdout = JSON.stringify({
        type: 'typo',
        path: 'sample.txt',
        line_num: 1,
        byte_offset: 0,
        typo: TYPO.the,
        corrections: ['the'],
    });
    const result = { stdout, stderr: '', code: 2, missing: false, duration: 1 };
    for (const check of [planned, declared]) {
        expect(checkedFindings(check, result, { cwd: sandbox.path, root: sandbox.path })).toMatchObject([
            { file: 'sample.txt' },
        ]);
        expect(() =>
            checkedFindings(
                check,
                { ...result, code: 78, stderr: 'Invalid native configuration.' },
                { cwd: sandbox.path, root: sandbox.path },
            ),
        ).toThrow(GspotError);
        expect(() =>
            checkedFindings(check, { ...result, stdout: '' }, { cwd: sandbox.path, root: sandbox.path }),
        ).toThrow(GspotError);
        expect(
            checkedFindings(check, { ...result, stdout: '', code: 0 }, { cwd: sandbox.path, root: sandbox.path }),
        ).toStrictEqual([]);
    }
});

test('source text naming module errors stays an ESLint finding', async () => {
    await using sandbox = await testdir();
    const path = 'source.ts';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
        [path]: 'const message = "ERR_MODULE_NOT_FOUND";\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', skips: [], only: ['javascript/eslint'] });
    const planned = plans[0]!;
    const stdout = JSON.stringify([
        {
            filePath: join(sandbox.path, path),
            source: 'const message = "ERR_MODULE_NOT_FOUND"; // ConfigError:',
            messages: [{ ruleId: 'no-unused-vars', severity: 2, message: 'Unused message.', line: 1, column: 7 }],
        },
    ]);
    const result = { stdout, stderr: '', code: 1, missing: false, duration: 1 };
    expect(checkedFindings(planned, result, { cwd: sandbox.path, root: sandbox.path })).toMatchObject([
        { file: path, rule: 'no-unused-vars', line: 1, column: 7 },
    ]);
    expect(() =>
        checkedFindings(
            planned,
            { ...result, code: 2, stderr: 'ConfigError: invalid configuration' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toThrow(GspotError);
    expect(() =>
        checkedFindings(
            planned,
            { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toThrow('ERR_MODULE_NOT_FOUND: plugin');
});

test('a [[check]] entry > reruns a repository check when an input outside its selected paths changes', async () => {
    const command = [process.execPath, '-e', "process.exit((await Bun.file('state.txt').text()) === 'valid' ? 0 : 1)"];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\n',
        'gspot.toml': `configurations = []

[[check]]
name = "notes/state"
command = ${JSON.stringify(command)}
paths = ["selected.txt"]
stage = "commit"
`,
        'selected.txt': 'unchanged trigger',
        'state.txt': 'invalid',
    });
    const failed = await runGspot(sandbox.path, ['check', '--only', 'notes/state', '--json']);
    expect(failed.code).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([{ check: 'notes/state', status: 'failed' }]);

    await Bun.write(join(sandbox.path, 'state.txt'), 'valid');
    const passed = await runGspot(sandbox.path, ['check', '--only', 'notes/state', '--json']);
    expect(passed.code).toBe(0);
    expect((JSON.parse(passed.stdout) as RunReport).checks).toMatchObject([{ check: 'notes/state', status: 'passed' }]);

    await Bun.write(join(sandbox.path, 'state.txt'), 'invalid');
    const failedAgain = await runGspot(sandbox.path, ['check', '--only', 'notes/state', '--json']);
    expect(failedAgain.code).toBe(1);
    expect((JSON.parse(failedAgain.stdout) as RunReport).checks).toMatchObject([
        { check: 'notes/state', status: 'failed' },
    ]);
});

test('a [[check]] entry > runs the command of the repository and reports file and line through its output format', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': ENTRY, 'notes/plan.txt': 'one\nPENDING later\n' });
    const check = await runGspot(sandbox.path, ['check', '--only', 'notes/no-pending', '--json']);
    expect(check.code, check.stdout + check.stderr).toBe(1);
    expect((JSON.parse(check.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'notes/no-pending',
            status: 'failed',
            findings: [{ file: 'notes/plan.txt', line: 2, message: 'PENDING later' }],
        },
    ]);
    await Bun.write(join(sandbox.path, 'notes/plan.txt'), 'one\nCompleted task\n');
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'notes/no-pending', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'notes/no-pending', status: 'passed', findings: [] },
    ]);
});

test('a declared check maps nested JSON output into findings', async () => {
    const diagnostic = {
        files: [
            { path: 'source.txt', messages: [{ row: 0, column: 2, code: 'sandbox-rule', text: 'A test defect.' }] },
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
        'gspot.toml': `configurations = []
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
    const result = await runGspot(sandbox.path, ['check', '--only', 'sandbox/json', '--json']);
    expect(result.code).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'sandbox/json', status: 'failed' }]);
    expect(report.checks[0]?.findings).toMatchObject([
        {
            check: 'sandbox/json',
            file: 'source.txt',
            line: 1,
            column: 3,
            rule: 'sandbox-rule',
            message: 'A test defect.',
        },
    ]);
    await Bun.write(join(sandbox.path, 'source.txt'), 'corrected');
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'sandbox/json', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'sandbox/json', status: 'passed', findings: [] },
    ]);
});
