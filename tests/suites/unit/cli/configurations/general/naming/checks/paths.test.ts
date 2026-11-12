import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import {
    FILE_NAME_CASES,
    NUMBERED_FILE_FINDINGS,
    NUMBERED_PREFIX_OVERRIDE,
} from '#tests/config/configurations/naming/validation.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('[slug] path brackets are allowed in every scope and banned file names are reported', async () => {
    await using sandbox = await createGitSandbox({
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
    await using sandbox = await createGitSandbox({
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

test.each([
    { scope: '', configuration: 'sql' },
    { scope: 'app', configuration: 'postgres' },
])(
    'migration timestamps pass with $configuration while other numeric folders are reported (scope "$scope")',
    async ({ scope, configuration }) => {
        const prefix = scope === '' ? '' : `${scope}/`;
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['naming', configuration], { level: 'all', scopes: [{ path: 'app' }] }),
            ...Object.fromEntries(
                Object.entries({
                    'migrations/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
                    'other/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
                } as const).map(([path, text]) => [`${prefix}${path}`, text]),
            ),
        });

        const findings = await runSandboxCheck(sandbox.path, 'naming/paths', { scope });
        expect(findings.filter(({ rule }) => rule === 'digits').map(({ file }) => file)).toStrictEqual([
            `${prefix}other/20240101000000_create_teams/query.sql`,
        ]);
    },
);

test('a numbered file name needs an ignored_prefix override', async () => {
    const settings = buildSandboxSettings(['bash', 'naming'], { level: 'all' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        '.mise/tasks/01-build.sh': 'echo example\n',
    });

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([...NUMBERED_FILE_FINDINGS]);
    await writeFile(join(sandbox.path, 'gspot.toml'), settings + NUMBERED_PREFIX_OVERRIDE);
    const corrected = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('a banned folder word such as shared is reported in folder names', async () => {
    const paths = ['shared/first.js', 'app/shared/first.js', 'app/worker/shared/entry.js'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], {
            level: 'all',
            scopes: [{ path: 'app' }, { path: 'app/worker' }],
        }),
        ...Object.fromEntries(paths.map((path) => [path, 'export const active = true;\n'])),
    });
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/paths'] }));

    expect(
        result.report.checks.flatMap(({ findings }) => findings.map(({ file }) => file)).toSorted(compareText),
    ).toStrictEqual(paths.toSorted(compareText));
});

test('a mise task file named _default passes, and the same name elsewhere does not', async () => {
    await using sandbox = await createGitSandbox({
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
        await using sandbox = await createGitSandbox({
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

test('double underscore tool folders keep their inner names and a shared folder stays banned', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'python', 'naming'], { level: 'all' }),
        'src/__tests__/total.test.js': 'export const total = 1;\n',
        'src/__mocks__/fs.js': 'export const read = 1;\n',
        'pkg/__pycache__/cache_file.py': 'cached = 1\n',
        'app/_components/button.js': 'export const button = 1;\n',
        'app/_shared/port.js': 'export const port = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'naming/paths');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'app/_shared/port.js', rule: 'banned-word' },
    ]);
});

test('mixed-language folders accept the union of language naming cases once', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'python', 'naming'], { level: 'all' }),
        'account-pages/entry.ts': 'export const port = 1;',
        'account-pages/entry.py': 'port = 1\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'naming/paths');
    expect(findings.filter(({ message }) => message.includes('account-pages'))).toStrictEqual([]);
});

test('main.swift passes the PascalCase file names of Swift', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
        'Sources/App/main.swift': '',
    });
    expect(await runSandboxCheck(sandbox.path, 'naming/paths')).toStrictEqual([]);
});

test('a migration named with a sequence number passes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['naming', 'sql']),
        'migrations/0001_create_users.sql': 'SELECT 1;\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'naming/paths')).toStrictEqual([]);
});
