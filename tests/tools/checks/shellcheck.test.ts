import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { DIALECT_SOURCES, DIALECT_CORRECTIONS } from '#tests/config/tools/checks/shellcheck.ts';

test.each(['recommended', 'all'] as const)(
    '%s checks native shell dialects, keeps one cd owner, and formats POSIX scripts with tabs',
    async (level) => {
        await using sandbox = await testdir();
        const environment = { PATH: buildToolsPath(['shellcheck', 'shfmt']) };
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], {
                level,
                tables: '[format]\nindent_style = "tab"\n[[scope]]\npath = "app"\n',
            }),
            ...DIALECT_SOURCES,
        });
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const command = ['check', '--only', 'bash/shellcheck', 'bash/safety', '--json'];
        const checked = await spawnGspot(sandbox.path, command, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(
            report.checks
                .filter(({ check }) => check === 'bash/safety')
                .map(({ scope, status, findings }) => ({ scope, status, findings })),
        ).toStrictEqual([
            { scope: '', status: 'passed', findings: [] },
            { scope: 'app', status: 'passed', findings: [] },
        ]);
        expect(
            report.checks
                .flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))
                .toSorted((left, right) => left.file.localeCompare(right.file)),
        ).toStrictEqual([
            { file: 'app/posix.sh', rule: 'SC3010' },
            { file: 'dash.sh', rule: 'SC3010' },
            { file: 'posix.sh', rule: 'SC3010' },
            { file: 'unchecked.sh', rule: 'SC2164' },
        ]);
        for (const [path, source] of Object.entries(DIALECT_SOURCES))
            expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(source);
        await createFileTree(sandbox.path, DIALECT_CORRECTIONS);
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const clean = JSON.parse(corrected.stdout) as RunReport;
        expect(
            clean.checks
                .filter(({ check }) => check === 'bash/shellcheck')
                .map(({ scope, status, fileCount, findings }) => ({ scope, status, fileCount, findings })),
        ).toStrictEqual([
            { scope: '', status: 'passed', fileCount: 6, findings: [] },
            { scope: 'app', status: 'passed', fileCount: 2, findings: [] },
        ]);
        const formatted = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'bash/shfmt', '--fix', '--json'],
            environment,
        );
        expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
        for (const path of ['posix.sh', 'dash.sh', 'app/posix.sh'])
            expect(readFileSync(join(sandbox.path, path), 'utf8')).toContain('\n\tprintf ');
        const stable = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shfmt', '--json'], environment);
        expect(stable.code, stable.stdout + stable.stderr).toBe(0);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
