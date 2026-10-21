import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { PARTIAL_FIX_CASES } from '#tests/data/runs/fixes.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

// Root ignores the read-only permission bits that provoke the write failure.
test.skipIf(isWindows || process.getuid?.() === 0)(
    'SQLFluff write failures remain execution errors when its exit code also means findings',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['sql'], {
                level: 'all',
                tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });

        await installToolProjects(sandbox.path);
        const command = ['check', '--only', 'sql/sqlfluff', '--fix', '--json'];
        await chmod(join(sandbox.path, 'source'), 0o500);
        try {
            const failedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
            const failed = failedCommand.report;
            expect(failed.exitCode).toBe(2);
            expect(failed.fixes?.results).toMatchObject([
                { check: 'sql/sqlfluff', status: 'failed', changed: [], note: matchSubstring('PermissionError') },
            ]);
            expect(await readFile(join(sandbox.path, 'source/sample.sql'), 'utf8')).toBe('select  * from foo;\n');
        } finally {
            await chmod(join(sandbox.path, 'source'), 0o700);
        }
    },
);

test.each([...PARTIAL_FIX_CASES])(
    '$check fixes findings, reports an unchanged second fix, and passes after a manual fix',
    async ({ configuration, check, path, tables, sample, partial, corrected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all', tables }),
            '.gitignore': '.gspot/\n',
            [path]: sample,
        });

        await installToolProjects(sandbox.path);
        const command = ['check', '--only', check, '--fix', '--json'];
        const failedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
        const failed = failedCommand.report;
        expect(failed.exitCode, JSON.stringify({ report: failed, fixes: failed.fixes })).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ check, status: 'changed', changed: [path] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        const repeatedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
        const repeated = repeatedCommand.report;
        expect(repeated.exitCode).toBe(1);
        expect(repeated.fixes?.results).toMatchObject([{ check, status: 'unchanged', changed: [] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        if (check === 'spelling/typos')
            for (const result of [failed, repeated])
                expect(result.checks.flatMap(({ findings }) => findings)).toContainEqual(
                    matchFields({ file: path, fixable: false }),
                );
        await writeFile(join(sandbox.path, path), corrected);
        const passedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
        const passed = passedCommand.report;
        expect(passed.exitCode, JSON.stringify(passed)).toBe(0);
    },
);

test('shfmt reports and fixes script formatting with tabs', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash', 'format'], {
            tables: `[format]
indent_style = "tab"
indent_width = 4
`,
        }),
        'example.sh': `if true; then
  echo ready
fi
`,
    });

    await installToolProjects(sandbox.path);
    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const brokenCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
    const broken = brokenCommand.report;
    expect(broken.exitCode, JSON.stringify(broken)).toBe(1);
    const correctionCommand = parseCheckReport(await spawnGspot(sandbox.path, [...command, '--fix']));
    const correction = correctionCommand.report;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    const indent = '\t';
    expect(await readFile(join(sandbox.path, 'example.sh'), 'utf8')).toBe(`if true; then
${indent}echo ready
fi
`);
    const verifiedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
    const verified = verifiedCommand.report;
    expect(verified.exitCode, JSON.stringify(verified)).toBe(0);
});
