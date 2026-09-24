import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
// Planted repository: a [[check]] entry of the repository itself, with an output format that gives file and line.
import type { RunReport } from '#cli/output/schema.ts';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { renameSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';

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

test.each([
    { scope: 'root', policy: 'version = 1\nconfigurations = ["bas"]\n', line: 2 },
    {
        scope: 'nested',
        policy: 'version = 1\nconfigurations = []\n[[scope]]\npath = "api"\nconfigurations = ["bas"]\n',
        line: 5,
    },
])(
    'unknown configurations in the $scope scope identify their declaration and accept the suggested configuration',
    async ({ policy, line }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/example.toml': 'value = 1\n' });
        const invalid = await run(sandbox.path, ['list', '--json']);
        expect(invalid.code).toBe(2);
        const diagnostic = JSON.parse(invalid.stdout);
        expect(diagnostic.message).toContain(`gspot.toml:${String(line)}:`);
        expect(diagnostic.message).toContain('bash');
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('"bas"', '"bash"'));
        const corrected = await run(sandbox.path, ['list', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test.each([
    {
        name: 'a root loosening',
        policy: 'version = 1\nconfigurations = ["bash"]\nrequire_reasons = true\n[limits]\nfile_lines = 1000\n',
        line: 5,
        before: '1000',
        after: '200',
    },
    {
        name: 'a nested unknown setting',
        policy: 'version = 1\nconfigurations = ["bash"]\n[[scope]]\npath = "api"\n[scope.limits]\nfile_linse = 200\n',
        line: 6,
        before: 'file_linse',
        after: 'file_lines',
    },
])('effective-setting errors locate $name and accept a correction', async ({ policy, line, before, after }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.sh': 'echo example\n' });
    const invalid = await run(sandbox.path, ['list', '--json']);
    expect(invalid.code).toBe(2);
    expect(JSON.parse(invalid.stdout).message).toContain(`gspot.toml:${String(line)}:`);
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace(before, after));
    const corrected = await run(sandbox.path, ['list', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each(['\n', '\r\n'])(
    'configuration errors retain source locations in text and JSON with %j lines',
    async (newline) => {
        await using sandbox = await testdir();
        const policy = ['version = 1', 'configurations = []', 'require_reasons = "wrong"', ''].join(newline);
        await createFileTree(sandbox.path, { 'gspot.toml': policy });
        const text = await run(sandbox.path, ['check']);
        expect(text.code).toBe(2);
        expect(text.stdout + text.stderr).toContain('gspot.toml:3:19: require_reasons:');
        const json = await run(sandbox.path, ['check', '--json']);
        expect(json.code).toBe(2);
        expect(JSON.parse(json.stdout)).toMatchObject({
            error: 'PolicyError',
            message: expect.stringContaining('gspot.toml:3:19:'),
        });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('"wrong"', 'true'));
        const corrected = await run(sandbox.path, ['check', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

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
        const failed = await run(sandbox.path, ['check', '--only', 'notes/state']);
        expect(failed.code).toBe(1);
        expect(failed.stdout).toContain('notes/state');

        await Bun.write(join(sandbox.path, 'state.txt'), 'valid');
        const passed = await run(sandbox.path, ['check', '--only', 'notes/state']);
        expect(passed.code).toBe(0);
        expect(passed.stdout).toContain('1 check passed, 0 checks failed');

        await Bun.write(join(sandbox.path, 'state.txt'), 'invalid');
        const failedAgain = await run(sandbox.path, ['check', '--only', 'notes/state']);
        expect(failedAgain.code).toBe(1);
        expect(failedAgain.stdout).toContain('notes/state');
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = []\n${entries}`,
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
    expect(report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of report.checks)
        expect(new Set(check.findings.map((finding) => finding.message))).toStrictEqual(
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
    expect(skippedReport.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/one', 'skipped'],
        ['sandbox/two', 'skipped'],
        ['sandbox/three', 'fail'],
    ]);
    const relative = await run(sandbox.path, ['-C', 'src', 'check', 'selected.ts', '--only', 'sandbox/one', '--json']);
    expect(relative.code, relative.stdout + relative.stderr).toBe(1);
    const relativeReport = JSON.parse(relative.stdout) as RunReport;
    expect(relativeReport.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = []\n${definitions.join('\n')}`,
        'source.txt': 'input',
    });
    const checked = await run(sandbox.path, ['check', '--stage', stage, '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([[`sandbox/${stage}`, 'ok']]);
});

test('a scope path selects its checks and its reproduction command repeats the same findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1
level = "all"
configurations = []
[[scope]]
path = "api"
configurations = ["javascript", "naming"]
[[scope]]
path = "web"
configurations = ["javascript", "naming"]
`,
        'api/port.js': 'export const shellCommand = 1;\n',
        'web/port.js': 'export const shellCommand = 2;\n',
    });
    const selected = await run(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.checks.map((check) => check.scope)).toStrictEqual(['api']);
    const command = report.checks[0]?.reproduce;
    expect(command).toBeDefined();
    const repeated = await run(sandbox.path, [...command!.split(' ').slice(1), '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = JSON.parse(repeated.stdout) as RunReport;
    expect(repeatedReport.checks.flatMap((check) => check.findings)).toStrictEqual(
        report.checks.flatMap((check) => check.findings),
    );
});

test('declared cache inputs include ignored files and invalidate for changed, added, renamed, and deleted inputs', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        `
        const paths = await Array.fromAsync(new Bun.Glob('state/*.txt').scan('.'));
        const values = await Promise.all(paths.map((path) => Bun.file(path).text()));
        process.exit(values.length > 0 && values.every((value) => value === 'valid') ? 0 : 1);
    `,
    ];
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\nstate/\n',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/state"
command = ${JSON.stringify(command)}
paths = ["selected.txt"]
inputs = ["state/**/*.txt"]
stage = "commit"
`,
        'selected.txt': 'unchanged trigger',
        'state/current.txt': 'valid',
    });
    const args = ['check', '--only', 'project/state', '--json'];
    const first = await run(sandbox.path, args);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(JSON.parse(first.stdout).checks[0].status).toBe('ok');
    const cached = await run(sandbox.path, args);
    expect(cached.code, cached.stdout + cached.stderr).toBe(0);
    expect(JSON.parse(cached.stdout).checks[0].status).toBe('cache');
    await Bun.write(join(sandbox.path, 'state/current.txt'), 'invalid');
    const changed = await run(sandbox.path, args);
    expect(changed.code).toBe(1);
    expect(JSON.parse(changed.stdout).checks[0].check).toBe('project/state');
    await Bun.write(join(sandbox.path, 'state/current.txt'), 'valid');
    expect((await run(sandbox.path, args)).code).toBe(0);
    await Bun.write(join(sandbox.path, 'state/added.txt'), 'invalid');
    expect((await run(sandbox.path, args)).code).toBe(1);
    unlinkSync(join(sandbox.path, 'state/added.txt'));
    expect((await run(sandbox.path, args)).code).toBe(0);
    renameSync(join(sandbox.path, 'state/current.txt'), join(sandbox.path, 'state/renamed.txt'));
    const renamed = await run(sandbox.path, args);
    expect(renamed.code).toBe(0);
    expect(JSON.parse(renamed.stdout).checks[0].status).toBe('ok');
    unlinkSync(join(sandbox.path, 'state/renamed.txt'));
    expect((await run(sandbox.path, args)).code).toBe(1);
});

test.each([{ inputs: [] }, { inputs: ['../outside'] }, { inputs: ['/outside'] }, { inputs: [String.raw`state\file`] }])(
    'invalid cache inputs %j refuse the check before its command writes',
    async ({ inputs }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'selected.txt': 'authored',
            'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/state"
command = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("selected.txt", "changed")'])}
paths = ["selected.txt"]
inputs = ${JSON.stringify(inputs)}
stage = "commit"
`,
        });
        expect((await run(sandbox.path, ['check'])).code).toBe(2);
        expect(await Bun.file(join(sandbox.path, 'selected.txt')).text()).toBe('authored');
    },
);

test('a declared symlink input invalidates the cached verdict when its target changes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\nstate/\n',
        'state/.keep': '',
        'target.txt': 'valid',
        'selected.txt': 'authored',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/linked-input"
command = ${JSON.stringify([process.execPath, '-e', 'process.exit((await Bun.file("state/input.txt").text()) === "valid" ? 0 : 1)'])}
paths = ["selected.txt"]
inputs = ["state/**/*.txt"]
stage = "commit"
`,
    });
    symlinkSync('../target.txt', join(sandbox.path, 'state/input.txt'));
    const args = ['check', '--only', 'project/linked-input', '--json'];
    expect((await run(sandbox.path, args)).code).toBe(0);
    const cached = await run(sandbox.path, args);
    expect(cached.code).toBe(0);
    expect(JSON.parse(cached.stdout).checks[0].status).toBe('cache');
    await Bun.write(join(sandbox.path, 'target.txt'), 'invalid');
    expect((await run(sandbox.path, args)).code).toBe(1);
    await Bun.write(join(sandbox.path, 'target.txt'), 'valid');
    expect((await run(sandbox.path, args)).code).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'selected.txt')).text()).toBe('authored');
});
