import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { join, toNamespacedPath } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { fakeNpmTool } from '#tests/setup/fakes.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';

/** Create a jscpd sandbox and apply its settings for the output failure and clone path tests. */
async function prepareDuplicationSandbox(resources: AsyncDisposableStack): Promise<string> {
    const folder = resources.use(await testdir());
    await fakeNpmTool(folder.path, 'jscpd');
    await createFileTree(folder.path, {
        'gspot.toml': buildSandboxSettings(['bash', 'duplication'], { level: 'all' }),
        'sample.sh': 'echo example\n',
    });
    {
        const session = await openSession(folder.path);
        using writer = openWriter(folder.path);
        writeGeneratedFiles(session, generate(session), writer);
    }
    return folder.path;
}

test.each([1, 0])('jscpd output is kept in the error when exit %i writes no report', async (code) => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareDuplicationSandbox(resources);
    const session = await openSession(root);
    const folders: string[] = [];
    using _spawn = spyOn(processes, 'spawnProcess').mockImplementation((command) => {
        folders.push(command[command.indexOf('--output') + 1]!);
        return Promise.resolve(buildProcessResult({ code, stdout: 'The scanner could not write its report.\n' }));
    });
    const failed = await runChecks(session, buildRunOptions({ only: ['duplication/jscpd'] }));
    expect(folders.length, JSON.stringify(failed.report)).toBeGreaterThan(0);

    expect(failed.report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'error', findings: [] }]);
    expect(failed.report.checks[0]!.note).toBe(
        `The duplication/jscpd check failed: The jscpd command ${code === 0 ? 'wrote no report' : 'failed'}: The scanner could not write its report.`,
    );
    for (const path of folders) expect(await isOnDisk(path)).toBe(false);
});

test.each(['relative', 'absolute', 'namespaced'])(
    `%s clone paths are reported only for files the scope covers`,
    async (mode) => {
        await using resources = new AsyncDisposableStack();
        const root = await prepareDuplicationSandbox(resources);
        const absolute = mode === 'namespaced' ? toNamespacedPath(root) : root;
        const prefix = mode === 'relative' ? '' : absolute;
        const report = {
            statistics: { total: { percentage: 0.1 } },
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
            await writeFile(join(work, 'jscpd-report.json'), JSON.stringify(report));
            return buildProcessResult();
        });
        const result = await runChecks(session, buildRunOptions({ only: ['duplication/jscpd'] }));
        expect(result.report.checks[0]!.findings, JSON.stringify(result.report)).toStrictEqual([
            {
                check: 'duplication/jscpd',
                help: 'Move the shared block into one function both callers use.',
                file: 'scripts/café.sh',
                line: 3,
                rule: 'clone',
                message: '30 lines repeat scripts/original.sh:7.',
                fixable: false,
            },
        ]);
    },
);
