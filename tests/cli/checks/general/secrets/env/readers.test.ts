import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

import {
    READER_FILES,
    READER_TABLES,
    READER_FINDINGS,
    READER_TEMPLATE,
    PROJECT_READER_FILES,
    PROJECT_READER_TABLES,
    PROJECT_READER_CORRECTIONS,
} from '#tests/config/cli/checks/general/secrets/env/readers.ts';

test.each(['recommended', 'all'] as const)(
    '%s checks Bun and multiple declared readers without an enabling flag',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy([], { level, tables: READER_TABLES });
        await createFileTree(sandbox.path, { ...READER_FILES, 'gspot.toml': policy });
        const command = ['check', '--only', 'secrets/env-template', '--json'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks).toMatchObject([
            { check: 'secrets/env-template', status: 'failed', findings: READER_FINDINGS },
        ]);
        expect(report.checks[0]!.findings).toHaveLength(4);
        await Bun.write(join(sandbox.path, '.env.example'), READER_TEMPLATE);
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'secrets/env-template', status: 'passed', findings: [] },
        ]);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s checks each scope against its own templates and declared readers',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...PROJECT_READER_FILES,
            'gspot.toml': buildPolicy([], { level, tables: PROJECT_READER_TABLES }),
        });
        const command = ['check', '--only', 'secrets/env-template', '--json'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks).toMatchObject([
            { scope: '', status: 'failed', findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }] },
            { scope: 'app', status: 'failed', findings: [{ file: 'app/source.ts', line: 1, rule: 'missing-key' }] },
            {
                scope: 'sibling',
                status: 'failed',
                findings: [{ file: 'sibling/source.ts', line: 1, rule: 'missing-key' }],
            },
        ]);
        expect(report.checks.map((check) => check.findings.length)).toEqual([1, 1, 1]);
        await createFileTree(sandbox.path, PROJECT_READER_CORRECTIONS);
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.map((check) => check.status)).toEqual([
            'passed',
            'passed',
            'passed',
        ]);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s keeps Bun reads active with no custom reader declarations',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { level }),
            '.env.example': 'KNOWN=example\n',
            'source.ts': 'Bun.env.KNOWN; Bun.env["MISSING"];\nconfig.$env("UNDECLARED");\n',
        });
        const checked = await runGspot(sandbox.path, ['check', '--only', 'secrets/env-template', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'secrets/env-template',
                status: 'failed',
                findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }],
            },
        ]);
        expect((JSON.parse(checked.stdout) as RunReport).checks[0]!.findings).toHaveLength(1);
    },
);
