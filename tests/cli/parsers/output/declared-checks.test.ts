import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { checkedFindings } from '#cli/execution/command/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { PENDING } from '#tests/config/cli/parsers/output/declared-checks.ts';

const ENTRY = String.raw`configurations = []

[check."notes/no-pending"]
command = ${JSON.stringify([process.execPath, '-e', PENDING, '{files}'])}
paths = ["notes/**"]
stage = "commit"
finding_count_pattern = "PENDING"
summary = "Finds pending notes left in the notes folder."

[check."notes/no-pending".output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`;

test('a declared regex check verifies reported files only when it has a configuration manifest', async () => {
    await using sandbox = await testdir();
    const source = 'unchanged input\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: String.raw`[check."notes/regex"]
command = ${JSON.stringify([process.execPath, '-e', ''])}
paths = ["notes/**"]
stage = "commit"
[check."notes/regex".output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        }),
        'notes/selected.txt': source,
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'all', only: ['notes/regex'], skips: [] })[0]!;
    const configured = { ...planned, manifest: configurationManifests().get('files')! };
    const result = { code: 1, stdout: 'notes/reported.txt:1:A defect.', stderr: '', missing: false, duration: 1 };
    const paths = { root: sandbox.path, cwd: sandbox.path };
    const expected = [{ check: 'notes/regex', file: 'notes/reported.txt', line: 1, message: 'A defect.' }];
    expect(planned.manifest).toBeUndefined();
    expect(checkedFindings(planned, result, paths)).toMatchObject(expected);
    expect(() => checkedFindings(configured, result, paths)).toThrow(GspotError);
    await Bun.write(join(sandbox.path, 'notes/reported.txt'), source);
    expect(checkedFindings(configured, result, paths)).toMatchObject(expected);
    expect(checkedFindings(planned, result, paths)).toStrictEqual(checkedFindings(configured, result, paths));
    expect(await Bun.file(join(sandbox.path, 'notes/selected.txt')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'notes/reported.txt')).text()).toBe(source);
});

test('a named check entry > reruns a command check when an input outside its selected paths changes', async () => {
    const command = [process.execPath, '-e', "process.exit((await Bun.file('state.txt').text()) === 'valid' ? 0 : 1)"];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': '.gspot/\n',
        'gspot.toml': `configurations = []

[check."notes/state"]
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

test('a named check entry > runs the command of the repository and reports file and line through its output format', async () => {
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

test('malformed custom JSON output produces inability instead of a discarded finding', async () => {
    const output = '{ broken';
    await using sandbox = await testdir();
    const program = `process.stdout.write(${JSON.stringify(output)})`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: `[check."sandbox/json"]\ncommand = ${JSON.stringify([process.execPath, '-e', program])}\npaths = ["source.txt"]\nstage = "commit"\n[check."sandbox/json".output]\nformat = "json"\n`,
        }),
        'source.txt': 'original',
    });
    const cli = await runGspot(sandbox.path, ['check', '--only', 'sandbox/json', '--json']);
    expect(cli.code, cli.stdout + cli.stderr).toBe(2);
    expect((JSON.parse(cli.stdout) as RunReport).checks[0]!.status).toBe('error');
});

test.each([
    ['repository', undefined],
    ['file', { artifactLocation: { uri: 'source.txt' }, region: { charOffset: 100 } }],
] as const)(
    'a successful SARIF command retains a %s finding without invented coordinates',
    async (_name, physicalLocation) => {
        const report = {
            version: '2.1.0',
            runs: [
                {
                    results: [
                        {
                            message: { text: 'A reported defect.' },
                            locations: physicalLocation === undefined ? undefined : [{ physicalLocation }],
                        },
                    ],
                },
            ],
        };
        const command = [process.execPath, '-e', `process.stdout.write(${JSON.stringify(JSON.stringify(report))})`];
        await using sandbox = await testdir();
        const source = 'unchanged source\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: `[check."notes/sarif"]\ncommand=${JSON.stringify(command)}\npaths=["source.txt"]\nstage="commit"\n[check."notes/sarif".output]\nformat="sarif"\n`,
            }),
            'source.txt': source,
        });
        const checked = await runGspot(sandbox.path, ['check', '--only', 'notes/sarif', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const outcome = (JSON.parse(checked.stdout) as RunReport).checks.find(
            (entry) => entry.check === 'notes/sarif',
        )!;
        expect(outcome.status).toBe('failed');
        expect(outcome.findings).toHaveLength(1);
        expect(outcome.findings[0]).toMatchObject({
            file: physicalLocation === undefined ? '' : 'source.txt',
            message: 'A reported defect.',
            fixable: false,
        });
        expect(outcome.findings[0]).not.toHaveProperty('line');
        expect(outcome.findings[0]).not.toHaveProperty('column');
        expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe(source);
    },
);
