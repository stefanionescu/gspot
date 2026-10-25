import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { join, toNamespacedPath } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { JSCPD_SCOPE_FINDINGS } from '#tests/config/checks/general/duplication.ts';

async function prepareDuplicationSandbox(resources: AsyncDisposableStack): Promise<string> {
    const folder = resources.use(await testdir());
    await fakeNpmTool(folder.path, 'jscpd');
    await createFileTree(folder.path, {
        'gspot.toml': buildSandboxSettings(['bash', 'duplication'], { level: 'all' }),
        'sample.sh': 'echo example\n',
    });
    await applyGeneratedFiles(folder.path);
    return folder.path;
}

test.each([1, 0])(
    'jscpd exit %i without a report is a check error that keeps the jscpd output in its note and removes its temporary folder',
    async (code) => {
        await using resources = new AsyncDisposableStack();
        const root = await prepareDuplicationSandbox(resources);
        const session = await openSession(root);
        const folders: string[] = [];
        using _spawn = spyOn(processes, 'spawnProcess').mockImplementation((command) => {
            folders.push(command[command.indexOf('--output') + 1]!);
            return Promise.resolve(buildProcessResult({ code, stdout: 'The scanner could not write its report.\n' }));
        });
        const failed = await runChecks(session, buildRunOptions({ only: ['duplication/jscpd'] }));
        expect(folders, JSON.stringify(failed.report)).toHaveLength(1);
        expect(failed.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'error', findings: [] }]);
        expect(failed.report.checks[0]!.note).toBe(
            `The duplication/jscpd check failed: The jscpd command ${code === 0 ? 'wrote no report' : 'failed'}: The scanner could not write its report.`,
        );
        expect(await isOnDisk(folders[0]!)).toBe(false);
    },
);

test.each(['relative', 'absolute', 'namespaced'])(
    `%s clone paths are reported only for files the scope covers`,
    async (mode) => {
        await using resources = new AsyncDisposableStack();
        const root = await prepareDuplicationSandbox(resources);
        const absolute = mode === 'namespaced' ? toNamespacedPath(root) : root;
        const prefix = mode === 'relative' ? '' : absolute;
        const previous = { name: join(prefix, 'scripts', 'original.sh'), start: 7, end: 36 };
        const report = {
            duplicates: [
                {
                    lines: 30,
                    firstFile: previous,
                    secondFile: { name: join(prefix, 'scripts', 'café.sh'), start: 3, end: 32 },
                },
                {
                    lines: 30,
                    firstFile: previous,
                    secondFile: { name: join(prefix, 'vendor', 'copy.sh'), start: 1, end: 30 },
                },
            ],
        };
        await createFileTree(root, { 'scripts/café.sh': 'echo clone\n', 'vendor/copy.sh': 'echo vendor\n' });
        const session = await openSession(root);
        using _spawn = spyOn(processes, 'spawnProcess').mockImplementation(async (command) => {
            const work = command[command.indexOf('--output') + 1]!;
            await writeFile(join(work, 'jscpd-report.json'), JSON.stringify(report));
            return buildProcessResult();
        });
        const result = await runChecks(session, buildRunOptions({ only: ['duplication/jscpd'] }));
        expect(result.report.checks[0]!.findings, JSON.stringify(result.report)).toStrictEqual([
            ...JSCPD_SCOPE_FINDINGS,
        ]);
    },
);
