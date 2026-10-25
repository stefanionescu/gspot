import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { SETTING_REASON } from '#tests/config/commands/set.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    REASON_VALUES,
    REASON_EXPLANATIONS,
    SCOPE_SETTING_EXPLANATION,
} from '#tests/config/commands/explain/settings.ts';

test.each([
    { key: 'naming.swift.max_characters', shipped: 40, child: 38 },
    { key: 'naming.sql.max_words', shipped: 7, child: 7 },
])("explain shows each scope's default and value naming limit: $key", async ({ key, shipped, child }) => {
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
});
test('a setting explanation lists settings set only in scopes and each inherited value', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: '[[scope]]\npath = "api"\nconfigurations = ["jest"]\n[scope.coverage]\nlines = 90\n[[scope]]\npath = "api/worker"\nconfigurations = []\n[scope.coverage]\nlines = 95\n',
        }),
        'api/example.test.js': 'test("example", () => {});\n',
        'api/worker/example.test.js': 'test("worker", () => {});\n',
    });

    const result = await runGspot(sandbox.path, ['explain', 'coverage.lines', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject(SCOPE_SETTING_EXPLANATION);
});

test('explain reads an inherited limits.function_lines value and its reason, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['structure'], {
        scopes: [{ path: 'app' }],
        tables: `[limits]\nfunction_lines = { value = 100, reason = ${JSON.stringify(SETTING_REASON)} }\n`,
    });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'app/source.ts': 'export const active = true;\n' });
    const explained = await runGspot(sandbox.path, ['explain', 'limits.function_lines', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(JSON.parse(explained.stdout)).toMatchObject({
        kind: 'setting',
        key: 'limits.function_lines',
        type: 'number',
        scopes: ['', 'app'].map((scope) => ({ scope, value: 100, source: 'gspot.toml', reason: SETTING_REASON })),
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
        const child = row.needsReason[1] ? `{ value = ${row.child}, reason = "${explanation}" }` : row.child;
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
        const expected = REASON_EXPLANATIONS[row.key];
        expect(result.stdout).toBe(expected.text);
        const reported = await runGspot(sandbox.path, ['explain', row.key, '--json']);
        expect(reported.code, reported.stdout + reported.stderr).toBe(0);
        expect(JSON.parse(reported.stdout)).toStrictEqual(expected.json);
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
    const human = await runGspot(sandbox.path, ['explain', key]);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stdout).toBe(
        'format.indent_style\n\nThe character of one indent level: space or tab.\n\nScope: root\nShipped default: "space"\nCurrent value: "space" (from configuration format)\nChange it: gspot set format.indent_style <value> [--reason "<why>"]\nBack to the default: gspot unset format.indent_style\n\nScope: app\nShipped default: "space"\nCurrent value: "tab" (from [scope "app"])\nChange it: gspot set format.indent_style <value> --scope app [--reason "<why>"]\nBack to the default: gspot unset format.indent_style --scope app\n',
    );
    const structured = await runGspot(sandbox.path, ['explain', key, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(JSON.parse(structured.stdout)).not.toHaveProperty('reason_when');
    expect(JSON.parse(structured.stdout)).toMatchObject({
        scopes: [
            { scope: '', value: 'space' },
            { scope: 'app', value: 'tab' },
        ],
    });
});

test('explain shows the default of a path setting joined with the scope, as gspot uses it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, scopes: [{ path: 'web', configurations: ['site'] }] }),
        'web/index.html': '<!doctype html><title>Example</title>\n',
    });
    const explained = await runGspot(sandbox.path, ['explain', 'site.build_folder', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    const { scopes } = JSON.parse(explained.stdout) as {
        scopes: { scope: string; default: unknown; value: unknown; source: string }[];
    };
    expect(scopes.filter((each) => each.scope === 'web')).toStrictEqual([
        { scope: 'web', default: 'web/dist', value: 'web/dist', source: 'configuration site' },
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
    expect(explained.stdout.split('\n').slice(4)).toStrictEqual([
        'Scope: root',
        'Shipped default: []',
        'Current value: [] (from configuration structure)',
        'Change it: write [[import_rule]] records by hand in gspot.toml, then run gspot apply.',
        '',
    ]);
});

test.each(['recommended', 'all'] as const)('set and explain report whether a limit runs at level %s', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level }),
        'script.sh': 'printf ready\n',
    });
    const changed = await runGspot(sandbox.path, [
        'set',
        'limits.bash.function_lines',
        '50',
        '--reason',
        'The script keeps one operation together.',
    ]);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const note = 'note     No selected check reads limits.bash.function_lines at level recommended.';
    if (level === 'recommended') expect(changed.stdout.split('\n')).toContain(note);
    else expect(changed.stdout).not.toContain('No selected check reads');
    const explained = await runGspot(sandbox.path, ['explain', 'limits.bash.function_lines']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(explained.stdout).toContain(
        level === 'recommended'
            ? 'Read by: bash/function-size (off at level recommended)'
            : 'Read by: bash/function-size',
    );
    if (level === 'all') expect(explained.stdout).not.toContain('off at level');
    const machine = await runGspot(sandbox.path, ['explain', 'limits.bash.function_lines', '--json']);
    expect(machine.code, machine.stdout + machine.stderr).toBe(0);
    expect(JSON.parse(machine.stdout)).toMatchObject({
        scopes: [
            {
                scope: '',
                readBy: [
                    level === 'recommended' ? 'bash/function-size (off at level recommended)' : 'bash/function-size',
                ],
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
    expect(explained.stdout.split('\n').slice(4)).toStrictEqual([
        'Scope: root',
        'Shipped default: "recommended"',
        'Current value: "all" (from gspot.toml)',
        'Change it: gspot set level <value> [--reason "<why>"]',
        'Back to the default: gspot unset level',
        '',
    ]);
});
