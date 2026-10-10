import { join } from 'node:path';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { commandEnvironment } from '#cli/execution/command/public.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { READERS_HEADERS, EXPECTED_READERS } from '#tests/config/cli/execution/scopes.ts';

describe('scoped readers preserve their owned inputs', () => {
    let sandbox: Awaited<ReturnType<typeof testdir>>;
    beforeAll(async () => {
        sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['site', 'supabase', 'translations', 'cloudflare'], {
                level: 'all',
                tables: '[translations]\nmessages_folder = "messages"\nbase_locale = "en"\n[scope."apps/backend"]\n[scope."apps/backend".translations]\nmessages_folder = "messages"\n',
            }),
            'package.json': '{"private":true,"dependencies":{"next-intl":"4.8.3"}}',
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
    });
    afterAll(async () => {
        await sandbox[Symbol.asyncDispose]();
    });
    test.each(EXPECTED_READERS)('$check receives its own files and binary assets', async (entry) => {
        const result = await checkReport(sandbox.path, ['check', '--only', entry.check, '--json']);
        expect(result.code, `${entry.check}: ${result.stdout}${result.stderr}`).toBe(1);
        expect(
            result.report.checks.map((check) => ({
                scope: check.scope,
                findings: check.findings,
            })),
            entry.check,
        ).toStrictEqual([
            { scope: '', findings: entry.root.map((finding) => containing<Finding>(finding)) },
            { scope: 'apps/backend', findings: entry.nested.map((finding) => containing<Finding>(finding)) },
        ]);
    });
});

test('Bash safety ignores exempt declared paths without leaking to descendants or siblings', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['bash'], {
        tables: '[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["root.sh"]\nreason = "The root script owns process cleanup."\n[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["app/cleanup.sh"]\nreason = "The application script owns process cleanup."\n[scope."app"]\n[scope."app/child"]\n[scope."sibling"]\n',
    });
    const source = '#!/usr/bin/env bash\nrm -rf "$target"\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'root.sh': source,
        'app/cleanup.sh': source,
        'app/child/cleanup.sh': source,
        'sibling/cleanup.sh': source,
    });
    const command = ['check', '--only', 'bash/safety', '--json'];
    const broken = await checkReport(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks.flatMap((check) => check.findings)).toStrictEqual([
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
        check: 'supabase/service-role-key',
        setting: '[supabase]\nfunctions_folder = "trusted"\n',
        path: 'trusted/key.ts',
        source: 'const key = "SUPABASE_SERVICE_ROLE_KEY";\n',
        correction: 'export {};\n',
        rule: 'admin-key',
    },
    {
        configuration: 'html',
        check: 'html/template-text',
        setting: '[html]\ntemplates = ["public/**/*.html"]\n',
        path: 'trusted/page.html',
        source: '<p>Private template copy</p>\n',
        correction: '<p>{{ title }}</p>\n',
        rule: 'literal-text',
    },
])(
    '$check applies canonical path settings without excluding unrelated files',
    async ({ configuration, check, setting, path, source, correction, rule }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy([configuration], { tables: setting, level: 'all' });
        const untrusted = path.replace('trusted/', 'public/');
        await createFileTree(sandbox.path, { 'gspot.toml': policy, [path]: source, [untrusted]: source });
        const command = ['check', '--only', check, '--json'];
        const failed = await checkReport(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks.flatMap((entry) => entry.findings)).toMatchObject([
            { file: untrusted, line: 1, rule },
        ]);
        await Bun.write(`${sandbox.path}/${untrusted}`, correction);
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    },
);

test.each(['recommended', 'all'] as const)('native scoped command paths remain relative at %s', async (level) => {
    await using sandbox = await testdir();
    const scope = 'apps/café [web]';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift'], { level, tables: `[scope.${JSON.stringify(scope)}]\n` }),
        'Sources/Main.swift': 'let value = 1\n',
        [`${scope}/Sources/Main.swift`]: 'let value = 2\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['swift/swiftlint'], skips: [] });
    expect(planned.map((check) => check.scope.scope.path)).toStrictEqual(['', scope]);
    for (const check of planned) {
        const environment = commandEnvironment(session, check);
        expect(environment.cwd).toBe(join(sandbox.path, check.scope.scope.path));
        expect(environment.files).toStrictEqual(['Sources/Main.swift']);
        expect(environment.substitutions.files).toStrictEqual(['Sources/Main.swift']);
    }
});
