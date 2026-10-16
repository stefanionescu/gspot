import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { join, toNamespacedPath } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/checks/run/run.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { fakeNpmTool } from '#tests/setup/fake-tool.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { runGspot, buildRunOptions } from '#tests/setup/run-gspot.ts';

test.each([1, 0])('jscpd output is kept in the error when exit %i writes no report', async (code) => {
    await using directory = await testdir();
    await fakeNpmTool(directory.path, 'jscpd');
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash', 'duplication'], { level: 'all' }),
        'sample.sh': 'echo example\n',
    });

    const applied = await runGspot(directory.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(directory.path);
    const directories: string[] = [];
    using _spawn = spyOn(processes, 'spawnProcess').mockImplementation((command) => {
        directories.push(command[command.indexOf('--output') + 1]!);
        return Promise.resolve(processResult({ code, stdout: 'The scanner could not write its report.\n' }));
    });
    const failed = await executeRun(session, buildRunOptions({ only: ['duplication/jscpd'] }));
    expect(directories.length, JSON.stringify(failed.report)).toBeGreaterThan(0);
    expect(failed.report.exitCode).toBe(2);
    expect(failed.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'error', findings: [] }]);
    expect(failed.report.checks[0]!.note).toBe(
        `The duplication/jscpd check failed: The jscpd command ${code === 0 ? 'wrote no report' : 'failed'}: The scanner could not write its report.`,
    );
    for (const path of directories) expect(await pathExists(path)).toBe(false);
});

for (const mode of ['relative', 'absolute', 'namespaced'])
    test(`${mode} clone paths are reported only for files the scope covers`, async () => {
        await using directory = await testdir();
        await fakeNpmTool(directory.path, 'jscpd');
        await createFileTree(directory.path, {
            'gspot.toml': settingsText(['bash', 'duplication'], { level: 'all' }),
            'sample.sh': 'echo example\n',
        });

        const applied = await runGspot(directory.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const root = directory.path;
        const absolute = mode === 'namespaced' ? toNamespacedPath(root) : root;
        const prefix = mode === 'relative' ? '' : absolute;
        const report = {
            statistics: { total: { percentage: 12 } },
            duplicates: [
                {
                    lines: 30,
                    firstFile: { name: join(prefix, 'scripts', 'original.sh'), start: 7, end: 36 },
                    secondFile: { name: join(prefix, 'scripts', 'café.sh'), start: 3, end: 32 },
                },
                {
                    lines: 30,
                    firstFile: { name: join(prefix, 'scripts', 'original.sh'), start: 7, end: 36 },
                    secondFile: { name: join(prefix, 'vendor', 'copy.sh'), start: 1, end: 30 },
                },
            ],
        };
        await createFileTree(root, { 'scripts/café.sh': 'echo clone\n', 'vendor/copy.sh': 'echo vendor\n' });
        const session = await openSession(root);
        using _spawn = spyOn(processes, 'spawnProcess').mockImplementation(async (command) => {
            const work = command[command.indexOf('--output') + 1]!;
            await Bun.write(join(work, 'jscpd-report.json'), JSON.stringify(report));
            return processResult();
        });
        const result = await executeRun(session, buildRunOptions({ only: ['duplication/jscpd'] }));
        expect(result.report.checks[0]!.findings, JSON.stringify(result.report)).toStrictEqual([
            {
                check: 'duplication/jscpd',
                help: 'Move the shared block into one function both callers use.',
                file: 'scripts/café.sh',
                line: 3,
                rule: 'clone',
                message:
                    '30 lines repeat scripts/original.sh:7. The duplicated share is 12.0 of 100, over the limit of 4.',
                fixable: false,
            },
        ]);
    });
