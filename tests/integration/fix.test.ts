import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { PARTIAL_FIX_CASES } from '#tests/config/check.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import type { RunReport, FixReport } from '#cli/types/execution/check.ts';

// Root ignores the read-only permission bits that provoke the write failure.
test.skipIf(isWindows || process.getuid?.() === 0)(
    'SQLFluff write failures remain execution errors when its exit code also means findings',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['sql'], {
                level: 'all',
                tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });
        await installToolProjects(sandbox.path);
        const command = ['check', '--only', 'sql/sqlfluff', '--fix', '--json'];
        await chmod(join(sandbox.path, 'source'), 0o500);
        try {
            const failedCommand = await spawnGspot(sandbox.path, command);
            const failed = JSON.parse(failedCommand.stdout) as RunReport & { fixes?: FixReport };
            expect(failed.exitCode).toBe(2);
            expect(failed.fixes?.results).toMatchObject([
                { check: 'sql/sqlfluff', status: 'failed', changed: [], note: textContaining('PermissionError') },
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
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([configuration], { level: 'all', tables }),
            '.gitignore': '.gspot/\n',
            [path]: sample,
        });
        await installToolProjects(sandbox.path);
        const command = ['check', '--only', check, '--fix', '--json'];
        const failedCommand = await spawnGspot(sandbox.path, command);
        const failed = JSON.parse(failedCommand.stdout) as RunReport & { fixes?: FixReport };
        expect(failed.exitCode, JSON.stringify({ report: failed, fixes: failed.fixes })).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ check, status: 'changed', changed: [path] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        const repeatedCommand = await spawnGspot(sandbox.path, command);
        const repeated = JSON.parse(repeatedCommand.stdout) as RunReport & { fixes?: FixReport };
        expect(repeated.exitCode).toBe(1);
        expect(repeated.fixes?.results).toMatchObject([{ check, status: 'unchanged', changed: [] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        if (check === 'spelling/typos')
            for (const result of [failed, repeated])
                expect(result.checks.flatMap(({ findings }) => findings)).toContainEqual(
                    containing({ file: path, fixable: false }),
                );
        await Bun.write(join(sandbox.path, path), corrected);
        const passedCommand = await spawnGspot(sandbox.path, command);
        const passed = JSON.parse(passedCommand.stdout) as RunReport & { fixes?: FixReport };
        expect(passed.exitCode, JSON.stringify(passed)).toBe(0);
    },
);

test.each(['default', 'space', 'tab'])(
    'shfmt reports, then fixes, script formatting in the %s style',
    async (style) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['bash', 'format'], {
                tables:
                    style === 'default'
                        ? ''
                        : `[format]
indent_style = "${style}"
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
        const brokenCommand = await spawnGspot(sandbox.path, command);
        const broken = JSON.parse(brokenCommand.stdout) as RunReport & { fixes?: FixReport };
        expect(broken.exitCode, JSON.stringify(broken)).toBe(1);
        const correctionCommand = await spawnGspot(sandbox.path, [...command, '--fix']);
        const correction = JSON.parse(correctionCommand.stdout) as RunReport;
        expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
        const indent = style === 'tab' ? '\t' : ' '.repeat(4);
        expect(await Bun.file(join(sandbox.path, 'example.sh')).text()).toBe(`if true; then
${indent}echo ready
fi
`);
        const verifiedCommand = await spawnGspot(sandbox.path, command);
        const verified = JSON.parse(verifiedCommand.stdout) as RunReport & { fixes?: FixReport };
        expect(verified.exitCode, JSON.stringify(verified)).toBe(0);
    },
);
