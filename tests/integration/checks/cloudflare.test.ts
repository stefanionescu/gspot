import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { SEMGREP_CHECK } from '#tests/config/execution.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';

import {
    WRANGLER,
    WRANGLER_CASE,
    WRANGLER_FORMATS,
    CLOUDFLARE_SANDBOX,
    PLATFORM_PATH_CASES,
} from '#tests/config/cloudflare.ts';

const installedSandbox = shareInstalledSandbox(CLOUDFLARE_SANDBOX);

test.each([...WRANGLER_CASE])(
    'cloudflare/wrangler reports a missing compatibility date and passes after the fix',
    async (entry) => {
        const outcome = await runCheckSample(installedSandbox(), entry, {
            ...CLOUDFLARE_SANDBOX,
            corrected: () => ({ files: { 'wrangler.jsonc': WRANGLER } }),
        });
        expect(outcome.failed.code, outcome.failed.stderr).toBe(1);
        expect(outcome.failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
        expect(outcome.failed.report.checks[0]?.findings).toContainEqual(
            containing({ check: entry.check, ...entry.expected }),
        );
        expect(outcome.passed.code, outcome.passed.stderr).toBe(0);
        expect(outcome.passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
    },
);

test('cloudflare/wrangler reports every wrong value in each file format and scope', async () => {
    await createFileTree(installedSandbox().root, {
        'gspot.toml': settingsText(['cloudflare'], {
            level: 'all',
            tables: `[[scope]]
path = "app"

configurations = ["cloudflare"]
`,
        }),
    });
    for (const { name, broken, corrected } of WRANGLER_FORMATS) {
        for (const scope of ['', 'app']) {
            const path = scope === '' ? name : `${scope}/${name}`;
            await createFileTree(installedSandbox().root, { [path]: broken });
            const failed = await spawnGspot(installedSandbox().root, [
                'check',
                path,
                '--only',
                'cloudflare/wrangler',
                '--json',
            ]);
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
            expect(findings).toStrictEqual([
                containing({ file: path, message: '/name must be string' }),
                containing({ file: path, message: '/workers_dev must be boolean' }),
                containing({
                    file: path,
                    line: 1,
                    rule: 'missing-name',
                    message: 'The configuration names no worker.',
                }),
            ]);
            await Bun.write(join(installedSandbox().root, path), corrected);
            const passed = await spawnGspot(installedSandbox().root, [
                'check',
                path,
                '--only',
                'cloudflare/wrangler',
                '--json',
            ]);
            expect(passed.code, passed.stdout + passed.stderr).toBe(0);
            expect((JSON.parse(passed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual(
                [],
            );
        }
    }
});

for (const level of ['recommended', 'all'] as const) {
    // The pinned semgrep tool has no build for some operating systems.
    test.skipIf(!hasToolBuild('semgrep')).each([...PLATFORM_PATH_CASES])(
        `native $configuration path rules cover root and child sources at ${level}`,
        async ({ configuration, settings, files, corrected, expected, allExpected }) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': settingsText(['javascript', configuration], { level, tables: settings }),
                ...files,
            });
            const applied = await spawnGspot(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            await installToolProjects(sandbox.path);
            const before = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            const failed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            expect(
                (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
                    findings.map(({ file, line, rule }) => ({ file, line, rule })),
                ),
            ).toStrictEqual(
                expected.flatMap((finding) => [
                    finding,
                    ...(level === 'all' ? allExpected.filter(({ file }) => file === finding.file) : []),
                ]),
            );
            for (const [path, source] of Object.entries(corrected)) await Bun.write(join(sandbox.path, path), source);
            const passed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
            expect(passed.code, passed.stdout + passed.stderr).toBe(0);
            expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(before);
            for (const [path, source] of Object.entries(corrected))
                expect(await Bun.file(join(sandbox.path, path)).text()).toBe(source);
            for (const [path, source] of Object.entries(files)) {
                if (Object.hasOwn(corrected, path)) continue;
                expect(await Bun.file(join(sandbox.path, path)).text()).toBe(source);
            }
        },
    );
}
