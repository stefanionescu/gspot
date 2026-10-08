import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';

import {
    SECURITY_FILES,
    SECURITY_SOURCE,
    SUPABASE_SOURCE,
    SECURITY_FINDINGS,
    SECURITY_CORRECTION,
    SUPABASE_CORRECTION,
    SECURITY_SCOPE_POLICY,
    SUPABASE_SCOPE_POLICY,
    SUPABASE_SOURCE_PATHS,
} from '#tests/config/tools/generation/security.ts';

test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    '%s security rules follow JWT dependencies and Express scopes with one runtime rule identity',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { level, tables: SECURITY_SCOPE_POLICY }),
            ...SECURITY_FILES,
        });
        const environment = await sharePythonTools(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = await spawnGspot(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        for (const scope of ['', 'app', 'app/child', 'sibling']) {
            const expected = scope.startsWith('app') ? SECURITY_FINDINGS : SECURITY_FINDINGS.slice(3);
            const findings = report.checks.filter((check) => check.scope === scope).flatMap((check) => check.findings);
            expect(
                findings.map(({ file, line, rule }) => ({ file, line, rule })).toSorted((a, b) => a.line! - b.line!),
            ).toStrictEqual(
                expected.map((finding) => ({ file: scope === '' ? 'source.js' : `${scope}/source.js`, ...finding })),
            );
            expect(await Bun.file(join(sandbox.path, scope, 'source.js')).text()).toBe(SECURITY_SOURCE);
            await Bun.write(join(sandbox.path, scope, 'source.js'), SECURITY_CORRECTION);
        }
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    },
);

test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    '%s manual Supabase selection reports Deno secret logs in root and child scopes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['supabase', 'security'], { level, tables: SUPABASE_SCOPE_POLICY }),
            ...Object.fromEntries(SUPABASE_SOURCE_PATHS.map((path) => [path, SUPABASE_SOURCE])),
        });
        const environment = await sharePythonTools(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = await spawnGspot(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(
            report.checks
                .flatMap((check) => check.findings)
                .map(({ file, line, rule }) => ({ file, line, rule }))
                .toSorted((a, b) => a.file.localeCompare(b.file)),
        ).toStrictEqual(
            SUPABASE_SOURCE_PATHS.map((file) => ({
                file,
                line: 1,
                rule: 'gspot.javascript.no-secret-in-log',
            })).toSorted((a, b) => a.file.localeCompare(b.file)),
        );
        for (const path of SUPABASE_SOURCE_PATHS) {
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(SUPABASE_SOURCE);
            await Bun.write(join(sandbox.path, path), SUPABASE_CORRECTION);
        }
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    },
);
