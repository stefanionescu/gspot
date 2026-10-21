import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { planChecks } from '#cli/planning/checks.ts';
import type { Session } from '#cli/types/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import type { Finding, CheckCode } from '#cli/types/runs/check.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { HEADERS_FILE, SCOPE_FINDINGS } from '#tests/data/runs/built-in-checks.ts';

test("a built-in check sees its scope's files, and a once-per-repository check also sees every file", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['jest', 'docs'], {
            scopes: [{ path: 'apps/web' }, { path: 'apps/web/nested' }],
        }),
        'README.md': '# Repository\n',
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/fixture.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'apps/web/nested/private.txt': 'Nested scope input\n',
        'unrelated/private.txt': 'Sibling input\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, {
        stage: 'all',
        only: ['jest/coverage', 'docs/missing-paths'],
    });
    const project = planned.find(
        (entry) => entry.check.name === 'jest/coverage' && entry.selection.scope.path === 'apps/web',
    )!;
    const rootCheck = planned.find((entry) => entry.check.name === 'docs/missing-paths')!;
    const inputs: { session: Session; planned: PlannedCheck }[] = [];
    const implementation: CheckCode = {
        check: (opened, check) => {
            inputs.push({ session: opened, planned: check });
            return [];
        },
    };
    await runCheckCode(session, project, implementation);
    await runCheckCode(session, rootCheck, implementation);
    const [scopeInput, repositoryInput] = inputs;
    expect(repositoryInput!.session.repository.files).toStrictEqual(session.repository.files);
    for (const input of inputs) expect(input.session.scopes).toStrictEqual(session.scopes);
    expect(repositoryInput!.session.repository.files.map((file) => file.path)).toContain('unrelated/private.txt');
    expect(listCheckedFiles(session.scopes, project).map((file) => file.path)).toStrictEqual([
        'apps/web/value.test.js',
    ]);
    expect(
        scopeInput!.planned.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['apps/web/fixture.bin', 'apps/web/jest.config.json', 'apps/web/value.test.js']);
});

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
