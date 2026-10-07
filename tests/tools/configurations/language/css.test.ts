// Native Stylelint checks coverage levels, scoped options, and authored source under folders named build.
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { installToolProjects } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { suiteTimeout, openTestBudget, runTestCommand } from '#tests/harness/command.ts';

import {
    FILES,
    TABLES,
    CORRECTED,
    TAILWIND_FILES,
    TAILWIND_TABLES,
    TAILWIND_CONFIGURATIONS,
} from '#tests/config/tools/configurations/language/css.ts';

const resources = new AsyncDisposableStack();
let root: string;
beforeAll(async () => {
    const budget = openTestBudget(suiteTimeout());
    try {
        root = resources.use(await testdir()).path;
        await createFileTree(root, {
            'gspot.toml': buildPolicy(['css'], { level: 'all', tables: TABLES }),
            'package.json': '{"private":true}\n',
            ...FILES,
        });
        const applied = await spawnGspot(root, ['apply']);
        if (applied.code !== 0) throw new Error(applied.stdout + applied.stderr);
        await installToolProjects(root);
    } finally {
        budget[Symbol.dispose]();
    }
}, suiteTimeout());
afterAll(async () => {
    await resources.disposeAsync();
});

test.each(['recommended', 'all'] as const)(
    '%s Stylelint applies scoped native options without enabling additional checks',
    async (level) => {
        await createFileTree(root, {
            'gspot.toml': buildPolicy(['css'], { level, tables: TABLES }),
            'package.json': '{"private":true}\n',
            ...FILES,
        });
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const command = ['check', '--only', 'css/stylelint', '--json'];
        const failed = await spawnGspot(root, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const failedReport = JSON.parse(failed.stdout) as RunReport;
        expect(failedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'failed' },
            { check: 'css/stylelint', scope: 'app', status: 'failed' },
        ]);
        const findings = failedReport.checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual(
            containingAll([
                containing({ file: 'build/site.css', rule: 'color-hex-length', line: 2 }),
                containing({ file: 'app/site.css', rule: 'color-hex-length', line: 2 }),
                containing({ file: 'build/site.css', rule: 'property-no-vendor-prefix', line: 4 }),
                containing({ file: 'app/site.css', rule: 'property-no-vendor-prefix', line: 4 }),
            ]),
        );
        expect(findings.filter(({ rule }) => rule === 'selector-max-id')).toStrictEqual([]);
        expect(findings.filter(({ rule }) => rule === 'number-max-precision').map(({ file }) => file)).toStrictEqual(
            level === 'all' ? ['build/site.css', 'app/site.css'] : [],
        );
        await createFileTree(root, CORRECTED);
        const corrected = await spawnGspot(root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const correctedReport = JSON.parse(corrected.stdout) as RunReport;
        expect(correctedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'passed', findings: [] },
            { check: 'css/stylelint', scope: 'app', status: 'passed', findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'Stylelint editor discovery lints authored build paths with the scoped options',
    async () => {
        await createFileTree(root, {
            'gspot.toml': buildPolicy(['css'], { level: 'all', tables: TABLES }),
            'package.json': '{"private":true}\n',
            ...FILES,
        });
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const tool = join(root, '.gspot/node_modules/.bin/stylelint');
        const failed = await runTestCommand([tool, 'build/site.css'], { cwd: root });
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stdout + failed.stderr).toContain('property-no-vendor-prefix');
        await createFileTree(root, CORRECTED);
        for (const folder of ['', 'app']) {
            const native = await runTestCommand([tool, folder === '' ? 'build/site.css' : 'site.css'], {
                cwd: join(root, folder),
            });
            expect(native.code, native.stdout + native.stderr).toBe(0);
        }
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.each(['recommended', 'all'] as const)(
    '%s recognizes Tailwind only within its declared project',
    async (level) => {
        await createFileTree(root, {
            'gspot.toml': buildPolicy(TAILWIND_CONFIGURATIONS, { level, tables: TAILWIND_TABLES }),
            ...TAILWIND_FILES,
        });
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const command = ['check', '--only', 'css/stylelint', '--json'];
        const failed = await spawnGspot(root, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.find((check) => check.scope === 'app')).toMatchObject({
            status: 'passed',
            findings: [],
        });
        expect(report.checks.flatMap((check) => check.findings)).toStrictEqual(
            containingAll([
                containing({ file: 'build/site.css', rule: 'at-rule-no-unknown', line: 1 }),
                containing({ file: 'other/site.css', rule: 'at-rule-no-unknown', line: 1 }),
                containing({ file: 'build/site.css', rule: 'function-no-unknown', line: 4 }),
                containing({ file: 'other/site.css', rule: 'function-no-unknown', line: 4 }),
            ]),
        );
        await Bun.write(join(root, 'app/site.css'), 'a { color: #ggg; }\n');
        const invalidValue = await spawnGspot(root, ['check', 'app', '--only', 'css/stylelint', '--json']);
        expect(invalidValue.code, invalidValue.stdout + invalidValue.stderr).toBe(1);
        expect((JSON.parse(invalidValue.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual(
            containingAll([
                containing({ file: 'app/site.css', rule: 'declaration-property-value-no-unknown', line: 1 }),
            ]),
        );
        await Bun.write(join(root, 'app/site.css'), TAILWIND_FILES['app/site.css']);
        await Bun.write(join(root, 'build/site.css'), 'a { color: red; }\n');
        await Bun.write(join(root, 'other/site.css'), 'a { color: red; }\n');
        const corrected = await spawnGspot(root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { scope: '', status: 'passed', findings: [] },
            { scope: 'app', status: 'passed', findings: [] },
            { scope: 'other', status: 'passed', findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
