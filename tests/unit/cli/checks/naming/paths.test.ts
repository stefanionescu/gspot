import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { rename, writeFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { NUMBERED_PREFIX_OVERRIDE } from '#tests/data/checks/naming/settings.ts';
import { NUMBERED_FILES, FILE_NAME_CASES, MIGRATION_FILES } from '#tests/data/checks/naming/sources.ts';

test('[slug] path brackets are allowed in every scope and banned file names are reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'naming'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['nextjs'] }],
        }),
        'handler.ts': 'export const port = 1;\n',
        '(group)/[id]/@slot/_private/page.ts': 'export function handleSubmit() {}\n',
        'app/(group)/[id]/@slot/_private/page.ts': 'export function handleSubmit() {}\n',
        'app/[...slug].ts': 'export function handleClick() {}\n',
    });

    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    const findings = result.report.checks.flatMap(({ findings }) => findings);
    expect(findings.map(({ file }) => file)).toStrictEqual(['handler.ts']);
    expect(findings.filter(({ file }) => file.startsWith('app/'))).toStrictEqual([]);
});

test.each([...FILE_NAME_CASES])('naming/paths: $name', async ({ configurations, files, invalid, renamed }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([...configurations], { level: 'all' }),
        ...files,
    });

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: invalid, line: 1, column: 1, rule: 'case' },
    ]);
    await rename(join(sandbox.path, invalid), join(sandbox.path, renamed));
    const corrected = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test.each(['', 'app'])(
    'migration timestamps are allowed without postgres while other numeric folders are reported (scope "%s")',
    async (scope) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        for (const [path, text] of Object.entries(MIGRATION_FILES))
            await createFileTree(sandbox.path, { [`${prefix}${path}`]: text });
        const settings = buildSandboxSettings(['naming', 'sql'], { level: 'all', scopes: [{ path: 'app' }] });
        await writeFile(join(sandbox.path, 'gspot.toml'), settings);

        const refused = await checkFindings(sandbox.path, 'naming/paths', { scope });
        expect(refused.filter(({ rule }) => rule === 'digits').map(({ file }) => file)).toStrictEqual([
            `${prefix}other/20240101000000_create_teams/query.sql`,
        ]);
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['naming', 'postgres'], { level: 'all', scopes: [{ path: 'app' }] }),
        );

        const allowed = await checkFindings(sandbox.path, 'naming/paths', { scope });
        expect(allowed.filter(({ rule }) => rule === 'digits').map(({ file }) => file)).toStrictEqual([
            `${prefix}other/20240101000000_create_teams/query.sql`,
        ]);
    },
);

test('a numbered file name needs an ignored_prefix override', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['bash', 'naming'], { level: 'all' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, ...NUMBERED_FILES });

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([
        { file: '.mise/tasks/01-build.sh', rule: 'case' },
        { file: '.mise/tasks/01-build.sh', rule: 'digits' },
        { file: 'scripts/steps/01-build.sh', rule: 'case' },
        { file: 'scripts/steps/01-build.sh', rule: 'digits' },
    ]);
    await writeFile(join(sandbox.path, 'gspot.toml'), settings + NUMBERED_PREFIX_OVERRIDE);
    const corrected = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('a banned folder word such as shared is reported in folder names', async () => {
    await using sandbox = await testdir();
    const paths = ['shared/first.js', 'app/shared/first.js', 'app/worker/shared/entry.js'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], {
            level: 'all',
            scopes: [{ path: 'app' }, { path: 'app/worker' }],
        }),
        ...Object.fromEntries(paths.map((path) => [path, 'export const active = true;\n'])),
    });
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(
        result.report.checks
            .flatMap(({ findings }) => findings.map(({ file }) => file))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(paths.toSorted((left, right) => left.localeCompare(right)));
});

test('paths: a mise task file named _default passes, and the same name elsewhere does not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash', 'naming'], { level: 'all' }),
        '.mise/tasks/build/_default': '#!/usr/bin/env bash\necho build\n',
        'scripts/_default': '#!/usr/bin/env bash\necho other\n',
    });
    const { report } = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual([
        'scripts/_default',
    ]);
});

test.each(['', 'apps/api'])(
    'Supabase _shared folders pass naming/paths while other shared folders fail in scope %s',
    async (scope) => {
        const prefix = scope === '' ? '' : `${scope}/`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['supabase', 'typescript', 'naming'], {
                level: 'all',
                tables: scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`,
            }),
            [`${prefix}supabase/config.toml`]: 'project_id = "example"\n',
            [`${prefix}supabase/functions/_shared/entry.ts`]: 'export const origin = "example.com";\n',
            [`${prefix}supabase/functions/shared/entry.ts`]: 'export const origin = "example.com";\n',
        });
        const findings = await checkFindings(sandbox.path, 'naming/paths', { scope });
        expect(findings.map(({ file }) => file)).toStrictEqual([`${prefix}supabase/functions/shared/entry.ts`]);
    },
);
