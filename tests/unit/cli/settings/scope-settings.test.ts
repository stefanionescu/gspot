import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { test, expect, setSystemTime } from 'bun:test';
import { buildKnownSettings } from '#cli/settings/known.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { setKey, getScopeTable } from '#cli/settings/edit.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { type Scope } from '#cli/types/settings/inheritance.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { stringify, parse as parseToml } from '@decimalturn/toml-patch';
import { buildSandboxSettings, buildRootScopeSettings } from '#tests/setup/settings.ts';
import { SITE_BUILD_COMMANDS, SITE_PACKAGE_MANAGER_CASES } from '#tests/data/checks/site/build.ts';
import { getLimit, getTable, listIgnores, selectForScope, listIgnoredRules } from '#cli/settings/scope-settings.ts';

import {
    PROJECT_CHOICES,
    PROJECT_SCOPE_CASES,
    IGNORE_EXPIRY_ENTRIES,
    NESTED_SCOPE_SETTINGS,
} from '#tests/data/settings/scopes.ts';

async function readNestedScopes(): Promise<Scope[]> {
    await using sandbox = await testdir({
        'gspot.toml': NESTED_SCOPE_SETTINGS,
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
        'api/v1/entry.sh': 'echo v1\n',
        'web/entry.sh': 'echo web\n',
    });

    const session = await openSession(sandbox.path);
    return session.scopes;
}

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
                ? buildSandboxSettings(['site'])
                : buildSandboxSettings([], { scopes: [{ path: 'app', configurations: ['site'] }] });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            [join(scope, 'index.html')]: '<!doctype html><title>Site</title>',
            ...Object.fromEntries(Object.entries(files).map(([path, text]) => [join(scope, path), text])),
        });
        const session = await openSession(sandbox.path);
        const selected = session.scopes.find((entry) => entry.folder.path === scope)!;
        expect(getTable(selected.settings, 'site').build_command).toStrictEqual([installer, 'run', 'build']);

        const table = parseToml(settings) as TomlTable;
        setKey(getScopeTable(table, scope || undefined), 'site.build_command', [...commandArguments]);
        const written = stringify(table);
        await writeFile(join(sandbox.path, 'gspot.toml'), written);
        const manual = await openSession(sandbox.path);
        expect(
            getTable(manual.scopes.find((entry) => entry.folder.path === scope)!.settings, 'site').build_command,
        ).toStrictEqual([...commandArguments]);
        const canonical = buildSettingsText(written, parseToml(written) as TomlTable);
        expect(buildSettingsText(canonical, parseToml(canonical) as TomlTable)).toBe(canonical);
        await writeFile(join(sandbox.path, 'gspot.toml'), canonical);
        const reopened = await openSession(sandbox.path);
        expect(
            getTable(reopened.scopes.find((entry) => entry.folder.path === scope)!.settings, 'site').build_command,
        ).toStrictEqual([...commandArguments]);
    },
);

test('an ignore with a rule and paths turns the rule off in its scope and the scopes below only', async () => {
    const scopes = await readNestedScopes();
    const off = Object.fromEntries(
        scopes.map((scope) => [scope.folder.path, listIgnoredRules(scope, 'bash/shellcheck')]),
    );
    expect(off).toStrictEqual({ '': [], api: ['SC2086'], 'api/v1': ['SC2086'], web: [] });
});

test('the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it', async () => {
    const scopes = await readNestedScopes();
    const byScope = new Map(scopes.map((scope) => [scope.folder.path, scope.settings]));
    const read = (path: string): unknown[] => {
        const settings = byScope.get(path)!;
        return [
            getLimit(settings, 'file_lines', 'bash'),
            getTable(settings, 'swift').xcode_scheme,
            getTable(settings, 'tools.swiftlint').always_keep_imports,
        ];
    };
    expect(read('')).toStrictEqual([100, '5.0', ['Foundation']]);
    expect(read('api')).toStrictEqual([80, '6.0', ['Foundation', 'UIKit']]);
    expect(read('api/v1')).toStrictEqual([60, '5.0', ['Foundation', 'UIKit', 'SwiftUI']]);
    expect(read('web')).toStrictEqual([100, '5.0', ['Foundation']]);
});

test('a per-scope limit overrides a root language limit in the scope view', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            rules: true,
            tables: '[limits.python]\nfile_lines = 300\n[[scope]]\npath = "api"\nlimits.file_lines = 100\n',
        }),
        'api/source.py': 'value = 1\n',
    });

    const session = await openSession(sandbox.path);
    const scope = session.scopes.find((entry) => entry.folder.path === 'api')!;
    expect(getLimit(scope.settings, 'file_lines', 'python')).toBe(100);
});

test('ignore expiry does not change the scope view or gspot.toml', () => {
    setSystemTime(new Date('2030-05-20T23:59:59.000Z'));
    try {
        const settings = parseSettings(
            buildSettingsText('', { configurations: [], ignore: IGNORE_EXPIRY_ENTRIES }),
            undefined,
        );
        const rootSettings = buildRootScopeSettings(settings);
        const configurations = selectForScope(settings, '', readConfigurations());
        const knownSettings = buildKnownSettings(configurations, settings.level);
        const scope: Scope = {
            folder: { path: '', configurations: [], origin: 'root' },
            configurations,
            knownSettings,
            settings: rootSettings,
        };
        expect(listIgnores(rootSettings, 'dependencies/osv-scanner')).toStrictEqual([
            { ...IGNORE_EXPIRY_ENTRIES[3], paths: [] },
            { ...IGNORE_EXPIRY_ENTRIES[1], paths: [] },
            { ...IGNORE_EXPIRY_ENTRIES[0], paths: [] },
            { ...IGNORE_EXPIRY_ENTRIES[2], paths: [] },
        ]);
        expect(listIgnoredRules(scope, 'dependencies/osv-scanner')).toStrictEqual([
            'future',
            'past',
            'permanent',
            'today',
        ]);
        expect(settings.ignore).toStrictEqual([
            IGNORE_EXPIRY_ENTRIES[3],
            IGNORE_EXPIRY_ENTRIES[1],
            IGNORE_EXPIRY_ENTRIES[0],
            IGNORE_EXPIRY_ENTRIES[2],
        ]);
        setSystemTime(new Date('2030-05-21T00:00:00.000Z'));
        const next = buildRootScopeSettings(settings);
        expect(listIgnoredRules({ ...scope, settings: next }, 'dependencies/osv-scanner')).toStrictEqual([
            'future',
            'past',
            'permanent',
            'today',
        ]);
        expect(listIgnoredRules(scope, 'dependencies/osv-scanner')).toStrictEqual([
            'future',
            'past',
            'permanent',
            'today',
        ]);
    } finally {
        setSystemTime();
    }
});

test('OpenAPI stays off without a document and in a scope that removes it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['openapi'], {
            level: 'recommended',
            rules: true,
            scopes: [{ path: 'api' }],
            tables: 'removed_configurations = { value = ["openapi"], reason = "This scope does not publish an OpenAPI document." }\n',
        }),
        'api/swagger.yaml': 'openapi: 3.1.0\n',
    });

    const session = await openSession(sandbox.path);
    expect(getTable(session.scopes[0]!.settings, 'openapi').document).toBeUndefined();
    expect(session.scopes[1]!.configurations.some((configuration) => configuration.name === 'openapi')).toBe(false);
    expect(
        planChecks(session, { stage: 'all', only: ['openapi/spectral'] }).map(({ skip }) => skip?.cause),
    ).toStrictEqual(['setting']);
});

test('Postgres client schemas come from Supabase or from gspot.toml', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            level: 'recommended',
            rules: true,
            scopes: [{ path: 'api', configurations: ['supabase'] }, { path: 'authored' }],
            tables: 'postgres.client_schemas = ["client"]\n',
        }),
        'migration.sql': 'CREATE TABLE public.entries (id int);\n',
        'api/migration.sql': 'CREATE TABLE public.entries (id int);\n',
        'authored/migration.sql': 'CREATE TABLE client.entries (id int);\n',
    });

    const session = await openSession(sandbox.path);
    expect(
        session.scopes.map(({ folder, settings }) => [folder.path, getTable(settings, 'postgres').client_schemas]),
    ).toStrictEqual([
        ['', []],
        ['api', ['public']],
        ['authored', ['client']],
    ]);
});

test.each(PROJECT_SCOPE_CASES)('scope %s selects configuration %s: %s', (scope, name, selected) => {
    const names = selectForScope(
        {
            configurations: [...PROJECT_CHOICES.configurations],
            removed_configurations: [...PROJECT_CHOICES.removed_configurations],
            scopes: Object.fromEntries(
                PROJECT_CHOICES.scope.map((entry) => [
                    entry.path,
                    {
                        configurations: [...entry.configurations],
                        removed_configurations: [...entry.removed_configurations],
                    },
                ]),
            ),
        },
        scope,
        readConfigurations(),
    ).map((configuration) => configuration.name);
    expect(names.includes(name)).toBe(selected);
    expect(names).toContain('gspot');
});
