import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { join, toNamespacedPath } from 'node:path';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { fakeNpmTool, fakeCommands } from '#tests/setup/system/fakes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { JSCPD_SCOPE_FINDINGS } from '#tests/config/configurations/general.ts';

async function prepareDuplicationSandbox(resources: AsyncDisposableStack): Promise<string> {
    const folder = resources.use(await createGitSandbox({}));
    await fakeNpmTool(folder.path, 'jscpd');
    await createFileTree(folder.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
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
        using _spawn = fakeCommands('jscpd', (command) => {
            folders.push(command[command.indexOf('--output') + 1]!);
            return Promise.resolve(buildProcessResult({ code, stdout: 'The scanner could not write its report.\n' }));
        });
        const failed = await runChecks(session, buildRunOptions({ only: ['structure/jscpd'] }));
        expect(folders, JSON.stringify(failed.report)).toHaveLength(1);
        expect(failed.report.checks).toMatchObject([{ check: 'structure/jscpd', status: 'error', findings: [] }]);
        expect(failed.report.checks[0]!.note).toBe(
            `The jscpd command ${code === 0 ? 'wrote no report' : 'failed (exit 1)'}: The scanner could not write its report.`,
        );
        expect(existsSync(folders[0]!)).toBe(false);
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
        using _spawn = fakeCommands('jscpd', async (command) => {
            const work = command[command.indexOf('--output') + 1]!;
            await writeFile(join(work, 'jscpd-report.json'), JSON.stringify(report));
            return buildProcessResult();
        });
        const result = await runChecks(session, buildRunOptions({ only: ['structure/jscpd'] }));
        expect(
            result.report.checks[0]!.findings.map(({ file, line, rule, message }) => ({ file, line, rule, message })),
            JSON.stringify(result.report),
        ).toStrictEqual([...JSCPD_SCOPE_FINDINGS]);
    },
);
