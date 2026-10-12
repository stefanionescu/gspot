import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { toolsPath } from '#tests/setup/install.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { CODEQL_FILE, CODEQL_FIXED, CODEQL_SAMPLE } from '#tests/config/security.ts';

// CodeQL ships no arm64 Linux build; its pin says where it runs.
test.skipIf(!hasToolBuild('codeql'))(
    'CodeQL reports SQL injection in Python and passes a parameterized query',
    async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': settingsText(['security'], {
                tables: `[tools.codeql]\nlanguages = ["python"]\n`,
                level: 'all',
            }),
            [CODEQL_FILE]: CODEQL_SAMPLE,
            'authored.txt': 'Preserve this file.\n',
        });
        const environment = { PATH: toolsPath() };
        const command = ['check', '--only', 'security/codeql', '--json'];
        const testRepository = await spawnGspot(directory.path, command, environment);
        expect(testRepository.code, testRepository.stdout + testRepository.stderr).toBe(1);
        const report = JSON.parse(testRepository.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'security/codeql', status: 'failed' }]);
        expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
            {
                check: 'security/codeql',
                rule: 'py/sql-injection',
                file: CODEQL_FILE,
                line: 6,
                column: 42,
            },
        ]);
        expect(await readFile(join(directory.path, CODEQL_FILE), 'utf8')).toBe(CODEQL_SAMPLE);
        await Bun.write(join(directory.path, CODEQL_FILE), CODEQL_FIXED);
        const fixed = await spawnGspot(directory.path, command, environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        const fixedReport = JSON.parse(fixed.stdout) as RunReport;
        expect(fixedReport.checks).toMatchObject([{ check: 'security/codeql', status: 'passed', findings: [] }]);
        expect(await readFile(join(directory.path, CODEQL_FILE), 'utf8')).toBe(CODEQL_FIXED);
        expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('Preserve this file.\n');
    },
);
