import { test, expect } from 'bun:test';
import type { Scope } from '#cli/types/settings.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getLimit, getTable, listIgnores, listIgnoredRules } from '#cli/settings/tables.ts';
import { NESTED_SCOPE_SETTINGS, POSTGRES_SCOPE_SETTINGS } from '#tests/config/settings/parse.ts';

async function readNestedScopes(): Promise<Scope[]> {
    await using sandbox = await createGitSandbox({
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
    const scopes = await readNestedScopes();
    const off = Object.fromEntries(scopes.map((scope) => [scope.path, listIgnoredRules(scope, 'bash/shellcheck')]));
    expect(off).toStrictEqual({ '': [], api: ['SC2086'], 'api/v1': ['SC2086'], web: [] });
});

test('a per-scope limit overrides a root language limit in the scope view', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            rules: true,
            tables: '[limits.python]\nmax_file_lines = 300\n[[scope]]\npath = "api"\nlimits.max_file_lines = 100\n',
        }),
        'api/source.py': 'value = 1\n',
    });

    const session = await openSession(sandbox.path);
    const scope = session.scopes.find((scope) => scope.path === 'api')!;
    expect(getLimit(scope.settings, 'max_file_lines', 'python')).toBe(100);
});

test('Postgres client schemas come from Supabase or from gspot.toml', async () => {
    await using sandbox = await createGitSandbox({
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

test('a rule option named reason is passed on and is not a gspot reason', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml':
            'configurations = ["css"]\n[tools.stylelint.rules]\nselector-class-pattern = ["^[a-z]+$", { reason = false }]\n',
    });
    const { scopes } = await openSession(sandbox.path);
    const rules: unknown = getTable(scopes[0]!.settings, 'tools.stylelint').rules;
    expect(rules).toStrictEqual({ 'selector-class-pattern': ['^[a-z]+$', { reason: false }] });
});

test('a language limit overrides the shared limit in the root and in a child scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'swift'], {
            tables: '[limits]\nmax_function_parameters = 2\n[limits.python]\nmax_function_parameters = { value = 8, reason = "The project API declares eight required parameters." }\n[[scope]]\npath = "api"\n',
        }),
        'source.py': 'value = 1\n',
        'api/source.py': 'value = 2\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        session.scopes.map(({ path, settings }) => ({
            path,
            python: getLimit(settings, 'max_function_parameters', 'python'),
            swift: getLimit(settings, 'max_function_parameters', 'swift'),
            shared: getLimit(settings, 'max_function_parameters'),
        })),
    ).toStrictEqual([
        { path: '', python: 8, swift: 2, shared: 2 },
        { path: 'api', python: 8, swift: 2, shared: 2 },
    ]);
});

test('an ignore without a check applies to every check', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': '[[ignore]]\npaths = ["generated/**"]\nreason = "The generator owns these files."\n',
    });
    const { scopes } = await openSession(sandbox.path);
    const selected = scopes[0]!.settings;
    const expected = [{ paths: ['generated/**'], reason: 'The generator owns these files.' }];
    expect(listIgnores(selected, 'python/ruff')).toStrictEqual(expected);
});

test('a table rule option keeps its value and reason fields', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml':
            'configurations = ["css"]\n[tools.stylelint.rules]\nselector-class-pattern = {value = "^[a-z]+$", reason = "The style rule receives both fields."}\n',
    });
    const { scopes } = await openSession(sandbox.path);
    const rules: unknown = getTable(scopes[0]!.settings, 'tools.stylelint').rules;
    expect(rules).toStrictEqual({
        'selector-class-pattern': { value: '^[a-z]+$', reason: 'The style rule receives both fields.' },
    });
});
