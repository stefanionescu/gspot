import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { INVALID_XCODE_DOCUMENTS } from '#tests/config/cli/checks/tool/xcode/scopes.ts';

test.each([
    ['xcode/xcconfig', 'Build.xcconfig', 'PRODUCT_NAME App\n', 'PRODUCT_NAME = App\n', 'xcconfig-line'],
    [
        'xcode/entitlements',
        'App.entitlements',
        '<plist><dict><key>unlisted-capability</key><true/></dict></plist>',
        '<plist><dict><key>nested-capability</key><true/></dict></plist>',
        'entitlement',
    ],
] as const)(
    '%s checks the deepest scope and preserves sibling settings',
    async (check, path, broken, corrected, rule) => {
        await using sandbox = await testdir();
        const rootContent =
            check === 'xcode/entitlements' ? corrected.replace('nested-capability', 'root-capability') : corrected;
        const policy = buildPolicy(['xcode'], {
            tables: '[tools.xcode]\nentitlements_allowed = ["root-capability"]\n[[scope]]\npath = "app"\n[scope.tools.xcode]\nentitlements_allowed = ["nested-capability"]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
            level: 'all',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            [path]: rootContent,
            [`app/${path}`]: corrected,
            [`app/child/${path}`]: broken,
            [`sibling/${path}`]: rootContent,
        });
        const command = ['check', '--only', check, '--json'];
        const result = await runGspot(sandbox.path, command);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const report = JSON.parse(result.stdout) as RunReport;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'passed' },
            { scope: 'app/child', status: 'failed' },
            { scope: 'sibling', status: 'passed' },
        ]);
        expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: `app/child/${path}`, line: 1, rule },
        ]);
        await Bun.write(`${sandbox.path}/app/child/${path}`, corrected);
        const fixed = await runGspot(sandbox.path, command);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(rootContent);
        expect(await Bun.file(`${sandbox.path}/sibling/${path}`).text()).toBe(rootContent);
    },
);

test.each(['recommended', 'all'] as const)('orphan assets follow %s and tracked scoped exceptions', async (level) => {
    await using sandbox = await testdir();
    const assetManifest = 'app/Assets.xcassets/Logo.imageset/Contents.json';
    const policy = buildPolicy(['xcode'], { tables: '[[scope]]\npath = "app"\n', level });
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        [assetManifest]: '{"images":[{"filename":"logo.png"}]}\n',
        'app/Assets.xcassets/Logo.imageset/logo.png': new Uint8Array([0, 1, 2]),
        'Sibling.swift': 'let image = Image("Logo")\n',
    });
    const command = ['check', '--only', 'xcode/assets', '--json'];
    const result = await runGspot(sandbox.path, command);
    expect(result.code, result.stdout + result.stderr).toBe(level === 'all' ? 1 : 0);
    const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap((entry) => entry.findings);
    expect(findings).toMatchObject(level === 'all' ? [{ file: assetManifest, rule: 'orphan-asset' }] : []);
    if (level === 'recommended') return;
    await Bun.write(`${sandbox.path}/app/Source.swift`, 'let image = Image("Logo")\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await Bun.write(`${sandbox.path}/app/Source.swift`, 'let image = "selected at runtime"\n');
    const exception =
        '\n[[ignore]]\ncheck = "xcode/assets"\nrule = "orphan-asset"\npaths = ["app/Assets.xcassets/**"]\nreason = "Assets are selected by a runtime catalog."\n';
    await Bun.write(`${sandbox.path}/gspot.toml`, policy + exception);
    const allowed = await runGspot(sandbox.path, command);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    expect(await Bun.file(`${sandbox.path}/${assetManifest}`).text()).toBe('{"images":[{"filename":"logo.png"}]}\n');
});

test.each(INVALID_XCODE_DOCUMENTS)('%s reports malformed %s as a source finding', async (check, path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xcode'], { level: 'all' }),
        'Source.swift': 'let image = Image("Logo")\n',
        [path]: text,
    });
    const result = await runGspot(sandbox.path, ['check', '--only', check, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.map(({ status }) => status)).toStrictEqual(['failed']);
    expect(
        report.checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([{ file: path, line: 1, rule: 'syntax' }]);
});
