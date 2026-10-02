// Planted repository for the css configuration: an unknown property, a class nobody reads, and a class the code reads that does not exist.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { run } from '#tests/support/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';

test(
    'Stylelint applies nested settings through each generated configuration and editor pointer',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['css'],
                '[runner]\ntool = "mise"\n[guides]\ninstall = false\n[tools.stylelint.rules]\ncolor-named = "never"\nselector-max-id = 0\n[[scope]]\npath = "app"\nkits = []\n[scope.tools.stylelint.rules]\ncolor-named = "always-where-possible"\n',
                'all',
            ),
            'package.json': '{"private":true}\n',
            'site.css': 'a {\n    color: red;\n}\n',
            'app/site.css': '#example {\n    color: #f00;\n}\n',
        });
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const command = ['check', '--only', 'css/stylelint', '--json'];
        const failed = await run(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const failedReport = JSON.parse(failed.stdout) as RunReport;
        expect(failedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'fail' },
            { check: 'css/stylelint', scope: 'app', status: 'fail' },
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
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toContainEqual(
            containing({ check: 'css/stylelint', status: 'ok', findings: [] }),
        );
        for (const folder of ['', 'app']) {
            const native = await processes.run([join(sandbox.path, '.gspot/node_modules/.bin/stylelint'), 'site.css'], {
                cwd: join(sandbox.path, folder),
            });
            expect(native.code, native.stdout + native.stderr).toBe(0);
        }
    },
    PLANTED_TIMEOUT_MS * 5,
);
