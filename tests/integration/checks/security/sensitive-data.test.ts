import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SEMGREP_CHECK } from '#tests/data/integration/checks/security/semgrep.ts';
import { spawnGspot, parseCheckReport, installGeneratedTools } from '#tests/setup/cli/commands.ts';

import {
    SENSITIVE_FILES,
    SENSITIVE_FINDINGS,
    CORRECTED_SENSITIVE_FILES,
} from '#tests/data/integration/checks/security/sensitive-data.ts';

test.skipIf(!hasToolBuild('semgrep'))(
    'Semgrep reports secrets in log calls and UserDefaults and a JWT check without algorithms, and passes after the fix',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript', 'swift', 'security'], { level: 'all' }),
            ...SENSITIVE_FILES,
        });

        await installGeneratedTools(sandbox.path);
        const failed = parseCheckReport(await spawnGspot(sandbox.path, SEMGREP_CHECK));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = failed.report;
        const findings = report.checks.flatMap(({ findings: reports }) =>
            reports.map(({ file, line, rule }) => ({ file, line, rule })),
        );
        expect(findings).toStrictEqual([...SENSITIVE_FINDINGS]);
        const jwt = report.checks
            .flatMap((check) => check.findings)
            .find((finding) => finding.rule === 'gspot.javascript.jwt-verify-without-algorithms');
        expect(jwt?.message).toBe(
            'Require the expected JWT signing algorithms when verifying a token. Pass an algorithms option that matches the signing contract.',
        );
        expect(
            await Promise.all(Object.keys(SENSITIVE_FILES).map((file) => readFile(join(sandbox.path, file), 'utf8'))),
        ).toStrictEqual(Object.values(SENSITIVE_FILES));
        for (const [file, source] of Object.entries(CORRECTED_SENSITIVE_FILES))
            await writeFile(join(sandbox.path, file), source);
        const corrected = parseCheckReport(await spawnGspot(sandbox.path, SEMGREP_CHECK));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(
            await Promise.all(
                Object.keys(CORRECTED_SENSITIVE_FILES).map((file) => readFile(join(sandbox.path, file), 'utf8')),
            ),
        ).toStrictEqual(Object.values(CORRECTED_SENSITIVE_FILES));
    },
);
