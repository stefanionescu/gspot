import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { ENTITLEMENT_DOCUMENTS, ENTITLEMENT_SCOPE_RESULTS } from '#tests/data/checks/xcode.ts';

test('xcode/entitlements checks the deepest scope only', async () => {
    const { path, unlisted: broken, allowed: corrected } = ENTITLEMENT_DOCUMENTS;
    const check = 'xcode/entitlements';
    await using sandbox = await testdir();
    const rootContent = corrected.replace('nested-capability', 'root-capability');
    const settings = buildSandboxSettings(['xcode'], {
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
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: [check] }));
    const report = result.report;
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([...ENTITLEMENT_SCOPE_RESULTS]);
    expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: `app/child/${path}`, line: 1, rule: 'entitlement' },
    ]);
});
