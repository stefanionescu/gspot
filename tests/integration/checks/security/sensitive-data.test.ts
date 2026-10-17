import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { hasToolBuild } from '#tests/setup/system.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { SEMGREP_CHECK } from '#tests/data/checks/security/semgrep-rules.ts';

import {
    SENSITIVE_FILES,
    SENSITIVE_FINDINGS,
    FIXED_SENSITIVE_FILES,
} from '#tests/data/checks/security/sensitive-data.ts';

test.skipIf(!hasToolBuild('semgrep'))(
    'Semgrep reports secrets in log calls and UserDefaults, and passes after the fix',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['javascript', 'swift', 'security'], { level: 'all' }),
            ...SENSITIVE_FILES,
        });

        await installToolProjects(sandbox.path);
        const failed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings: reports }) =>
            reports.map(({ file, line, rule }) => ({ file, line, rule })),
        );
        expect(findings).toStrictEqual([...SENSITIVE_FINDINGS]);
        const jwt = (JSON.parse(failed.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .find((finding) => finding.rule === 'gspot.javascript.jwt-no-algorithm-none');
        expect(jwt?.message).toBe(
            'Require the expected JWT signing algorithms when verifying a token. Pass an algorithms option that matches the signing contract.',
        );
        expect(
            await Promise.all(Object.keys(SENSITIVE_FILES).map((file) => Bun.file(join(sandbox.path, file)).text())),
        ).toStrictEqual(Object.values(SENSITIVE_FILES));
        for (const [file, source] of Object.entries(FIXED_SENSITIVE_FILES))
            await Bun.write(join(sandbox.path, file), source);
        const corrected = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(
            await Promise.all(
                Object.keys(FIXED_SENSITIVE_FILES).map((file) => Bun.file(join(sandbox.path, file)).text()),
            ),
        ).toStrictEqual(Object.values(FIXED_SENSITIVE_FILES));
    },
);
