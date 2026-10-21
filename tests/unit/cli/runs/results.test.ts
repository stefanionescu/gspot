import { join } from 'node:path';
import { testdir } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, expect, describe } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

describe('results', () => {
    test('a check with malformed JSON reports an error, and the other checks keep their results', async () => {
        const reporter = [process.execPath, '-e', 'console.log("source.txt"); process.exitCode = 1;'];
        const entries = ['broken', 'kept'].map(
            (name) =>
                `[[command_check]]\nname = "sandbox/${name}"\ncommand = ${JSON.stringify(reporter)}\npaths = ["source.txt"]\nstage = "commit"\n[command_check.output]\nformat = "${name === 'broken' ? 'json' : 'lines'}"\n`,
        );
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], { tables: entries.join('') }),
            'source.txt': 'input\n',
        });

        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['sandbox/broken', 'sandbox/kept'] }),
        );
        expect(result.report.exitCode).toBe(2);
        expect(result.report.checks).toMatchObject([
            {
                check: 'sandbox/broken',
                status: 'error',
                note: matchSubstring('JSON returned no structured findings.'),
            },
            { check: 'sandbox/kept', status: 'failed', findings: [{ message: 'source.txt' }] },
        ]);
    });
});

describe('results', () => {
    test('progress is reported as soon as each check ends, with ignores applied to the final results', async () => {
        await using sandbox = await testdir({
            'source.sh': 'echo example\n',
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                tables: stringify({
                    ignore: [{ check: 'project/fast', rule: 'demo', reason: 'The sandbox tests filtered progress.' }],
                    command_check: [
                        {
                            name: 'project/fast',
                            paths: ['source.sh'],
                            stage: 'commit',
                            command: [
                                process.execPath,
                                '-e',
                                'console.log("source.sh:demo:Ignored finding"); process.exitCode = 1;',
                            ],
                            output: { format: 'regex', pattern: '^(?<file>[^:]+):(?<rule>[^:]+):(?<message>.*)$' },
                        },
                        {
                            name: 'project/waiting',
                            paths: ['source.sh'],
                            stage: 'commit',
                            command: [
                                process.execPath,
                                '-e',
                                'while (!await Bun.file("completed").exists()) await Bun.sleep(10);',
                            ],
                        },
                    ],
                }),
            }),
        });

        const completed: number[] = [];
        const ready = Promise.withResolvers<undefined>();
        const running = runChecks(
            await openSession(sandbox.path),
            buildRunOptions({
                only: ['project/fast', 'project/waiting'],
                onProgress: (progress) => {
                    completed.push(progress.completed);
                    if (progress.completed === 1) ready.resolve(undefined);
                },
            }),
        );
        const [result] = await Promise.all([
            running,
            Promise.race([ready.promise, running]).then(() => writeFile(join(sandbox.path, 'completed'), 'ready')),
        ]);
        expect(result.report.exitCode).toBe(0);
        expect(completed).toStrictEqual([1, 2]);
        expect(result.report.checks.map((entry) => entry.check)).toStrictEqual(['project/fast', 'project/waiting']);
        expect(result.report.checks[0]).toMatchObject({ status: 'passed', findings: [] });
        expect(result.report.ignores).toStrictEqual([
            { check: 'project/fast', rule: 'demo', reason: 'The sandbox tests filtered progress.' },
        ]);
    });
});

test('an ignore with names keeps them in the run report and in the verbose ignore line', async () => {
    const reason = 'The public hook serves the script caller.';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "structure/trivial-functions"\nnames = ["useThing"]\nreason = "The public hook serves the script caller."\n',
        }),
        'source.sh':
            'useThing() { printf "%s\\n" ready; }\nuseOther() { printf "%s\\n" ready; }\nprintf "%s\\n" complete\n',
    });
    const command = ['check', '--only', 'structure/trivial-functions'];
    const json = parseCheckReport(await runGspot(sandbox.path, [...command, '--json']));
    const verbose = await runGspot(sandbox.path, [...command, '--verbose']);
    expect({ code: json.code, stderr: json.stderr }).toStrictEqual({ code: 1, stderr: '' });
    expect({ code: verbose.code, stderr: verbose.stderr }).toStrictEqual({ code: 1, stderr: '' });
    expect(json.report.checks.flatMap(({ findings }) => findings.map(({ name }) => name))).toStrictEqual(['useOther']);
    expect({
        ignores: json.report.ignores,
        lines: verbose.stdout.split('\n').filter((line) => line.startsWith('ignore     ')),
    }).toStrictEqual({
        ignores: [{ check: 'structure/trivial-functions', names: ['useThing'], reason }],
        lines: [`ignore     structure/trivial-functions names useThing  ${reason}`],
    });
});
