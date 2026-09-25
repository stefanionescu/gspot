import type { CheckResult } from '#cli/checks/result.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

test('completion callbacks publish filtered results before the remaining check finishes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.sh': 'echo example\n',
        'gspot.toml': stringify({
            version: 1,
            configurations: [],
            ignore: [{ check: 'project/fast', rule: 'demo', reason: 'The fixture verifies filtered progress.' }],
            check: [
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
                        'for (let attempt = 0; attempt < 100; attempt++) { if (await Bun.file("completed").exists()) process.exit(0); await Bun.sleep(10); } process.exit(1);',
                    ],
                },
            ],
        }),
    });
    const completed: CheckResult[] = [];
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: [],
        fix: false,
        isDryRun: true,
        noCache: true,
        onResult: (entry) => {
            completed.push(entry);
            if (entry.check === 'project/fast') writeFileSync(join(sandbox.path, 'completed'), 'ready');
        },
    });
    expect(result.report.exitCode).toBe(0);
    expect(completed.map((entry) => entry.check)).toStrictEqual(['project/fast', 'project/waiting']);
    expect(completed[0]).toMatchObject({ status: 'ok', findings: [] });
    expect(result.report.ignores[0]?.matched).toBe(1);
});
