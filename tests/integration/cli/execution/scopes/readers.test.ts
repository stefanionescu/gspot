import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { Finding, RunReport } from '#cli/types/execution/execution.ts';

const READERS_HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: same-origin\n    X-Frame-Options: DENY\n';

const EXPECTED_READERS: { check: string; root: Finding[]; nested: Finding[] }[] = [
    {
        check: 'supabase/config',
        root: [],
        nested: [containing({ file: 'apps/backend/supabase/config.toml', rule: 'function' })],
    },
    {
        check: 'supabase/admin-key-containment',
        root: [],
        nested: [containing({ file: 'apps/backend/client.ts', rule: 'admin-key' })],
    },
    {
        check: 'i18n/locales',
        root: [],
        nested: [containing({ file: 'apps/backend/messages/de.json' })],
    },
    {
        check: 'integrity/security-headers',
        root: [],
        nested: [
            containing({ file: 'apps/backend/_headers', rule: 'missing-header' }),
            containing({ file: 'apps/backend/_headers', rule: 'missing-header' }),
        ],
    },
    {
        check: 'static-site/dead-assets',
        root: [containing({ file: 'assets/unused.png', rule: 'dead-asset' })],
        nested: [],
    },
];

test('scoped readers receive their own files and preserve binary asset inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['static-site', 'supabase', 'i18n'],
            '[tools.i18n]\nlocales = { directory = "messages", base = "en" }\n[[scope]]\npath = "apps/backend"\n',
        ),
        _headers: READERS_HEADERS,
        'messages/en.json': '{"title":"Home"}',
        'messages/de.json': '{"title":"Start"}',
        'supabase/config.toml': '[functions.root]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'assets/unused.png': new Uint8Array([0, 1, 2, 3]),
        'apps/backend/index.html': '<img alt="Fixture diagram" src="/assets/unused.png">',
        'apps/backend/_headers': '/*\n    X-Content-Type-Options: nosniff\n',
        'apps/backend/messages/en.json': '{"heading":"Backend"}',
        'apps/backend/messages/de.json': '{}',
        'apps/backend/supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'apps/backend/client.ts': 'const credentialName = "SUPABASE_SERVICE_ROLE_KEY";\n',
    });
    for (const entry of EXPECTED_READERS) {
        const result = await runGspot(sandbox.path, ['check', '--only', entry.check, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(
            (JSON.parse(result.stdout) as RunReport).checks.map((check) => ({
                scope: check.scope,
                findings: check.findings,
            })),
            entry.check,
        ).toStrictEqual([
            { scope: '', findings: entry.root },
            { scope: 'apps/backend', findings: entry.nested },
        ]);
    }
    await Bun.write(`${sandbox.path}/apps/backend/_headers`, READERS_HEADERS);
    await Bun.write(`${sandbox.path}/apps/backend/messages/de.json`, '{"heading":"Backend"}');
    await Bun.write(
        `${sandbox.path}/apps/backend/supabase/functions/missing/index.ts`,
        'const key = "SUPABASE_SERVICE_ROLE_KEY";\n',
    );
    await Bun.write(`${sandbox.path}/apps/backend/client.ts`, 'export {};\n');
    await Bun.write(`${sandbox.path}/index.html`, '<img alt="Fixture diagram" src="/assets/unused.png">');
    for (const entry of EXPECTED_READERS) {
        const corrected = await runGspot(sandbox.path, ['check', '--only', entry.check, '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    }
});

test('nested Bash safety settings merge root and scoped owners without leaking to siblings', async () => {
    await using sandbox = await testdir();
    const policy = policyOf(
        ['bash'],
        '[tools.bash]\nsafety_owners = ["root.sh"]\n[[scope]]\npath = "app"\n[scope.tools.bash]\nsafety_owners = ["app/cleanup.sh"]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
    );
    const source = '#!/usr/bin/env bash\nrm -rf "$target"\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'root.sh': source,
        'app/cleanup.sh': source,
        'app/child/cleanup.sh': source,
        'sibling/cleanup.sh': source,
    });
    const command = ['check', '--only', 'structure/bash-safety', '--json'];
    const broken = await runGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([
        containing({ file: 'app/child/cleanup.sh', line: 2, rule: 'recursive-remove' }),
        containing({ file: 'sibling/cleanup.sh', line: 2, rule: 'recursive-remove' }),
    ]);
    for (const path of ['app/child/cleanup.sh', 'sibling/cleanup.sh'])
        await Bun.write(`${sandbox.path}/${path}`, '#!/usr/bin/env bash\nprintf "%s\\n" "$target"\n');
    const corrected = await runGspot(sandbox.path, command);
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
        check: 'html/text',
        setting:
            '[tools.html]\ntemplates = ["**/*.html"]\nliterals_allowed = [{paths = ["trusted/**"], reason = "Fixture copy is owned by the producer."}]\n',
        path: 'trusted/page.html',
        source: '<p>Private template copy</p>\n',
        correction: '<p>{{ title }}</p>\n',
        rule: 'literal-text',
    },
])(
    '$check applies canonical path settings without excluding unrelated files',
    async ({ configuration, check, setting, path, source, correction, rule }) => {
        await using sandbox = await testdir();
        const policy = policyOf([configuration], setting, 'all');
        const untrusted = path.replace('trusted/', 'public/');
        await createFileTree(sandbox.path, { 'gspot.toml': policy, [path]: source, [untrusted]: source });
        const command = ['check', '--only', check, '--json'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((entry) => entry.findings)).toMatchObject([
            { file: untrusted, line: 1, rule },
        ]);
        await Bun.write(`${sandbox.path}/${untrusted}`, correction);
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    },
);
