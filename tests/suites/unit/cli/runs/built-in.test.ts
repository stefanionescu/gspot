import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { HEADERS_FILE, SCOPE_FINDINGS } from '#tests/config/runs/built-in.ts';

test.each([...SCOPE_FINDINGS])("each check in a scope reads only that scope's files: $check", async (entry) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['site', 'supabase', 'translations', 'cloudflare'], {
            level: 'all',
            scopes: [{ path: 'apps/backend' }],
            tables: '[translations]\nmessages_folder = "messages"\nbase_locale = "en"\n[scope.translations]\nmessages_folder = "apps/backend/messages"\n',
        }),
        'package.json': '{"private":true,"dependencies":{"next-intl":"4.8.3"}}',
        _headers: HEADERS_FILE,
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

    const result = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', entry.check, '--json']));
    expect(result.code, `${entry.check}: ${result.stdout}${result.stderr}`).toBe(1);
    expect(
        result.report.checks.map((check) => ({
            scope: check.scope,
            findings: check.findings,
        })),
        entry.check,
    ).toStrictEqual([
        { scope: '', findings: entry.root.map((finding) => matchFields<Finding>(finding)) },
        { scope: 'apps/backend', findings: entry.nested.map((finding) => matchFields<Finding>(finding)) },
    ]);
});
