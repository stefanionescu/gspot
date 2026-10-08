import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

import {
    CODEQL_FILE,
    CODEQL_LINE,
    CODEQL_RULE,
    CODEQL_COLUMN,
    CODEQL_SAMPLE,
    CODEQL_LANGUAGE,
    CODEQL_CORRECTED,
} from '#tests/config/tools/configurations/general/codeql.ts';

// CodeQL ships no arm64 Linux build; its pin says where it runs.
describe.if(hasToolBuild('codeql'))('the pinned CodeQL', () => {
    test('pinned CodeQL reports SQL injection in Python and accepts a parameterized query without changing sources', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['security'], {
                tables: `[tools.codeql]\nlanguages = ["${CODEQL_LANGUAGE}"]\n`,
                level: 'all',
            }),
            [CODEQL_FILE]: CODEQL_SAMPLE,
            'authored.txt': 'Preserve this file.\n',
        });
        const environment = { PATH: buildToolsPath(['codeql']) };
        const command = ['check', '--only', 'security/codeql', '--json'];
        const testRepository = await spawnGspot(directory.path, command, environment);
        expect(testRepository.code, testRepository.stdout + testRepository.stderr).toBe(1);
        const report = JSON.parse(testRepository.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'security/codeql', status: 'failed' }]);
        expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
            {
                check: 'security/codeql',
                rule: CODEQL_RULE,
                file: CODEQL_FILE,
                line: CODEQL_LINE,
                column: CODEQL_COLUMN,
            },
        ]);
        expect(await readFile(join(directory.path, CODEQL_FILE), 'utf8')).toBe(CODEQL_SAMPLE);
        await Bun.write(join(directory.path, CODEQL_FILE), CODEQL_CORRECTED);
        const fixed = await spawnGspot(directory.path, command, environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        const fixedReport = JSON.parse(fixed.stdout) as RunReport;
        expect(fixedReport.checks).toMatchObject([{ check: 'security/codeql', status: 'passed', findings: [] }]);
        expect(await readFile(join(directory.path, CODEQL_FILE), 'utf8')).toBe(CODEQL_CORRECTED);
        expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('Preserve this file.\n');
    });
});
