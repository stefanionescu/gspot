import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/planted.ts';

const HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: same-origin\n    X-Frame-Options: DENY\n';

test('scoped readers receive their own files and preserve binary asset inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\npresets = ["static-site", "supabase", "i18n"]\n[tools.i18n]\ntranslations = { directory = "messages", base = "en" }\n[[scope]]\npath = "apps/backend"\n',
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
        ).toEqual([
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
        'gspot.toml': 'version = 1\npresets = ["swift", "xctest"]\n[[scope]]\npath = "apps/second"\n',
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
    ).toEqual([
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
