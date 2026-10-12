import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { DEEPEST_SCOPE_SETTINGS } from '#tests/config/xcode.ts';

test.each([...DEEPEST_SCOPE_SETTINGS])(
    '%s checks the deepest scope only',
    async (check, path, broken, corrected, rule) => {
        await using sandbox = await testdir();
        const rootContent =
            check === 'xcode/entitlements' ? corrected.replace('nested-capability', 'root-capability') : corrected;
        const settings = settingsText(['xcode'], {
            tables: '[xcode]\nallowed_entitlements = ["root-capability"]\n[[scope]]\npath = "app"\n[scope.xcode]\nallowed_entitlements = ["nested-capability"]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
            level: 'all',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            [path]: rootContent,
            [`app/${path}`]: corrected,
            [`app/child/${path}`]: broken,
            [`sibling/${path}`]: rootContent,
        });
        const command = ['check', '--only', check, '--json'];
        const result = await checkReport(sandbox.path, command);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const report = result.report;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'passed' },
            { scope: 'app/child', status: 'failed' },
            { scope: 'sibling', status: 'passed' },
        ]);
        expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: `app/child/${path}`, line: 1, rule },
        ]);
    },
);
