// Test repository for the css configuration: an unknown property, a class nobody reads, and a class the code reads that does not exist.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { installPrivateTools } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

test(
    'Stylelint applies nested settings through each generated configuration and editor pointer',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['css'], {
                tables: 'run_with = "mise"\n[agent_rules]\nenabled = false\n[tools.stylelint.rules]\ncolor-named = "never"\nselector-max-id = 0\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.stylelint.rules]\ncolor-named = "always-where-possible"\n',
                level: 'all',
            }),
            'package.json': '{"private":true}\n',
            'site.css': 'a {\n    color: red;\n}\n',
            'app/site.css': '#example {\n    color: #f00;\n}\n',
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const command = ['check', '--only', 'css/stylelint', '--json'];
        const failed = await spawnGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const failedReport = JSON.parse(failed.stdout) as RunReport;
        expect(failedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'failed' },
            { check: 'css/stylelint', scope: 'app', status: 'failed' },
        ]);
        expect(failedReport.checks.flatMap(({ findings }) => findings)).toStrictEqual(
            containingAll([
                containing({ file: 'site.css', rule: 'color-named', line: 2 }),
                containing({ file: 'app/site.css', rule: 'color-named', line: 2 }),
                containing({ file: 'app/site.css', rule: 'selector-max-id', line: 1 }),
            ]),
        );
        await Bun.write(join(sandbox.path, 'site.css'), 'a {\n    color: #f00;\n}\n');
        await Bun.write(join(sandbox.path, 'app/site.css'), 'a {\n    color: red;\n}\n');
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toContainEqual(
            containing({ check: 'css/stylelint', status: 'passed', findings: [] }),
        );
        for (const folder of ['', 'app']) {
            const native = await runTestCommand(
                [join(sandbox.path, '.gspot/node_modules/.bin/stylelint'), 'site.css'],
                {
                    cwd: join(sandbox.path, folder),
                },
            );
            expect(native.code, native.stdout + native.stderr).toBe(0);
        }
    },
    NATIVE_TEST_TIMEOUT_MS,
);
