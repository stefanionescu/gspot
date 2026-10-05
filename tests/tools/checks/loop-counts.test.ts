import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { LOOP_COUNTS, COUNTED_LOOPS, CORRECTED_LOOPS } from '#tests/config/tools/checks/loop-counts.ts';

test(
    'native Bash counts include C-style branches and nesting while omitting loop header assignments in each scope',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], {
                level: 'all',
                tables: 'run_with = "mise"\n[limits.bash]\nbranches = 3\nnesting = 3\nassignments = 1\n[[scope]]\npath = "api"\n',
            }),
            'source.sh': COUNTED_LOOPS,
            'api/source.sh': COUNTED_LOOPS,
        });
        const environment = { PATH: buildToolsPath(['ast-grep']) };
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const command = ['check', '--only', 'bash/limits', '--json'];
        const broken = await spawnGspot(sandbox.path, command, environment);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const checks = (JSON.parse(broken.stdout) as RunReport).checks;
        expect(checks.map(({ scope, fileCount }) => ({ scope, fileCount }))).toStrictEqual([
            { scope: '', fileCount: 1 },
            { scope: 'api', fileCount: 1 },
        ]);
        for (const check of checks) {
            expect(
                check.findings.map(({ rule, message: diagnostic }) => ({ rule, message: diagnostic })),
            ).toStrictEqual(LOOP_COUNTS);
            expect(check.findings.map(({ file, line }) => ({ file, line }))).toStrictEqual(
                Array.from({ length: 3 }, () => ({
                    file: check.scope === '' ? 'source.sh' : 'api/source.sh',
                    line: 1,
                })),
            );
        }
        for (const path of ['source.sh', 'api/source.sh']) await Bun.write(join(sandbox.path, path), CORRECTED_LOOPS);
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            (JSON.parse(corrected.stdout) as RunReport).checks.map(({ status, findings }) => ({ status, findings })),
        ).toStrictEqual([
            { status: 'passed', findings: [] },
            { status: 'passed', findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
