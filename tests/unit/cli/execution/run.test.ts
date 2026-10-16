import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/checks/run/run.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';

{
    test('a check with malformed JSON reports an error, and the other checks keep their results', async () => {
        const reporter = [process.execPath, '-e', 'console.log("source.txt"); process.exitCode = 1;'];
        const entries = ['broken', 'kept'].map(
            (name) =>
                `[[command_check]]\nname = "sandbox/${name}"\ncommand = ${JSON.stringify(reporter)}\npaths = ["source.txt"]\nstage = "commit"\n[command_check.output]\nformat = "${name === 'broken' ? 'json' : 'lines'}"\n`,
        );
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([], { tables: entries.join('') }),
            'source.txt': 'input\n',
        });
        const outcome = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['sandbox/broken', 'sandbox/kept'] }),
        );
        expect(outcome.report.exitCode).toBe(2);
        expect(outcome.report.checks).toMatchObject([
            {
                check: 'sandbox/broken',
                status: 'error',
                note: textContaining('JSON returned invalid structured findings.'),
            },
            { check: 'sandbox/kept', status: 'failed', findings: [{ message: 'source.txt' }] },
        ]);
    });
}
{
    test('each check result is reported as soon as the check ends, with ignores applied', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'source.sh': 'echo example\n',
            'gspot.toml': stringify({
                configurations: [],
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
        });
        const completed: CheckResult[] = [];
        const ready = Promise.withResolvers<undefined>();
        const running = executeRun(
            await openSession(sandbox.path),
            buildRunOptions({
                only: ['project/fast', 'project/waiting'],
                onResult: (entry) => {
                    completed.push(entry);
                    if (entry.check === 'project/fast') ready.resolve(undefined);
                },
            }),
        );
        const [result] = await Promise.all([
            running,
            Promise.race([ready.promise, running]).then(() => writeFile(join(sandbox.path, 'completed'), 'ready')),
        ]);
        expect(result.report.exitCode).toBe(0);
        expect(completed.map((entry) => entry.check)).toStrictEqual(['project/fast', 'project/waiting']);
        expect(completed[0]).toMatchObject({ status: 'passed', findings: [] });
        expect(result.report.ignores[0]?.matched).toBe(1);
    });
}
