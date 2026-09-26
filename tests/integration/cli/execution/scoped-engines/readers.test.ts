import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { Finding } from '#cli/types/checks/checks.ts';
import { containing } from '#tests/support/expectations.ts';
import { READERS_HEADERS } from '#tests/constants/integration/cli/execution/scoped-engines.ts';

test('scoped readers receive their own files and preserve binary asset inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["static-site", "supabase", "i18n"]\n[tools.i18n]\ntranslations = { directory = "messages", base = "en" }\n[[scope]]\npath = "apps/backend"\n',
        _headers: READERS_HEADERS,
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
    const expected: { check: string; root: Finding[]; nested: Finding[] }[] = [
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
    for (const entry of expected) {
        const result = await run(sandbox.path, ['check', '--only', entry.check, '--no-cache', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(
            reportSchema.parse(JSON.parse(result.stdout)).checks.map((check) => ({
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
    await Bun.write(`${sandbox.path}/index.html`, '<img src="/assets/unused.png">');
    for (const entry of expected) {
        const corrected = await run(sandbox.path, ['check', '--only', entry.check, '--no-cache', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    }
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
    expect(reportSchema.parse(JSON.parse(broken.stdout)).checks.flatMap((check) => check.findings)).toStrictEqual([
        containing({ file: 'app/child/cleanup.sh', line: 2, rule: 'recursive-remove' }),
        containing({ file: 'sibling/cleanup.sh', line: 2, rule: 'recursive-remove' }),
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
        expect(reportSchema.parse(JSON.parse(failed.stdout)).checks.flatMap((entry) => entry.findings)).toMatchObject([
            { file: untrusted, line: 1, rule },
        ]);
        await Bun.write(`${sandbox.path}/${untrusted}`, correction);
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    },
);
