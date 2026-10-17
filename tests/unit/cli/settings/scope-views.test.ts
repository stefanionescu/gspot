import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { test, expect, setSystemTime } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { buildScopeView } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { setKey, findScopeTable } from '#cli/settings/edit.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { type ScopeSelection } from '#cli/types/settings/values.ts';
import { NESTED_SCOPE_SETTINGS } from '#tests/data/settings/scopes.ts';
import { stringify, LocalDate, parse as parseToml } from '@decimalturn/toml-patch';
import { SITE_BUILD_COMMANDS, SITE_PACKAGE_MANAGER_CASES } from '#tests/data/checks/site/build.ts';

test.each(
    SITE_PACKAGE_MANAGER_CASES.flatMap(([name, files, installer]) =>
        ['', 'app'].flatMap((scope) =>
            SITE_BUILD_COMMANDS.map((commandArguments) => ({ name, files, installer, scope, commandArguments })),
        ),
    ),
)(
    'the site build command defaults to your package manager in "$scope" and keeps your own',
    async ({ files, installer, scope, commandArguments }) => {
        await using sandbox = await testdir();
        const settings =
            scope === ''
                ? buildSettingsText(['site'])
                : buildSettingsText([], { tables: '[[scope]]\npath = "app"\nconfigurations = ["site"]\n' });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            [join(scope, 'index.html')]: '<!doctype html><title>Site</title>',
            ...Object.fromEntries(Object.entries(files).map(([path, text]) => [join(scope, path), text])),
        });
        const session = await openSession(sandbox.path);
        const selected = session.scopes.find((entry) => entry.scope.path === scope)!;
        expect(selected.view.options('site').build_command).toStrictEqual([installer, 'run', 'build']);

        const table = parseToml(settings) as TomlTable;
        setKey(findScopeTable(table, scope || undefined), 'site.build_command', [...commandArguments]);
        const written = stringify(table);
        await writeFile(join(sandbox.path, 'gspot.toml'), written);
        const manual = await openSession(sandbox.path);
        expect(
            manual.scopes.find((entry) => entry.scope.path === scope)!.view.options('site').build_command,
        ).toStrictEqual([...commandArguments]);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(written);
        const canonical = formatSettingsText(written, parseToml(written) as TomlTable);
        expect(formatSettingsText(canonical, parseToml(canonical) as TomlTable)).toBe(canonical);
        await writeFile(join(sandbox.path, 'gspot.toml'), canonical);
        const reopened = await openSession(sandbox.path);
        expect(
            reopened.scopes.find((entry) => entry.scope.path === scope)!.view.options('site').build_command,
        ).toStrictEqual([...commandArguments]);
        for (const [path, text] of Object.entries(files))
            expect(await readFile(join(sandbox.path, scope, path), 'utf8')).toBe(text);
    },
);

async function readScopeViews(): Promise<ScopeSelection[]> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_SCOPE_SETTINGS,
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
        'api/v1/entry.sh': 'echo v1\n',
        'web/entry.sh': 'echo web\n',
    });
    const session = await openSession(sandbox.path);
    return session.scopes;
}

test('an ignore with a rule and paths turns the rule off in its scope and the scopes below only', async () => {
    const selections = await readScopeViews();
    const byScope = new Map(selections.map((selection) => [selection.scope.path, selection.view]));
    const off = Object.fromEntries([...byScope].map(([path, view]) => [path, view.rulesOff('bash/shellcheck')]));
    expect(off).toStrictEqual({ '': [], api: ['SC2086'], 'api/v1': ['SC2086'], web: [] });
});

test('the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it', async () => {
    const selections = await readScopeViews();
    const byScope = new Map(selections.map((selection) => [selection.scope.path, selection.view]));
    const read = (path: string): unknown[] => {
        const view = byScope.get(path)!;
        return [
            view.limit('file_lines', 'bash'),
            view.options('swift').xcode_scheme,
            view.options('tools.swiftlint').always_keep_imports,
        ];
    };
    expect(read('')).toStrictEqual([100, '5.0', ['Foundation']]);
    expect(read('api')).toStrictEqual([80, '6.0', ['Foundation', 'UIKit']]);
    expect(read('api/v1')).toStrictEqual([60, '5.0', ['Foundation', 'UIKit', 'SwiftUI']]);
    expect(read('web')).toStrictEqual([100, '5.0', ['Foundation']]);
});

test('a per-scope limit overrides a root language limit in the scope view', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'configurations = ["python"]\n[limits.python]\nfile_lines = 300\n[[scope]]\npath = "api"\nlimits.file_lines = 100\n',
        'api/source.py': 'value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes.find((selection) => selection.scope.path === 'api')!;
    expect(scope.view.limit('file_lines', 'python')).toBe(100);
});

test('an until date ends at the start of that date in UTC, and the expired ignore stays in gspot.toml', () => {
    setSystemTime(new Date('2030-05-20T23:59:59.000Z'));
    try {
        const entries = [
            { check: 'dependencies/osv-scanner', rule: 'permanent', reason: 'Reviewed upstream.' },
            {
                check: 'dependencies/osv-scanner',
                rule: 'past',
                reason: 'Reviewed upstream.',
                until: new LocalDate('2030-05-19'),
            },
            {
                check: 'dependencies/osv-scanner',
                rule: 'today',
                reason: 'Reviewed upstream.',
                until: new LocalDate('2030-05-20'),
            },
            {
                check: 'dependencies/osv-scanner',
                rule: 'future',
                reason: 'Reviewed upstream.',
                until: new LocalDate('2030-05-21'),
            },
        ] as const;
        const settings = parseSettings(
            formatSettingsText('', { configurations: [], ignore: entries }),
            undefined,
            createReadCache(process.cwd()),
        );
        const selected = selectForScope(settings, '', readManifests(createReadCache(process.cwd())));
        const view = buildScopeView(
            buildKnownSettings(selected, 'recommended', createReadCache(process.cwd())),
            settings,
            selected,
            '',
        );
        expect(view.ignoresFor('dependencies/osv-scanner')).toStrictEqual([
            { ...entries[3], paths: [] },
            { ...entries[0], paths: [] },
        ]);
        expect(view.rulesOff('dependencies/osv-scanner')).toStrictEqual(['future', 'permanent']);
        expect(settings.ignore).toStrictEqual([entries[3], entries[1], entries[0], entries[2]]);
        setSystemTime(new Date('2030-05-21T00:00:00.000Z'));
        const next = buildScopeView(
            buildKnownSettings(selected, 'recommended', createReadCache(process.cwd())),
            settings,
            selected,
            '',
        );
        expect(next.rulesOff('dependencies/osv-scanner')).toStrictEqual(['permanent']);
        expect(view.rulesOff('dependencies/osv-scanner')).toStrictEqual(['future', 'permanent']);
    } finally {
        setSystemTime();
    }
});

test('OpenAPI stays off without a document and in a scope that removes it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "recommended"\nconfigurations = ["openapi"]\n[[scope]]\npath = "api"\nremoved_configurations = ["openapi"]\n`,
        'api/swagger.yaml': 'openapi: 3.1.0\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.scopes[0]!.view.options('openapi').document).toBeUndefined();
    expect(session.scopes[1]!.selected.some(({ configuration }) => configuration.name === 'openapi')).toBe(false);
    expect(planRun(session, { stage: 'all', only: ['openapi/spectral'] }).map(({ skip }) => skip?.cause)).toStrictEqual(
        ['setting'],
    );
});

test('Postgres client schemas come from Supabase or from gspot.toml', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "recommended"\nconfigurations = ["postgres"]\n[[scope]]\npath = "api"\nconfigurations = ["supabase"]\n[[scope]]\npath = "authored"\npostgres.client_schemas = ["client"]\n`,
        'migration.sql': 'CREATE TABLE public.entries (id int);\n',
        'api/migration.sql': 'CREATE TABLE public.entries (id int);\n',
        'authored/migration.sql': 'CREATE TABLE client.entries (id int);\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        session.scopes.map(({ scope, view }) => [scope.path, view.options('postgres').client_schemas]),
    ).toStrictEqual([
        ['', []],
        ['api', ['public']],
        ['authored', ['client']],
    ]);
});
