import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { checkInput } from '#cli/checks/run/built-in.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type Finding } from '#cli/types/checks/run/check.ts';
import { planRun, listCoveredInputs } from '#cli/planning/checks.ts';
import { HEADERS_FILE, SOURCE_EDITS, SCOPE_FINDINGS } from '#tests/data/runs/built-in-checks.ts';

test.each([...SOURCE_EDITS])(
    '$language built-in checks read source edited between sessions',
    async ({ language, path, sample, corrected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([language, 'naming'], { level: 'all' }),
            [path]: sample,
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ only: ['naming/identifiers', 'structure/trivial-functions'] });
        const failed = await runChecks(session, options);
        expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
        expect(failed.report.checks.map((check) => check.status)).toStrictEqual(['failed', 'failed']);
        for (const check of failed.report.checks)
            expect(check.findings).toContainEqual(matchFields({ file: path, line: 1 }));
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(sample);
        await Bun.write(join(sandbox.path, path), corrected);
        const accepted = await runChecks(await openSession(session.root), options);
        expect(accepted.report.exitCode, JSON.stringify(accepted.report)).toBe(0);
        expect(accepted.report.checks).toMatchObject([
            { status: 'passed', findings: [] },
            { status: 'passed', findings: [] },
        ]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(corrected);
    },
);

test("a built-in check sees its scope's files, and a once-per-repository check also sees every file", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['jest', 'docs'], {
            tables: '[[scope]]\npath = "apps/web"\n[[scope]]\npath = "apps/web/nested"\n',
        }),
        'README.md': '# Repository\n',
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/fixture.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'apps/web/nested/private.txt': 'Nested scope input\n',
        'unrelated/private.txt': 'Sibling input\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, {
        stage: 'all',
        only: ['jest/coverage', 'docs/missing-paths'],
    });
    const project = planned.find(
        (entry) => entry.check.name === 'jest/coverage' && entry.scope.scope.path === 'apps/web',
    )!;
    const scopeInput = checkInput(session, project);
    const rootCheck = planned.find((entry) => entry.check.name === 'docs/missing-paths')!;
    const repositoryInput = checkInput(session, rootCheck);
    expect(repositoryInput.repositoryFiles).toStrictEqual(session.repository.files);
    for (const input of [scopeInput, repositoryInput]) expect(input.selections).toStrictEqual(session.scopes);
    expect(repositoryInput.repositoryFiles.map((file) => file.path)).toContain('unrelated/private.txt');
    expect(listCoveredInputs(session, project).map((file) => file.path)).toStrictEqual(['apps/web/value.test.js']);
    expect(
        scopeInput.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['apps/web/fixture.bin', 'apps/web/jest.config.json', 'apps/web/value.test.js']);
});

test.each([...SCOPE_FINDINGS])("each check in a scope reads only that scope's files: $check", async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['site', 'supabase', 'translations', 'cloudflare'], {
            level: 'all',
            tables: '[translations]\nmessages_folder = "messages"\nbase_locale = "en"\n[[scope]]\npath = "apps/backend"\n[scope.translations]\nmessages_folder = "apps/backend/messages"\n',
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
    const result = await checkReport(sandbox.path, ['check', '--only', entry.check, '--json']);
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
