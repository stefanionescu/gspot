import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { rename, writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildFileIdentifier, buildFolderIdentifiers } from '#cli/checks/general/naming/paths.ts';

import {
    NUMBERED_FILES,
    FILE_NAME_CASES,
    MIGRATION_FILES,
    NEXTJS_FOLDER_NAMES,
    NUMBERED_FILE_FINDINGS,
    NUMBERED_PREFIX_OVERRIDE,
} from '#tests/config/checks/general/naming/paths.ts';

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

    expect(listFindingRows(result.report)).toStrictEqual([{ file: 'handler.ts', line: 1, rule: 'banned-word' }]);
});

test.each([...FILE_NAME_CASES])('$name', async ({ configurations, files, invalid, renamed }) => {
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

test.each(['', 'app'].flatMap((scope) => ['sql', 'postgres'].map((configuration) => ({ scope, configuration }))))(
    'migration timestamps pass with $configuration while other numeric folders are reported (scope "$scope")',
    async ({ scope, configuration }) => {
        const prefix = scope === '' ? '' : `${scope}/`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['naming', configuration], { level: 'all', scopes: [{ path: 'app' }] }),
            ...Object.fromEntries(Object.entries(MIGRATION_FILES).map(([path, text]) => [`${prefix}${path}`, text])),
        });

        const findings = await runSandboxCheck(sandbox.path, 'naming/paths', { scope });
        expect(findings.filter(({ rule }) => rule === 'digits').map(({ file }) => file)).toStrictEqual([
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
    ).toStrictEqual([...NUMBERED_FILE_FINDINGS]);
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

test('a mise task file named _default passes, and the same name elsewhere does not', async () => {
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
                scopes: scope === '' ? [] : [{ path: scope }],
            }),
            [`${prefix}supabase/config.toml`]: 'project_id = "example"\n',
            [`${prefix}supabase/functions/_shared/entry.ts`]: 'export const origin = "example.com";\n',
            [`${prefix}supabase/functions/shared/entry.ts`]: 'export const origin = "example.com";\n',
        });
        const findings = await runSandboxCheck(sandbox.path, 'naming/paths', { scope });
        expect(findings.map(({ file }) => file)).toStrictEqual([`${prefix}supabase/functions/shared/entry.ts`]);
    },
);
test('a bracketed file name is a path parameter, and other punctuation stays in the name', () => {
    const containers = readNamingDefaults().path_containers;
    expect(buildFileIdentifier('app/[...slug].ts', 'typescript', containers)).toMatchObject({
        name: 'slug',
        category: 'path_parameters',
    });
    for (const name of ['(group)', '@slot', '_private'])
        expect(buildFileIdentifier(`app/${name}.ts`, 'typescript', containers)).toMatchObject({
            name,
            category: 'files',
        });
    expect(buildFileIdentifier('app/[slug].ts', 'typescript', [])).toMatchObject({
        name: '[slug]',
        category: 'files',
    });
    expect(
        buildFolderIdentifiers('app/(group)/@slot/_private/[id]/page.ts', 'typescript', []).map(({ name }) => name),
    ).toStrictEqual(['app', '(group)', '@slot', '_private', '[id]']);
});
test('a file name loses one extension or the whole .d.ts suffix, and a SQL migration keeps its full name', () => {
    expect(buildFileIdentifier('src/a-b.test.ts', 'typescript', []).name).toBe('a-b.test');
    expect(buildFileIdentifier('types/modules.d.ts', 'typescript', []).name).toBe('modules');
    expect(buildFileIdentifier('db/20240101010101_add_users.sql', 'sql', []).name).toBe('20240101010101_add_users.sql');
});
test('Next.js route segments are unwrapped and dot folders are skipped', () => {
    const containers = readNamingDefaults().path_containers;
    const names = buildFolderIdentifiers(
        'app/(marketing)/[slug]/@modal/_lib/.hidden/page.tsx',
        'typescript',
        containers,
    );
    expect(names.map((each) => `${each.category}:${each.name}`)).toStrictEqual([...NEXTJS_FOLDER_NAMES]);
    expect(names[2]?.folder).toBe('app/(marketing)/[slug]');
    expect(buildFileIdentifier('app/[...rest]/page.tsx', 'typescript', containers)).toMatchObject({
        name: 'page',
        category: 'files',
    });
});
