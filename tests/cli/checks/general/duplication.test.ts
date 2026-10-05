import { toolPin } from '#cli/tools/pins.ts';
import { executeRun } from '#cli/execution/run.ts';
import { join, toNamespacedPath } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { cloneFindings } from '#cli/checks/general/duplication.ts';
import { runGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { CloneReport } from '#cli/types/checks/general/duplication.ts';
import { SCANNERS, VALID_REPORT, EXECUTION_FAILURES } from '#tests/config/cli/checks/general/duplication.ts';

/** Prepare actual generated configuration and the private scanner's version boundary. */
async function prepareDuplicationProject(root: string): Promise<void> {
    const pin = toolPin(configurationManifests().values(), 'jscpd');
    const scanner = process.platform === 'win32' ? SCANNERS.windows : SCANNERS.posix;
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['bash', 'duplication'], { level: 'all', tables: 'tool_timeout_seconds = 1\n' }),
        'sample.sh': 'echo example\n',
        [scanner.path]: scanner.body.replace('VERSION', pin.version!),
        '.gspot/node_modules/jscpd/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
    });
    chmodSync(join(root, scanner.path), 0o755);
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
            spyOn(processes, 'run').mockImplementation((command) => {
                const output = command[command.indexOf('--output') + 1]!;
                directories.push(output);
                writeFileSync(join(output, 'jscpd-report.json'), JSON.stringify(report));
                return Promise.resolve({
                    ...flags,
                    stdout: '',
                    stderr: 'Native scan failed.',
                    missing: false,
                    duration: 1,
                });
            }),
        );
        const failed = await executeRun(session, buildRunOptions({ only: ['duplication/jscpd'] }));
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'error', findings: [] }]);
        expect(failed.report.checks[0]!.note).toContain(diagnostic);
        expect(directories.length).toBeGreaterThan(0);
        for (const path of directories) expect(existsSync(path)).toBe(false);
    },
);

test.each([1, 0])('duplication preserves stdout diagnostics when exit %i produces no report', async (code) => {
    await using directory = await testdir();
    await prepareDuplicationProject(directory.path);
    const session = await openSession(directory.path);
    const directories: string[] = [];
    using spawn = spyOn(processes, 'run').mockImplementation((command) => {
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
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(failed.report.exitCode).toBe(2);
    expect(failed.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'error', findings: [] }]);
    expect(failed.report.checks[0]!.note).toBe(
        `The duplication/jscpd check failed: The jscpd command ${code === 0 ? 'wrote no report' : 'failed'}: The scanner could not write its report.`,
    );
    for (const path of directories) expect(existsSync(path)).toBe(false);
    expect(await Bun.file(join(session.root, 'sample.sh')).text()).toBe('echo example\n');
});

test('duplication accepts a clean report and removes the temporary report directory', async () => {
    await using directory = await testdir();
    await prepareDuplicationProject(directory.path);
    const session = await openSession(directory.path);
    const directories: string[] = [];
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockImplementation((command) => {
            const output = command[command.indexOf('--output') + 1]!;
            directories.push(output);
            writeFileSync(join(output, 'jscpd-report.json'), JSON.stringify(VALID_REPORT));
            return Promise.resolve({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
        }),
    );
    const result = await executeRun(session, buildRunOptions({ only: ['duplication/jscpd'] }));
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'passed', findings: [] }]);
    expect(directories.length).toBeGreaterThan(0);
    for (const path of directories) expect(existsSync(path)).toBe(false);
});

describe('clone findings', () => {
    test('native absolute and relative paths retain owned copies and exclude other files', () => {
        const root = join(import.meta.dir, 'workspace café');
        const prefixes = new Set([root, toNamespacedPath(root), '']);
        for (const prefix of prefixes) {
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
        }
    });
});
