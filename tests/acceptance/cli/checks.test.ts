// Planted repository: a [[check]] entry of the repository itself, with an output format that gives file and line.
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import type { RunReport } from '#types/report.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const ENTRY = String.raw`
[[check]]
name = "notes/no-fixme"
command = ["grep", "-n", "-H", "FIXME", "{files}"]
paths = ["notes/**"]
stage = "commit"
count_regex = "FIXME"
summary = "Finds FIXME notes left in the notes folder."

[check.output]
format = "regex"
pattern = "^(?<file>[^:]+):(?<line>\\d+):(?<message>.*)$"
`;

describe('a [[check]] entry', () => {
    test('reruns a repository check when an input outside its selected paths changes', async () => {
        const command = [
            process.execPath,
            '-e',
            "process.exit((await Bun.file('state.txt').text()) === 'valid' ? 0 : 1)",
        ];
        await using sandbox = await createSandbox({
            '.gitignore': '.gspot/\n',
            'gspot.toml': `version = 1
presets = []

[[check]]
name = "notes/state"
command = ${JSON.stringify(command)}
paths = ["selected.txt"]
stage = "commit"
`,
            'selected.txt': 'unchanged trigger',
            'state.txt': 'invalid',
        });
        const failed = await run(sandbox.path, ['check', '--only', 'notes/state']);
        expect(failed.code).toBe(1);
        expect(failed.stdout).toContain('notes/state');

        await Bun.write(join(sandbox.path, 'state.txt'), 'valid');
        const passed = await run(sandbox.path, ['check', '--only', 'notes/state']);
        expect(passed.code).toBe(0);
        expect(passed.stdout).toContain('notes/state');

        await Bun.write(join(sandbox.path, 'state.txt'), 'invalid');
        const failedAgain = await run(sandbox.path, ['check', '--only', 'notes/state']);
        expect(failedAgain.code).toBe(1);
        expect(failedAgain.stdout).toContain('notes/state');
    });

    test(
        'runs the command of the repository and reports file and line through its output format',
        async () => {
            await using sandbox = await createSandbox({
                'scripts/a.sh': script,
                'notes/plan.txt': 'one\nFIXME later\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'bash',
                    '--runner',
                    'none',
                    '--ci',
                    'none',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const policy = join(sandbox.path, 'gspot.toml');
            await Bun.write(policy, `${await Bun.file(policy).text()}${ENTRY}`);
            const check = await run(sandbox.path, ['check', '--only', 'notes/no-fixme'], environment);
            expect(check.code).toBe(1);
            expect(check.stdout).toContain('notes/plan.txt:2');
            expect(check.stdout).toContain('FIXME later');
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
        `console.log(${JSON.stringify(JSON.stringify(diagnostic))}); process.exitCode = 1;`,
    ];
    await using sandbox = await createSandbox({
        'source.txt': 'defect',
        'gspot.toml': `version = 1
presets = []
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
    const report = JSON.parse(result.stdout) as RunReport;
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
});

test('file and folder arguments intersect check lists and respect -C', async () => {
    const command = [
        process.execPath,
        '-e',
        'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;',
        '{files}',
    ];
    const entries = ['one', 'two', 'three']
        .map(
            (name) => `
[[check]]
name = "sandbox/${name}"
command = ${JSON.stringify(command)}
paths = ["src/**", "docs/**"]
stage = "commit"
[check.output]
format = "lines"
`,
        )
        .join('');
    await using sandbox = await createSandbox({
        'gspot.toml': `version = 1\npresets = []\n${entries}`,
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
        'docs/guide.md': '# Guide\n',
    });
    const selected = await run(sandbox.path, [
        'check',
        'src/selected.ts',
        'docs',
        '--only',
        'sandbox/one',
        'sandbox/two',
        '--json',
    ]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.checks.map((check) => check.check)).toEqual(['sandbox/one', 'sandbox/two']);
    for (const check of report.checks)
        expect(new Set(check.findings.map((finding) => finding.message))).toEqual(
            new Set(['docs/guide.md', 'src/selected.ts']),
        );
    const skipped = await run(sandbox.path, [
        'check',
        'src/selected.ts',
        '--skip',
        'sandbox/one',
        'sandbox/two',
        '--json',
    ]);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(1);
    const skippedReport = JSON.parse(skipped.stdout) as RunReport;
    expect(skippedReport.checks.map((check) => [check.check, check.status])).toEqual([
        ['sandbox/one', 'skipped'],
        ['sandbox/two', 'skipped'],
        ['sandbox/three', 'fail'],
    ]);
    const relative = await run(sandbox.path, ['-C', 'src', 'check', 'selected.ts', '--only', 'sandbox/one', '--json']);
    expect(relative.code, relative.stdout + relative.stderr).toBe(1);
    const relativeReport = JSON.parse(relative.stdout) as RunReport;
    expect(relativeReport.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toEqual([
        'src/selected.ts',
    ]);
});

test.each(['commit', 'push', 'manual'])('--stage %s runs the checks assigned to that stage', async (stage) => {
    const definitions = ['commit', 'push', 'manual'].map(
        (name) => `
[[check]]
name = "sandbox/${name}"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "${name}"
`,
    );
    await using sandbox = await createSandbox({
        'gspot.toml': `version = 1\npresets = []\n${definitions.join('\n')}`,
        'source.txt': 'input',
    });
    const checked = await run(sandbox.path, ['check', '--stage', stage, '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toEqual([[`sandbox/${stage}`, 'ok']]);
});
