import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { settingOutputSchema } from '#cli/schemas/commands.ts';
import { NAMING_LIMITS, REASON_VALUES, SCOPE_SETTING_EXPLANATION } from '#tests/config/commands/reports.ts';
import { SETTING_REASON } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each(NAMING_LIMITS)(
    "explain shows each scope's default and value naming limit: $key",
    async ({ key, shipped, child }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['naming'], {
                level: 'all',
                scopes: [{ path: 'app' }],
                tables: '[scope.naming.swift]\nmax_characters = 38\n',
            }),
            'entry.sh': 'echo example\n',
            'app/entry.sh': 'echo example\n',
        });

        const explained = await runGspot(sandbox.path, ['explain', key, '--json']);
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout)).toMatchObject({
            kind: 'setting',
            scopes: [
                { scope: '', default: shipped, value: shipped },
                { scope: 'app', default: shipped, value: child },
            ],
        });
    },
);

test('a setting explanation lists settings set only in scopes and each inherited value', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: '[[scope]]\npath = "api"\nconfigurations = ["jest"]\n[scope.coverage]\nmin_line_percent = 90\n[[scope]]\npath = "api/worker"\nconfigurations = []\n[scope.coverage]\nmin_line_percent = 95\n',
        }),
        'api/example.test.js': 'test("example", () => {});\n',
        'api/worker/example.test.js': 'test("worker", () => {});\n',
    });

    const result = await runGspot(sandbox.path, ['explain', 'coverage.min_line_percent', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject(SCOPE_SETTING_EXPLANATION);
});

test('explain reads an inherited limits.max_function_lines value and its reason, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['structure'], {
        scopes: [{ path: 'app' }],
        tables: `[limits]\nmax_function_lines = { value = 100, reason = ${JSON.stringify(SETTING_REASON)} }\n`,
    });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'app/source.ts': 'export const active = true;\n' });
    const explained = await runGspot(sandbox.path, ['explain', 'limits.max_function_lines', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(settingOutputSchema.parse(JSON.parse(explained.stdout))).toMatchObject({
        kind: 'setting',
        setting: 'limits.max_function_lines',
        type: 'number',
        scopes: ['', 'app'].map((scope) => ({
            scope,
            value: 100,
            source: { kind: 'root', name: 'gspot.toml' },
            reason: SETTING_REASON,
        })),
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test.each([...REASON_VALUES])(
    'explain $key shows the value of each scope and asks for a reason only where the value loosens the default',
    async (row) => {
        await using sandbox = await createGitSandbox({});
        const explanation = 'The sandbox preserves the project convention for this native setting.';
        const separator = row.key.lastIndexOf('.');
        const table = row.key.slice(0, separator);
        const field = row.key.slice(separator + 1);
        const child = row.needsReason ? `{ value = ${row.child}, reason = "${explanation}" }` : row.child;
        const settings = buildSandboxSettings(['naming'], {
            scopes: [{ path: 'app', configurations: [] }],
            tables: `[${table}]\n${field} = ${row.root}\n[scope.${table}]\n${field} = ${child}\n`,
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'app/source.js': 'export const active = true;\n',
        });
        const result = await runGspot(sandbox.path, ['explain', row.key]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(
            result.stdout.split('\n').filter((line) => /^(?:If you set this value, |Reason on record: )/u.test(line)),
        ).toStrictEqual([
            ...(row.needsReason
                ? [
                      'If you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.',
                      `Reason on record: ${explanation}`,
                  ]
                : []),
        ]);
        const reported = await runGspot(sandbox.path, ['explain', row.key, '--json']);
        expect(reported.code, reported.stdout + reported.stderr).toBe(0);
        expect(
            settingOutputSchema
                .parse(JSON.parse(reported.stdout))
                .scopes.map(({ scope, value, source, reason }) => ({ scope, value, source, reason })),
        ).toStrictEqual([
            { scope: '', value: row.value[0], source: { kind: 'root', name: 'gspot.toml' }, reason: undefined },
            {
                scope: 'app',
                value: row.value[1],
                source: { kind: 'scope', name: 'app' },
                reason: row.needsReason ? explanation : undefined,
            },
        ]);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    },
);

test('a neutral format setting stays settable without a reason', async () => {
    const key = 'format.indent_style';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['data-files'], { level: 'all', rules: true, scopes: [{ path: 'app' }] }),
        'app/project.toml': 'name = "Project"\n',
    });

    const changed = await runGspot(sandbox.path, ['set', key, 'tab', '--scope', 'app']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const structured = await runGspot(sandbox.path, ['explain', key, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(JSON.parse(structured.stdout)).toMatchObject({
        scopes: [
            { scope: '', value: 'space' },
            { scope: 'app', value: 'tab' },
        ],
    });
});

test.each([
    { key: 'level', flag: '' },
    { key: 'limits.max_file_lines', flag: ' [--reason "<why>"]' },
])('explain offers --reason for $key only when the setting can need one', async ({ key, flag }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['explain', key]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain(`Change it: gspot set ${key} <value>${flag}\n`);
});

test('explain prints the required --reason of a setting whose words each take one', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['spelling']) });
    const result = await runGspot(sandbox.path, ['explain', 'spelling.allowed_words']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('Change it: gspot set spelling.allowed_words <value> --reason "<why>"\n');
});

test('explain shows the default of a path setting joined with the scope, as gspot uses it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, scopes: [{ path: 'web', configurations: ['site'] }] }),
        'web/index.html': '<!doctype html><title>Example</title>\n',
    });
    const explained = await runGspot(sandbox.path, ['explain', 'site.build_folder', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    const { scopes } = settingOutputSchema.parse(JSON.parse(explained.stdout));
    expect(scopes.filter((each) => each.scope === 'web')).toStrictEqual([
        { scope: 'web', default: 'web/dist', value: 'web/dist', source: { kind: 'configuration', name: 'site' } },
    ]);
});

test('explain tells you to write a record list by hand, not with gspot set', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { rules: true, scopes: [{ path: 'app' }] }),
        'index.js': 'export const example = 1;\n',
        'app/index.js': 'export const example = 1;\n',
    });
    const explained = await runGspot(sandbox.path, ['explain', 'import_rule']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(explained.stdout).toContain(
        'Change it: write [[import_rule]] records by hand in gspot.toml, then run gspot install.',
    );
});

test.each(['basic', 'all'] as const)('set and explain report whether a limit runs at level %s', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level }),
        'script.sh': 'printf ready\n',
    });
    const changed = await runGspot(sandbox.path, [
        'set',
        'limits.bash.max_function_lines',
        '50',
        '--reason',
        'The script keeps one operation together.',
    ]);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const note = 'note     No selected check reads limits.bash.max_function_lines at level basic.';
    if (level === 'basic') expect(changed.stdout.split('\n')).toContain(note);
    else expect(changed.stdout).not.toContain('No selected check reads');
    const machine = await runGspot(sandbox.path, ['explain', 'limits.bash.max_function_lines', '--json']);
    expect(machine.code, machine.stdout + machine.stderr).toBe(0);
    expect(JSON.parse(machine.stdout)).toMatchObject({
        scopes: [
            {
                scope: '',
                readBy: [level === 'basic' ? 'bash/function-size (off at level basic)' : 'bash/function-size'],
            },
        ],
    });
});

test('explain shows a setting that no scope accepts, such as level, only at the root and with no --scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { level: 'all', rules: true, scopes: [{ path: 'docs' }] }),
        'docs/guide.md': '# Guide\n',
    });
    const explained = await runGspot(sandbox.path, ['explain', 'level']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(explained.stdout).not.toContain('Scope: docs');
    expect(explained.stdout).not.toContain('--scope');
});

test('explain reads a shipped default before init and prints plain command examples', async () => {
    await using sandbox = await createGitSandbox({});
    const result = await runGspot(sandbox.path, ['explain', 'limits.max_file_lines', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ kind: 'setting', setting: 'limits.max_file_lines' });
    const rules = await runGspot(sandbox.path, ['explain', 'tools.eslint.rules']);
    expect(rules.code, rules.stdout + rules.stderr).toBe(0);
    expect(rules.stdout).toContain('gspot ignore javascript/eslint --rule <rule> --reason "<why>"');
    expect(rules.stdout).not.toContain('`');
});
