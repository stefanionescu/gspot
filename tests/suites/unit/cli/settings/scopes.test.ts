import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { test, expect, setSystemTime } from 'bun:test';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { setKey, getScopeTable } from '#cli/settings/edit.ts';
import { formatSchema } from '#cli/schemas/settings/fields.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { type Scope } from '#cli/types/settings/inheritance.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { stringify, parse as parseToml } from '@decimalturn/toml-patch';
import { selectScopeSettings, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getLimit, getTable, listIgnores, selectForScope, listIgnoredRules } from '#cli/settings/scopes.ts';

import {
    PROJECT_CHOICES,
    SCOPE_LIMIT_VALUES,
    PROJECT_SCOPE_CASES,
    IGNORE_EXPIRY_CASES,
    NESTED_SCOPE_SETTINGS,
    OPENAPI_SCOPE_SETTINGS,
    POSTGRES_SCOPE_SETTINGS,
    SITE_PACKAGE_MANAGER_CASES,
} from '#tests/config/settings/scopes.ts';

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
        ['', 'app'].map((scope) => ({ name, files, installer, scope })),
    ),
)('the site build command defaults to $installer in "$scope" ($name)', async ({ files, installer, scope }) => {
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
    const selected = session.scopes.find((each) => each.folder.path === scope)!;
    expect(getTable(selected.settings, 'site').build_command).toStrictEqual([installer, 'run', 'build']);
});

test('a scope keeps a written site build command including empty and spaced arguments', async () => {
    await using sandbox = await testdir();
    const table = parseToml(
        buildSandboxSettings([], { scopes: [{ path: 'app', configurations: ['site'] }] }),
    ) as TomlTable;
    setKey(getScopeTable(table, 'app'), 'site.build_command', ['custom-builder', '', 'two words']);
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify(table),
        'app/index.html': '<!doctype html><title>Site</title>',
    });
    const session = await openSession(sandbox.path);
    expect(
        getTable(session.scopes.find((scope) => scope.folder.path === 'app')!.settings, 'site').build_command,
    ).toStrictEqual(['custom-builder', '', 'two words']);
});

test('an ignore with a rule and paths turns the rule off in its scope and the scopes below only', async () => {
    const scopes = await readNestedScopes();
    const off = Object.fromEntries(
        scopes.map((scope) => [scope.folder.path, listIgnoredRules(scope, 'bash/shellcheck')]),
    );
    expect(off).toStrictEqual({ '': [], api: ['SC2086'], 'api/v1': ['SC2086'], web: [] });
});

test('the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it', async () => {
    const scopes = await readNestedScopes();
    const values = scopes.map(({ folder, settings }) => [
        folder.path,
        [
            getLimit(settings, 'file_lines', 'bash'),
            getTable(settings, 'swift').xcode_scheme,
            getTable(settings, 'tools.swiftlint').always_keep_imports,
        ],
    ]);
    expect(Object.fromEntries(values)).toStrictEqual(SCOPE_LIMIT_VALUES);
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
    const scope = session.scopes.find((scope) => scope.folder.path === 'api')!;
    expect(getLimit(scope.settings, 'file_lines', 'python')).toBe(100);
});

test('ignore expiry does not change the scope view or gspot.toml', () => {
    using sandbox = createTemporaryFolder();
    setSystemTime(new Date('2030-05-20T23:59:59.000Z'));
    try {
        const settings = parseSettings(
            buildSettingsText('', { configurations: [], ignore: IGNORE_EXPIRY_CASES }, formatSchema.parse({})),
            sandbox.path,
        );
        const rootSettings = selectScopeSettings(settings).scopeSettings;
        const configurations = selectForScope(settings, '', readConfigurations());
        const availableSettings = buildAvailableSettings(configurations, settings.level);
        const scope: Scope = {
            folder: { path: '', configurations: [], origin: 'root' },
            configurations,
            availableSettings,
            settings: rootSettings,
        };
        expect(listIgnores(rootSettings, 'dependencies/osv-scanner')).toStrictEqual([
            { ...IGNORE_EXPIRY_CASES[3], paths: [] },
            { ...IGNORE_EXPIRY_CASES[1], paths: [] },
            { ...IGNORE_EXPIRY_CASES[0], paths: [] },
            { ...IGNORE_EXPIRY_CASES[2], paths: [] },
        ]);
        expect(listIgnoredRules(scope, 'dependencies/osv-scanner')).toStrictEqual([
            'future',
            'past',
            'permanent',
            'today',
        ]);
        expect(settings.ignore).toStrictEqual([
            IGNORE_EXPIRY_CASES[3],
            IGNORE_EXPIRY_CASES[1],
            IGNORE_EXPIRY_CASES[0],
            IGNORE_EXPIRY_CASES[2],
        ]);
        setSystemTime(new Date('2030-05-21T00:00:00.000Z'));
        const next = selectScopeSettings(settings).scopeSettings;
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
        'gspot.toml': buildSandboxSettings(['openapi'], OPENAPI_SCOPE_SETTINGS),
        'api/swagger.yaml': 'openapi: 3.1.0\n',
    });

    const session = await openSession(sandbox.path);
    expect(getTable(session.scopes[0]!.settings, 'openapi').document).toBeUndefined();
    expect(session.scopes[1]!.configurations.map(({ name }) => name)).not.toContain('openapi');
    expect(
        planChecks(session, { stage: 'all', only: ['openapi/spectral'] }).map(({ skip }) => skip?.cause),
    ).toStrictEqual(['setting']);
});

test('Postgres client schemas come from Supabase or from gspot.toml', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], POSTGRES_SCOPE_SETTINGS),
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

test.each([...PROJECT_SCOPE_CASES])('scope $scope selects $name: $selected', ({ scope, name, selected }) => {
    const names = selectForScope(
        {
            configurations: [...PROJECT_CHOICES.configurations],
            removed_configurations: [...PROJECT_CHOICES.removed_configurations],
            scopes: Object.fromEntries(
                PROJECT_CHOICES.scope.map((choice) => [
                    choice.path,
                    {
                        configurations: [...choice.configurations],
                        removed_configurations: [...choice.removed_configurations],
                    },
                ]),
            ),
        },
        scope,
        readConfigurations(),
    ).map((configuration) => configuration.name);
    expect(names.includes(name)).toBe(selected);
});
test('a rule option named reason is passed on and is not a gspot reason', () => {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(
        'configurations = ["css"]\n[tools.stylelint.rules]\nselector-class-pattern = ["^[a-z]+$", { reason = false }]\n',
        sandbox.path,
    );
    const rules: unknown = getTable(selectScopeSettings(settings).scopeSettings, 'tools.stylelint').rules;
    expect(rules).toStrictEqual({ 'selector-class-pattern': ['^[a-z]+$', { reason: false }] });
});
