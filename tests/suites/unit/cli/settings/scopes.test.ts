import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { TWO_WORDS } from '#tests/config/ignores.ts';
import { openSession } from '#cli/planning/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { setKey, getScopeTable } from '#cli/settings/edit.ts';
import { type Scope } from '#cli/types/settings/inheritance.ts';
import type { TomlTable } from '#cli/types/settings/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { stringify, parse as parseToml } from '@decimalturn/toml-patch';

import {
    getLimit,
    getTable,
    listIgnores,
    selectForScope,
    findParentScope,
    listIgnoredRules,
} from '#cli/settings/scopes.ts';
import {
    PROJECT_CHOICES,
    SCOPE_LIMIT_VALUES,
    PROJECT_SCOPE_CASES,
    NESTED_SCOPE_SETTINGS,
    OPENAPI_SCOPE_SETTINGS,
    POSTGRES_SCOPE_SETTINGS,
    SITE_PACKAGE_MANAGER_CASES,
} from '#tests/config/settings/settings.ts';

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
    const selected = session.scopes.find((each) => each.path === scope)!;
    expect(getTable(selected.settings, 'site').build_command).toStrictEqual([installer, 'run', 'build']);
});

test('a scope keeps a written site build command including empty and spaced arguments', async () => {
    await using sandbox = await testdir();
    const table = parseToml(
        buildSandboxSettings([], { scopes: [{ path: 'app', configurations: ['site'] }] }),
    ) as TomlTable;
    setKey(getScopeTable(table, 'app'), 'site.build_command', ['custom-builder', '', TWO_WORDS]);
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify(table),
        'app/index.html': '<!doctype html><title>Site</title>',
    });
    const session = await openSession(sandbox.path);
    expect(
        getTable(session.scopes.find((scope) => scope.path === 'app')!.settings, 'site').build_command,
    ).toStrictEqual(['custom-builder', '', TWO_WORDS]);
});

test('an ignore with a rule and paths turns the rule off in its scope and the scopes below only', async () => {
    const scopes = await readNestedScopes();
    const off = Object.fromEntries(scopes.map((scope) => [scope.path, listIgnoredRules(scope, 'bash/shellcheck')]));
    expect(off).toStrictEqual({ '': [], api: ['SC2086'], 'api/v1': ['SC2086'], web: [] });
});

test('the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it', async () => {
    const scopes = await readNestedScopes();
    const values = scopes.map(({ path, settings }) => [
        path,
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
    const scope = session.scopes.find((scope) => scope.path === 'api')!;
    expect(getLimit(scope.settings, 'file_lines', 'python')).toBe(100);
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
        session.scopes.map(({ path, settings }) => [path, getTable(settings, 'postgres').client_schemas]),
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
            scopes: new Map(
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

test('a rule option named reason is passed on and is not a gspot reason', async () => {
    await using sandbox = await testdir({
        'gspot.toml':
            'configurations = ["css"]\n[tools.stylelint.rules]\nselector-class-pattern = ["^[a-z]+$", { reason = false }]\n',
    });
    const { scopes } = await openSession(sandbox.path);
    const rules: unknown = getTable(scopes[0]!.settings, 'tools.stylelint').rules;
    expect(rules).toStrictEqual({ 'selector-class-pattern': ['^[a-z]+$', { reason: false }] });
});

test('a language limit overrides the shared limit in the root and in a child scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'swift'], {
            tables: '[limits]\nfunction_parameters = 2\n[limits.python]\nfunction_parameters = { value = 8, reason = "The project API declares eight required parameters." }\n[[scope]]\npath = "api"\n',
        }),
        'source.py': 'value = 1\n',
        'api/source.py': 'value = 2\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        session.scopes.map(({ path, settings }) => ({
            path,
            python: getLimit(settings, 'function_parameters', 'python'),
            swift: getLimit(settings, 'function_parameters', 'swift'),
            shared: getLimit(settings, 'function_parameters'),
        })),
    ).toStrictEqual([
        { path: '', python: 8, swift: 2, shared: 2 },
        { path: 'api', python: 8, swift: 2, shared: 2 },
    ]);
});

test('the nearest parent scope contains a nested path', async () => {
    const scopes = await readNestedScopes();
    expect(findParentScope(scopes, 'api/v1/src')?.path).toBe('api/v1');
});

test('an ignore without a check applies to every check', async () => {
    await using sandbox = await testdir({
        'gspot.toml': '[[ignore]]\npaths = ["generated/**"]\nreason = "The generator owns these files."\n',
    });
    const { scopes } = await openSession(sandbox.path);
    const selected = scopes[0]!.settings;
    const expected = [{ paths: ['generated/**'], reason: 'The generator owns these files.' }];
    expect(listIgnores(selected, 'python/ruff')).toStrictEqual(expected);
    expect(listIgnores(selected, 'typescript/tsc')).toStrictEqual(expected);
});

test('a table rule option keeps its value and reason fields', async () => {
    await using sandbox = await testdir({
        'gspot.toml':
            'configurations = ["css"]\n[tools.stylelint.rules]\nselector-class-pattern = {value = "^[a-z]+$", reason = "The style rule receives both fields."}\n',
    });
    const { scopes } = await openSession(sandbox.path);
    const rules: unknown = getTable(scopes[0]!.settings, 'tools.stylelint').rules;
    expect(rules).toStrictEqual({
        'selector-class-pattern': { value: '^[a-z]+$', reason: 'The style rule receives both fields.' },
    });
});
