import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';

test('Swift checks report each scope independently and file-list inputs omit sibling sources', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift", "xctest"]\n[[scope]]\npath = "apps/second"\n',
        'Tests/RootTests.swift': 'import XCTest\nfunc testRoot() throws { throw XCTSkip() }\n',
        'apps/second/Tests/SecondTests.swift': 'import XCTest\nfunc testSecond() throws { throw XCTSkip() }\n',
    });
    const failed = await run(sandbox.path, ['check', '--only', 'xctest/disabled', '--no-cache', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        reportSchema.parse(JSON.parse(failed.stdout)).checks.map((check) => ({
            scope: check.scope,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([
        { scope: '', files: ['Tests/RootTests.swift'] },
        { scope: 'apps/second', files: ['apps/second/Tests/SecondTests.swift'] },
    ]);
    await Bun.write(
        `${sandbox.path}/Tests/RootTests.swift`,
        'import XCTest\nfunc testRoot() throws { throw XCTSkip("Requires a physical device") }\n',
    );
    await Bun.write(
        `${sandbox.path}/apps/second/Tests/SecondTests.swift`,
        'import XCTest\nfunc testSecond() throws { throw XCTSkip("Requires a physical device") }\n',
    );
    const corrected = await run(sandbox.path, ['check', '--only', 'xctest/disabled', '--no-cache', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([
    ['xcode/xcconfig', 'Build.xcconfig', 'PRODUCT_NAME App\n', 'PRODUCT_NAME = App\n', 'xcconfig-line'],
    [
        'xcode/xcstrings',
        'Localizable.xcstrings',
        '{"strings":{"one":{"localizations":{"de":{},"en":{}}},"two":{"localizations":{"en":{}}}}}',
        '{"strings":{}}',
        'missing-translation',
    ],
    [
        'xcode/asset-catalogs',
        'Assets.xcassets/Logo.imageset/Contents.json',
        '{"images":[]}',
        '{"images":[{"filename":"logo.png"}]}',
        'empty-set',
    ],
    [
        'xcode/entitlements-policy',
        'App.entitlements',
        '<plist><dict><key>unlisted-capability</key><true/></dict></plist>',
        '<plist><dict><key>nested-capability</key><true/></dict></plist>',
        'entitlement',
    ],
    [
        'xcode/ats',
        'Info.plist',
        '<plist><dict><key>NSAllowsArbitraryLoads</key><true/></dict></plist>',
        '<plist><dict/></plist>',
        'arbitrary-loads',
    ],
    [
        'xcode/test-plan',
        'App.xcodeproj/xcshareddata/xcschemes/App.xcscheme',
        '<Scheme><TestAction><TestableReference/></TestAction></Scheme>',
        '<Scheme><TestAction><TestableReference/><TestPlanReference/></TestAction></Scheme>',
        'scheme-plan',
    ],
] as const)(
    '%s checks the deepest scope and preserves sibling settings',
    async (check, path, broken, corrected, rule) => {
        await using sandbox = await testdir();
        const rootContent =
            check === 'xcode/entitlements-policy'
                ? corrected.replace('nested-capability', 'root-capability')
                : corrected;
        const policy =
            'version = 1\nlevel = "all"\nconfigurations = ["xcode"]\n[tools.xcode]\nentitlements_allowed = ["root-capability"]\n[[scope]]\npath = "app"\n[scope.tools.xcode]\nentitlements_allowed = ["nested-capability"]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'Source.swift': 'let logo = Image("Logo")\n',
            'app/Source.swift': 'let logo = Image("Logo")\n',
            'app/child/Source.swift': 'let logo = Image("Logo")\n',
            'sibling/Source.swift': 'let logo = Image("Logo")\n',
            [path]: rootContent,
            [`app/${path}`]: corrected,
            [`app/child/${path}`]: broken,
            [`sibling/${path}`]: rootContent,
            ...Object.fromEntries(
                ['', 'app/', 'app/child/', 'sibling/'].map((prefix) => [
                    `${prefix}Assets.xcassets/Logo.imageset/logo.png`,
                    new Uint8Array([0, 1, 2]),
                ]),
            ),
        });
        const command = ['check', '--only', check, '--no-cache', '--json'];
        const result = await run(sandbox.path, command);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const report = JSON.parse(result.stdout) as {
            checks: { scope: string; status: string; findings: { file: string; line: number; rule: string }[] }[];
        };
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'ok' },
            { scope: 'app', status: 'ok' },
            { scope: 'app/child', status: 'fail' },
            { scope: 'sibling', status: 'ok' },
        ]);
        expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: `app/child/${path}`, line: 1, rule },
        ]);
        await Bun.write(`${sandbox.path}/app/child/${path}`, corrected);
        const fixed = await run(sandbox.path, command);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(rootContent);
        expect(await Bun.file(`${sandbox.path}/sibling/${path}`).text()).toBe(rootContent);
    },
);

test.each(['recommended', 'all'] as const)('orphan assets follow %s and tracked scoped exceptions', async (level) => {
    await using sandbox = await testdir();
    const catalog = 'app/Assets.xcassets/Logo.imageset/Contents.json';
    const policy = `version = 1\nlevel = "${level}"\nconfigurations = ["xcode"]\n[[scope]]\npath = "app"\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        [catalog]: '{"images":[{"filename":"logo.png"}]}\n',
        'app/Assets.xcassets/Logo.imageset/logo.png': new Uint8Array([0, 1, 2]),
        'Sibling.swift': 'let image = Image("Logo")\n',
    });
    const command = ['check', '--only', 'xcode/asset-catalogs', '--json', '--no-cache'];
    const result = await run(sandbox.path, command);
    expect(result.code, result.stdout + result.stderr).toBe(level === 'all' ? 1 : 0);
    const findings = reportSchema.parse(JSON.parse(result.stdout)).checks.flatMap((entry) => entry.findings);
    expect(findings).toHaveLength(level === 'all' ? 1 : 0);
    await Bun.write(`${sandbox.path}/app/Source.swift`, 'let image = Image("Logo")\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await Bun.write(`${sandbox.path}/app/Source.swift`, 'let image = "selected at runtime"\n');
    const exception =
        '\n[[ignore]]\ncheck = "xcode/asset-catalogs"\nrule = "orphan-asset"\npaths = ["app/Assets.xcassets/**"]\nreason = "Assets are selected by a runtime catalog."\n';
    await Bun.write(`${sandbox.path}/gspot.toml`, policy + exception);
    const allowed = await run(sandbox.path, command);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    expect(await Bun.file(`${sandbox.path}/${catalog}`).text()).toBe('{"images":[{"filename":"logo.png"}]}\n');
});
