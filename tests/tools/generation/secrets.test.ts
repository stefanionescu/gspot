import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installGeneratedPythonTools } from '#tests/harness/python-installation.ts';
import { SENSITIVE_FILES, SENSITIVE_FINDINGS, SENSITIVE_CORRECTIONS } from '#tests/config/tools/generation/secrets.ts';

test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    'sensitive data rules detect logger values and UserDefaults instances at level %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript', 'swift', 'security'], { level }),
            ...SENSITIVE_FILES,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const environment = await installGeneratedPythonTools(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = await spawnGspot(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings: reports }) =>
            reports.map(({ file, line, rule }) => ({ file, line, rule })),
        );
        expect(findings).toStrictEqual(SENSITIVE_FINDINGS);
        const jwt = (JSON.parse(failed.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .find((finding) => finding.rule === 'gspot.javascript.jwt-no-algorithm-none');
        expect(jwt?.message).toBe(
            'Require the expected JWT signing algorithms when verifying a token. Pass an algorithms option that matches the signing contract.',
        );
        expect(
            await Promise.all(Object.keys(SENSITIVE_FILES).map((file) => Bun.file(join(sandbox.path, file)).text())),
        ).toStrictEqual(Object.values(SENSITIVE_FILES));
        for (const [file, source] of Object.entries(SENSITIVE_CORRECTIONS))
            await Bun.write(join(sandbox.path, file), source);
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(
            await Promise.all(
                Object.keys(SENSITIVE_CORRECTIONS).map((file) => Bun.file(join(sandbox.path, file)).text()),
            ),
        ).toStrictEqual(Object.values(SENSITIVE_CORRECTIONS));
    },
);
