import { writeFile } from 'node:fs/promises';
import { join, toNamespacedPath } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { fakeTool } from '#tests/harness/platforms.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { cloneFindings } from '#cli/checks/general/public.ts';
import { runGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { CloneReport } from '#cli/types/checks/general/duplication.ts';
import { VALID_REPORT, EXECUTION_FAILURES } from '#tests/config/cli/checks/general/duplication.ts';

/** Prepare actual generated configuration and the private scanner's version boundary. */
async function prepareDuplicationProject(root: string): Promise<void> {
    const pin = toolPin(configurationManifests().values(), 'jscpd');
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['bash', 'duplication'], { level: 'all', tables: 'tool_timeout_seconds = 1\n' }),
        'sample.sh': 'echo example\n',
        '.gspot/node_modules/jscpd/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
    });
    await fakeTool(root, '.gspot/node_modules/.bin/jscpd', `console.log(${JSON.stringify('jscpd ' + pin.version!)});`);
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

test.each(EXECUTION_FAILURES)(
    'duplication refuses $name and removes temporary reports',
    async ({ report, flags, diagnostic }) => {
        await using directory = await testdir();
        await prepareDuplicationProject(directory.path);
        const session = await openSession(directory.path);
        const directories: string[] = [];
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'run').mockImplementation(async (command) => {
                const output = command[command.indexOf('--output') + 1]!;
                directories.push(output);
                await writeFile(join(output, 'jscpd-report.json'), JSON.stringify(report));
                return {
                    ...flags,
                    stdout: '',
                    stderr: 'Native scan failed.',
                    missing: false,
                    duration: 1,
                };
            }),
        );
        const failed = await executeRun(session, buildRunOptions({ only: ['duplication/jscpd'] }));
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'error', findings: [] }]);
        expect(failed.report.checks[0]!.note).toContain(diagnostic);
        expect(directories.length).toBeGreaterThan(0);
        for (const path of directories) expect(await pathExists(path)).toBe(false);
    },
);

test.each([1, 0])('duplication preserves stdout diagnostics when exit %i produces no report', async (code) => {
    await using directory = await testdir();
    await prepareDuplicationProject(directory.path);
    const session = await openSession(directory.path);
    const directories: string[] = [];
    using _spawn = spyOn(processes, 'run').mockImplementation((command) => {
        directories.push(command[command.indexOf('--output') + 1]!);
        return Promise.resolve({
            code,
            stdout: 'The scanner could not write its report.\n',
            stderr: '',
            missing: false,
            duration: 1,
        });
    });
    const failed = await executeRun(session, buildRunOptions({ only: ['duplication/jscpd'] }));
    expect(directories.length).toBeGreaterThan(0);
    expect(failed.report.exitCode).toBe(2);
    expect(failed.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'error', findings: [] }]);
    expect(failed.report.checks[0]!.note).toBe(
        `The duplication/jscpd check failed: The jscpd command ${code === 0 ? 'wrote no report' : 'failed'}: The scanner could not write its report.`,
    );
    for (const path of directories) expect(await pathExists(path)).toBe(false);
    expect(await Bun.file(join(session.root, 'sample.sh')).text()).toBe('echo example\n');
});

test('duplication accepts a clean report and removes the temporary report directory', async () => {
    await using directory = await testdir();
    await prepareDuplicationProject(directory.path);
    const session = await openSession(directory.path);
    const directories: string[] = [];
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockImplementation(async (command) => {
            const output = command[command.indexOf('--output') + 1]!;
            directories.push(output);
            await writeFile(join(output, 'jscpd-report.json'), JSON.stringify(VALID_REPORT));
            return { code: 0, stdout: '', stderr: '', missing: false, duration: 1 };
        }),
    );
    const result = await executeRun(session, buildRunOptions({ only: ['duplication/jscpd'] }));
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'passed', findings: [] }]);
    expect(directories.length).toBeGreaterThan(0);
    for (const path of directories) expect(await pathExists(path)).toBe(false);
});

describe('clone findings', () => {
    for (const mode of ['relative', 'absolute', 'namespaced'])
        test.skipIf(mode === 'namespaced' && process.platform !== 'win32')(
            `${mode} clone paths retain owned copies and exclude other files`,
            () => {
                const root = join(import.meta.dir, 'workspace café');
                const absolute = mode === 'namespaced' ? toNamespacedPath(root) : root;
                const prefix = mode === 'relative' ? '' : absolute;
                const report: CloneReport = {
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
                const shape = { check: 'duplication/jscpd', root, ceiling: 4, owned: new Set(['scripts/café.sh']) };
                expect(cloneFindings(report, shape)).toStrictEqual([
                    {
                        check: 'duplication/jscpd',
                        file: 'scripts/café.sh',
                        line: 3,
                        rule: 'clone',
                        message:
                            '30 lines repeat scripts/original.sh:7. The duplicated share is 12.0 of 100, over the ceiling of 4.',
                        fixable: false,
                    },
                ]);
                expect(cloneFindings(report, { ...shape, ceiling: 12 })).toStrictEqual([]);
            },
        );
});
