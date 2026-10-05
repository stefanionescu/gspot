// Test repository for the security configuration: an eval the shipped pack finds, and a rule of the repository's own.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { install, buildToolsPath } from '#tests/harness/install.ts';
import type { Finding, RunReport } from '#cli/types/execution/runtime.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

import {
    OWN_RULE,
    EVALUATED,
    BEARER_FILES,
    SECURITY_INIT,
    SECURITY_CLEAN,
} from '#tests/config/tools/configurations/general/security.ts';

test(
    'the security configuration > the shipped pack and repository rules reject defects and accept corrected files',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...BEARER_FILES,
            'src/index.ts': SECURITY_CLEAN,
            'package.json': '{\n    "name": "example",\n    "private": true\n}\n',
        });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['semgrep', 'typos', 'ec']) };
        await install(sandbox.path, SECURITY_INIT, environment, { level: 'all' });
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const clean = await spawnGspot(sandbox.path, command, environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        await Bun.write(join(sandbox.path, 'src/run.ts'), EVALUATED);
        commitAll(sandbox.path);
        const found = await spawnGspot(sandbox.path, command, environment);
        // Semgrep ships no Windows build, so the check is skipped there and the run passes.
        const isWindows = process.platform === 'win32';
        expect(found.code, found.stdout + found.stderr).toBe(isWindows ? 0 : 1);
        expect((JSON.parse(found.stdout) as RunReport).checks).toMatchObject([
            isWindows
                ? { check: 'security/semgrep', status: 'skipped' }
                : {
                      check: 'security/semgrep',
                      status: 'failed',
                      findings: [
                          containing<Finding>({ rule: 'gspot.javascript.no-eval', file: 'src/run.ts', line: 3 }),
                      ],
                  },
        ]);
        await Bun.write(join(sandbox.path, 'security/own.yml'), OWN_RULE);
        await Bun.write(
            join(sandbox.path, 'src/use.ts'),
            "import { double } from './index.ts';\n\nexport const four = double(2);\n",
        );
        const policy = join(sandbox.path, 'gspot.toml');
        await Bun.write(policy, `${await Bun.file(policy).text()}\n[semgrep]\nrule_files = ["security/own.yml"]\n`);
        commitAll(sandbox.path);
        const own = await spawnGspot(sandbox.path, command, environment);
        expect(own.code, own.stdout + own.stderr).toBe(isWindows ? 0 : 1);
        const report = JSON.parse(own.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'security/semgrep', status: isWindows ? 'skipped' : 'failed' }]);
        expect(report.checks[0]!.findings).toStrictEqual(
            isWindows ? [] : containingAll([containing({ rule: 'test-no-double', file: 'src/use.ts', line: 3 })]),
        );
        await Bun.write(join(sandbox.path, 'src/run.ts'), SECURITY_CLEAN);
        await Bun.write(join(sandbox.path, 'src/use.ts'), 'export const four = 4;\n');
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(
            await Promise.all(
                Object.keys(BEARER_FILES).map(async (path) => [path, await Bun.file(join(sandbox.path, path)).text()]),
            ),
        ).toStrictEqual(Object.entries(BEARER_FILES));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'security/semgrep', status: isWindows ? 'skipped' : 'passed', findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
