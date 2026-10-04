import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { PYTHON_QUERY } from '#tests/config/tools/configurations/general/codeql.ts';

// CodeQL ships no arm64 Linux build; its pin says where it runs.
describe.if(hasToolBuild('codeql'))('the pinned CodeQL', () => {
    test(
        'pinned CodeQL reports SQL injection in Python and accepts a parameterized query without changing sources',
        async () => {
            const { language, file, unsafe, corrected, rule, line, column } = PYTHON_QUERY;
            await using directory = await testdir();
            await createFileTree(directory.path, {
                'gspot.toml': buildPolicy(['security'], {
                    tables: `[tools.codeql]\nlanguages = ["${language}"]\n`,
                    level: 'all',
                }),
                [file]: unsafe,
                'authored.txt': 'Preserve this file.\n',
            });
            const environment = { PATH: buildToolsPath(['codeql']) };
            const command = ['check', '--only', 'security/codeql', '--json'];
            const testRepository = await spawnGspot(directory.path, command, environment);
            expect(testRepository.code, testRepository.stdout + testRepository.stderr).toBe(1);
            const report = JSON.parse(testRepository.stdout) as RunReport;
            expect(report.checks).toMatchObject([{ check: 'security/codeql', status: 'failed' }]);
            expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
                { check: 'security/codeql', rule, file, line, column },
            ]);
            expect(readFileSync(join(directory.path, file), 'utf8')).toBe(unsafe);
            await Bun.write(join(directory.path, file), corrected);
            const fixed = await spawnGspot(directory.path, command, environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            const fixedReport = JSON.parse(fixed.stdout) as RunReport;
            expect(fixedReport.checks).toMatchObject([{ check: 'security/codeql', status: 'passed', findings: [] }]);
            expect(readFileSync(join(directory.path, file), 'utf8')).toBe(corrected);
            expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('Preserve this file.\n');
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
