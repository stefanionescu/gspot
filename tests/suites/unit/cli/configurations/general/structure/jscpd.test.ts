import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, toNamespacedPath } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

const JSCPD_SCOPE_FINDINGS = [
    {
        file: 'scripts/café.sh',
        line: 3,
        rule: 'clone',
        message: '30 lines repeat scripts/original.sh:7.',
    },
] as const;

async function prepareDuplicationSandbox(resources: AsyncDisposableStack): Promise<string> {
    const folder = resources.use(await createGitSandbox({}));
    await fakeNpmTool(folder.path, 'jscpd');
    await createFileTree(folder.path, {
        'gspot.toml': buildSandboxSettings(['bash', 'python'], { level: 'all' }),
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
        expect(failed.report.checks[0]!.note).toContain('The scanner could not write its report.');
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
        using _spawn = fakeCommands('jscpd', async (command) => {
            const work = command[command.indexOf('--output') + 1]!;
            await writeFile(join(work, 'jscpd-report.json'), JSON.stringify(report));
            return buildProcessResult();
        });
        const findings = await runSandboxCheck(root, 'structure/jscpd');
        expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
            ...JSCPD_SCOPE_FINDINGS,
        ]);
    },
);

async function listImportCloneFindings(body: string, lines: number): Promise<Array<{ file: string; message: string }>> {
    await using resources = new AsyncDisposableStack();
    const root = await prepareDuplicationSandbox(resources);
    const imports = (name: string) =>
        Array.from({ length: 6 }, (_, index) => `import ${name}_${String(index)}\n\nfrom ${name} import (\n    b,\n)`);
    await createFileTree(root, {
        'first.py': ['"""Read one order."""', ...imports('first'), body].join('\n'),
        'second.py': ['"""Read one order."""', ...imports('second'), body].join('\n'),
    });
    using _spawn = fakeCommands('jscpd', async (command) => {
        const report = {
            duplicates: [
                {
                    lines,
                    firstFile: { name: join(root, 'first.py'), start: 1 },
                    secondFile: { name: join(root, 'second.py'), start: 1 },
                },
            ],
        };
        await writeFile(join(command[command.indexOf('--output') + 1]!, 'jscpd-report.json'), JSON.stringify(report));
        return buildProcessResult();
    });
    const findings = await runSandboxCheck(root, 'structure/jscpd');
    return findings.map(({ file, message }) => ({ file, message }));
}

test('a clone whose lines outside the ignored imports stay under min_duplicate_lines is not reported', async () => {
    expect(await listImportCloneFindings('\nif TYPE_CHECKING:\n    import late\nprint("done")\n', 35)).toStrictEqual(
        [],
    );
});

test('a clone that spans ignored imports is reported with the count of its other lines', async () => {
    const body = Array.from({ length: 8 }, (_, index) => `total += ${String(index)}`).join('\n');
    expect(await listImportCloneFindings(`${body}\n`, 39)).toStrictEqual([
        { file: 'second.py', message: '9 lines repeat first.py:1.' },
    ]);
});
