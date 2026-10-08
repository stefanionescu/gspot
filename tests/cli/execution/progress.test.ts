import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';

test('completion callbacks publish filtered results before the remaining check finishes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.sh': 'echo example\n',
        'gspot.toml': stringify({
            configurations: [],
            ignore: [{ check: 'project/fast', rule: 'demo', reason: 'The fixture verifies filtered progress.' }],
            check: {
                'project/fast': {
                    paths: ['source.sh'],
                    stage: 'commit',
                    command: [
                        process.execPath,
                        '-e',
                        'console.log("source.sh:demo:Ignored finding"); process.exitCode = 1;',
                    ],
                    output: { format: 'regex', pattern: '^(?<file>[^:]+):(?<rule>[^:]+):(?<message>.*)$' },
                },
                'project/waiting': {
                    paths: ['source.sh'],
                    stage: 'commit',
                    command: [
                        process.execPath,
                        '-e',
                        'while (!await Bun.file("completed").exists()) await Bun.sleep(10);',
                    ],
                },
            },
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
