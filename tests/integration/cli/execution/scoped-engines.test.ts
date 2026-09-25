import { run } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

const HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: same-origin\n    X-Frame-Options: DENY\n';

test('scoped readers receive their own files and preserve binary asset inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["static-site", "supabase", "i18n"]\n[tools.i18n]\ntranslations = { directory = "messages", base = "en" }\n[[scope]]\npath = "apps/backend"\n',
        _headers: HEADERS,
        'messages/en.json': '{"title":"Home"}',
        'messages/de.json': '{"title":"Start"}',
        'supabase/config.toml': '[functions.root]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'assets/unused.png': new Uint8Array([0, 1, 2, 3]),
        'apps/backend/index.html': '<img src="/assets/unused.png">',
        'apps/backend/_headers': '/*\n    X-Content-Type-Options: nosniff\n',
        'apps/backend/messages/en.json': '{"heading":"Backend"}',
        'apps/backend/messages/de.json': '{}',
        'apps/backend/supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'apps/backend/client.ts': 'const credentialName = "SUPABASE_SERVICE_ROLE_KEY";\n',
    });
    const expected = [
        {
            check: 'supabase/config',
            root: [],
            nested: [expect.objectContaining({ file: 'apps/backend/supabase/config.toml', rule: 'function' })],
        },
        {
            check: 'supabase/admin-key-containment',
            root: [],
            nested: [expect.objectContaining({ file: 'apps/backend/client.ts', rule: 'admin-key' })],
        },
        {
            check: 'i18n/locales',
            root: [],
            nested: [expect.objectContaining({ file: 'apps/backend/messages/de.json' })],
        },
        {
            check: 'integrity/security-headers',
            root: [],
            nested: [
                expect.objectContaining({ file: 'apps/backend/_headers', rule: 'missing-header' }),
                expect.objectContaining({ file: 'apps/backend/_headers', rule: 'missing-header' }),
            ],
        },
        {
            check: 'static-site/dead-assets',
            root: [expect.objectContaining({ file: 'assets/unused.png', rule: 'dead-asset' })],
            nested: [],
        },
    ];
    for (const entry of expected) {
        const result = await run(sandbox.path, ['check', '--only', entry.check, '--no-cache', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(
            JSON.parse(result.stdout).checks.map((check: { scope: string; findings: unknown[] }) => ({
                scope: check.scope,
                findings: check.findings,
            })),
            entry.check,
        ).toStrictEqual([
            { scope: '', findings: entry.root },
            { scope: 'apps/backend', findings: entry.nested },
        ]);
    }
    await Bun.write(`${sandbox.path}/apps/backend/_headers`, HEADERS);
    await Bun.write(`${sandbox.path}/apps/backend/messages/de.json`, '{"heading":"Backend"}');
    await Bun.write(
        `${sandbox.path}/apps/backend/supabase/functions/missing/index.ts`,
        'const key = "SUPABASE_SERVICE_ROLE_KEY";\n',
    );
    await Bun.write(`${sandbox.path}/apps/backend/client.ts`, 'export {};\n');
    await Bun.write(`${sandbox.path}/index.html`, '<img src="/assets/unused.png">');
    for (const entry of expected) {
        const corrected = await run(sandbox.path, ['check', '--only', entry.check, '--no-cache', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    }
});

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
        JSON.parse(failed.stdout).checks.map((check: { scope: string; findings: { file: string }[] }) => ({
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
    const findings = JSON.parse(result.stdout).checks.flatMap((entry: { findings: unknown[] }) => entry.findings);
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

test('nested Bash safety settings merge root and scoped owners without leaking to siblings', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nconfigurations = ["bash"]\n[tools.bash.safety]\nowners = ["root.sh"]\n[[scope]]\npath = "app"\n[scope.tools.bash.safety]\nowners = ["app/cleanup.sh"]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
    const source = '#!/usr/bin/env bash\nrm -rf "$target"\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'root.sh': source,
        'app/cleanup.sh': source,
        'app/child/cleanup.sh': source,
        'sibling/cleanup.sh': source,
    });
    const command = ['check', '--only', 'structure/bash-safety', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(JSON.parse(broken.stdout).checks.flatMap((check: { findings: unknown[] }) => check.findings)).toStrictEqual([
        expect.objectContaining({ file: 'app/child/cleanup.sh', line: 2, rule: 'recursive-remove' }),
        expect.objectContaining({ file: 'sibling/cleanup.sh', line: 2, rule: 'recursive-remove' }),
    ]);
    for (const path of ['app/child/cleanup.sh', 'sibling/cleanup.sh'])
        await Bun.write(`${sandbox.path}/${path}`, '#!/usr/bin/env bash\nprintf "%s\\n" "$target"\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
    expect(await Bun.file(`${sandbox.path}/root.sh`).text()).toBe(source);
    expect(await Bun.file(`${sandbox.path}/app/cleanup.sh`).text()).toBe(source);
});

test.each([
    {
        configuration: 'supabase',
        check: 'supabase/admin-key-containment',
        setting: '[tools.supabase]\nadmin_key_files = ["trusted/**"]\n',
        path: 'trusted/key.ts',
        source: 'const key = "SUPABASE_SERVICE_ROLE_KEY";\n',
        correction: 'export {};\n',
        rule: 'admin-key',
    },
    {
        configuration: 'html',
        check: 'html/copy',
        setting:
            '[tools.html]\ntemplate_files = ["**/*.html"]\ncopy_allowed = [{paths = ["trusted/**"], reason = "Fixture copy is owned by the producer."}]\n',
        path: 'trusted/page.html',
        source: '<p>Private template copy</p>\n',
        correction: '<p>{{ title }}</p>\n',
        rule: 'literal-text',
    },
])(
    '$check applies canonical path settings without excluding unrelated files',
    async ({ configuration, check, setting, path, source, correction, rule }) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "all"\nconfigurations = ["${configuration}"]\n${setting}`;
        const untrusted = path.replace('trusted/', 'public/');
        await createFileTree(sandbox.path, { 'gspot.toml': policy, [path]: source, [untrusted]: source });
        const command = ['check', '--only', check, '--no-cache', '--json'];
        const failed = await run(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(
            JSON.parse(failed.stdout).checks.flatMap((entry: { findings: unknown[] }) => entry.findings),
        ).toMatchObject([{ file: untrusted, line: 1, rule }]);
        await Bun.write(`${sandbox.path}/${untrusted}`, correction);
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    },
);

test.each([
    'import { router } from "./private/router.js";',
    'import {\n router\n} from "./private/router.js";',
    'export { router } from "./private/router.js";',
    'const router = require("./private/router.js");',
    'const router = import("./private/router.js");',
    'import { router } from "#private/router";',
])('tRPC resolves the configured server boundary for %s and permits type-only imports', async (statement) => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nconfigurations = ["trpc"]\n[tools.trpc]\nserver_files = ["private/**"]\n';
    const source = `// A comment mentioning import from private is not an edge.\n${statement}\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'package.json': '{"imports":{"#private/*":"./private/*.ts"}}',
        'private/router.ts': 'export const router = {};\n',
        'client.ts': source,
        'server-public/unrelated.ts': 'export const publicValue = 1;\n',
        'public.ts': 'import {publicValue} from "./server-public/unrelated.js";\n',
    });
    const command = ['check', '--only', 'trpc/router-boundaries', '--no-cache', '--json'];
    const failed = await run(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = JSON.parse(failed.stdout).checks.flatMap((entry: { findings: unknown[] }) => entry.findings);
    expect(findings).toMatchObject([{ file: 'client.ts', line: 2, rule: 'server-import' }]);
    expect(findings).toHaveLength(1);
    await Bun.write(
        `${sandbox.path}/client.ts`,
        'import type { router } from "./private/router.js";\nimport { type router as Router } from "./private/router.js";\n',
    );
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
    expect(await Bun.file(`${sandbox.path}/public.ts`).text()).toBe(
        'import {publicValue} from "./server-public/unrelated.js";\n',
    );
});

test('tRPC architecture boundaries retain source locations, scope isolation, and failed observations', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nconfigurations = ["trpc"]\n[architecture]\nelements = [{name = "server", paths = ["private/**"]}]\n[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n';
    const source = '// Router boundary\nimport { router } from "./private/router.js";\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'private/router.ts': 'export const router = {};\n',
        'client.ts': 'import { value } from "./server/public.js";\n',
        'server/public.ts': 'export const value = 1;\n',
        'app/private/router.ts': 'export const router = {};\n',
        'app/client.ts': 'import type { router } from "./private/router.js";\n',
        'app/child/private/router.ts': 'export const router = {};\n',
        'app/child/client.ts': source,
    });
    const command = ['check', '--only', 'trpc/router-boundaries', '--no-cache', '--json'];
    const failed = await run(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        JSON.parse(failed.stdout).checks.map(
            (entry: { scope: string; findings: { file: string; line: number }[] }) => ({
                scope: entry.scope,
                findings: entry.findings.map(({ file, line }) => ({ file, line })),
            }),
        ),
    ).toStrictEqual([
        { scope: '', findings: [] },
        { scope: 'app', findings: [] },
        { scope: 'app/child', findings: [{ file: 'app/child/client.ts', line: 2 }] },
    ]);
    await Bun.write(`${sandbox.path}/app/child/client.ts`, 'import { broken from "./private/router.js";\n');
    const malformed = await run(sandbox.path, command);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect(malformed.stdout).toContain('Cannot parse imports in app/child/client.ts');
    await Bun.write(`${sandbox.path}/app/child/client.ts`, 'import type { router } from "./private/router.js";\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
    expect(await Bun.file(`${sandbox.path}/server/public.ts`).text()).toBe('export const value = 1;\n');
});
