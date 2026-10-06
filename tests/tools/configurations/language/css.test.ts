// Native Stylelint checks coverage levels, scoped options, and authored source under folders named build.
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { installPrivateTools } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { suiteTimeout, openTestBudget, runTestCommand } from '#tests/harness/command.ts';
import { FILES, TABLES, CORRECTED } from '#tests/config/tools/configurations/language/css.ts';

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
        await installPrivateTools(root);
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
