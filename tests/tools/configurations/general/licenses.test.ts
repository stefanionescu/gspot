// The native scanner accepts allowed license alternatives and reports a disallowed dependency.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { buildSandboxPath, installToolProjects } from '#tests/harness/install.ts';
import { ROOT, LICENSE_CHECK } from '#tests/config/tools/configurations/general/licenses.ts';

test(
    'native license scanning accepts allowed alternatives and rejects a disallowed dependency',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'package.json': ROOT,
            '.gitignore': 'node_modules/\n',
            'node_modules/kind/package.json': JSON.stringify({ name: 'kind', version: '1.0.0', license: 'MIT' }),
            'node_modules/choice/package.json': JSON.stringify({
                name: 'choice',
                version: '1.0.0',
                license: 'MIT OR (GPL-3.0-only AND GPL-2.0-only)',
            }),
            'node_modules/combined/package.json': JSON.stringify({
                name: 'combined',
                version: '1.0.0',
                license: 'MIT AND (Apache-2.0 OR GPL-3.0-only)',
            }),
        });
        commitAll(root);
        const environment = { PATH: buildSandboxPath(['typos', 'ec']) };
        for (const command of [buildInitArguments(['licenses']), ['set', 'licenses.allowed', '["MIT","Apache-2.0"]']]) {
            const prepared = await spawnGspot(root, command, environment);
            expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
        }
        await installToolProjects(root);
        const baseline = await spawnGspot(root, LICENSE_CHECK, environment);
        expect(baseline.code, baseline.stdout + baseline.stderr).toBe(0);
        expect((JSON.parse(baseline.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
        await Bun.write(
            join(root, 'node_modules/strict/package.json'),
            JSON.stringify({ name: 'strict', version: '1.0.0', license: 'GPL-3.0-only' }),
        );
        const checked = await spawnGspot(root, LICENSE_CHECK, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect((JSON.parse(checked.stdout) as RunReport).checks[0]?.findings).toStrictEqual([
            containing({
                file: 'package.json',
                line: 1,
                rule: 'disallowed-license',
                message: textContaining('strict@1.0.0 reports GPL-3.0-only'),
            }),
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
