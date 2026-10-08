import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { SEMGREP_COMMAND } from '#tests/config/tools/generation/semgrep.ts';
import { PLATFORM_PATH_CASES } from '#tests/config/tools/generation/platform-security.ts';

for (const level of ['recommended', 'all'] as const) {
    test.skipIf(!hasToolBuild('semgrep')).each(PLATFORM_PATH_CASES)(
        `native $configuration path rules cover root and child sources at ${level}`,
        async ({ configuration, policy, files, corrected, expected, allExpected }) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': buildPolicy(['javascript', configuration], { level, tables: policy }),
                ...files,
            });
            const environment = await sharePythonTools(sandbox.path);
            const before = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            const failed = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
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
            const passed = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
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
