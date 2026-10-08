import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { toolPin, toolName, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { PARTIAL_FIX_CASES, SHFMT_FORMATTED_SCRIPT } from '#tests/config/tools/fixers.ts';

// Generate the selected configuration and copy the complete suite-owned Python environment when it is private.
async function prepareFixer(root: string, checkId: string): Promise<void> {
    const session = await openSession(root);
    {
        using log = openOwnership(root);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    const manifests = session.scopes[0]!.selected;
    const check = manifests.flatMap((manifest) => manifest.checks).find((entry) => entry.name === checkId)!;
    const tool = toolPin(manifests, toolName(check)!);
    const executable = Bun.which(tool.name, { PATH: buildToolsPath([tool.name]) });
    if (executable === null) throw new Error(`The native fixer test requires ${tool.name}.`);
    if (toolProjectPackage(tool, session.policyFiles.policy.runner)?.kind === 'python') await sharePythonTools(root);
}

// Root ignores the read-only permission bits that provoke the write failure.
test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'SQLFluff write failures remain execution errors when its exit code also means findings',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['sql'], {
                level: 'all',
                tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });
        await prepareFixer(sandbox.path, 'sql/sqlfluff');
        const options = buildRunOptions({ only: ['sql/sqlfluff'], fix: true });
        await chmod(join(sandbox.path, 'source'), 0o500);
        try {
            const failed = await executeRun(await openSession(sandbox.path), options);
            expect(failed.report.exitCode).toBe(2);
            expect(failed.fixes?.results).toMatchObject([
                { check: 'sql/sqlfluff', status: 'failed', changed: [], note: textContaining('PermissionError') },
            ]);
            expect(await readFile(join(sandbox.path, 'source/sample.sql'), 'utf8')).toBe('select  * from foo;\n');
        } finally {
            await chmod(join(sandbox.path, 'source'), 0o700);
        }
    },
);

test.each(PARTIAL_FIX_CASES)(
    '$check fixes findings and reports an unchanged repeated fix until manual correction',
    async ({ configuration, check, path, tables, sample, partial, corrected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([configuration], { level: 'all', tables: `runner = "mise"\n${tables}` }),
            '.gitignore': '.gspot/\n',
            [path]: sample,
        });
        await prepareFixer(sandbox.path, check);
        const options = buildRunOptions({ only: [check], skips: [], fix: true });
        const failed = await executeRun(await openSession(sandbox.path), options);
        expect(failed.report.exitCode, JSON.stringify({ report: failed.report, fixes: failed.fixes })).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ check, status: 'changed', changed: [path] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        const repeated = await executeRun(await openSession(sandbox.path), options);
        expect(repeated.report.exitCode).toBe(1);
        expect(repeated.fixes?.results).toMatchObject([{ check, status: 'unchanged', changed: [] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        if (check === 'spelling/typos')
            for (const result of [failed, repeated])
                expect(result.report.checks.flatMap(({ findings }) => findings)).toContainEqual(
                    containing({ file: path, fixable: false }),
                );
        await Bun.write(join(sandbox.path, path), corrected);
        const passed = await executeRun(await openSession(sandbox.path), options);
        expect(passed.report.exitCode, JSON.stringify(passed.report)).toBe(0);
    },
);

test('shfmt reports and fixes ordinary shell formatting', async () => {
    await using sandbox = await testdir();
    const source = "if true;then\nprintf '%s\\n' one\nfi\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
        'example.sh': source,
    });
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['bash/shfmt'] });
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
    const correction = await executeRun(await openSession(sandbox.path), { ...options, fix: true });
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'example.sh')).text()).toBe(SHFMT_FORMATTED_SCRIPT);
    const verified = await executeRun(await openSession(sandbox.path), options);
    expect(verified.report.exitCode, JSON.stringify(verified.report)).toBe(0);
});

test.each(['space', 'tab'])('shfmt fixes shell indentation using the configured %s style', async (style) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'format'], {
            tables: `[format]\nindent_style = "${style}"\nindent_width = 4\n`,
        }),
        'example.sh': 'if true; then\n  echo ready\nfi\n',
    });
    const options = buildRunOptions({ only: ['bash/shfmt'] });
    const correction = await executeRun(await openSession(sandbox.path), { ...options, fix: true });
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    const indent = style === 'space' ? ' '.repeat(4) : '\t';
    expect(await Bun.file(join(sandbox.path, 'example.sh')).text()).toBe(`if true; then\n${indent}echo ready\nfi\n`);
    const verified = await executeRun(await openSession(sandbox.path), options);
    expect(verified.report.exitCode, JSON.stringify(verified.report)).toBe(0);
});

test('shfmt reports a syntax error as a source finding and accepts the repaired script with a space in its name', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'format']),
        'broken script.sh': 'if then\n',
    });
    const options = buildRunOptions({ only: ['bash/shfmt'] });
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { status: 'failed', findings: [{ file: 'broken script.sh', line: 1, column: 1, fixable: false }] },
    ]);
    await Bun.write(join(sandbox.path, 'broken script.sh'), 'echo example\n');
    const correction = await executeRun(await openSession(sandbox.path), options);
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    expect(correction.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
