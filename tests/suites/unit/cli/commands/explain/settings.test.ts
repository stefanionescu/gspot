import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { SETTING_REASON } from '#tests/config/commands/set.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    REASON_VALUES,
    NAMING_SCOPE_LIMITS,
    SCOPE_SETTING_EXPLANATION,
} from '#tests/config/commands/explain/settings.ts';

test.each([...NAMING_SCOPE_LIMITS])(
    "explain shows each scope's default and current naming limit: $key",
    async ({ key, shipped, child }) => {
        await using sandbox = await testdir({
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
                { scope: '', default: shipped, current: shipped },
                { scope: 'app', default: shipped, current: child },
            ],
        });
    },
);
test('a setting explanation lists settings set only in scopes and each inherited value', async () => {
    await using sandbox = await testdir({
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
    await using sandbox = await testdir();
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
        scopes: ['', 'app'].map((scope) => ({ scope, current: 100, source: 'gspot.toml', reason: SETTING_REASON })),
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
test.each([...REASON_VALUES])(
    'explain $key shows the value of each scope and asks for a reason only where the value loosens the default',
    async (row) => {
        await using sandbox = await testdir();
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
        const sections = result.stdout.split('Scope: ').slice(1);
        expect(sections).toHaveLength(2);
        for (const [scope, section, needsReason, target] of [
            ['root', sections[0]!, row.needsReason[0], ''],
            ['app', sections[1]!, row.needsReason[1], ' --scope app'],
        ] as const) {
            expect(section).toStartWith(`${scope}\n`);
            expect(section.includes('If you set this value, give a reason:')).toBe(needsReason);
            expect(section.includes(`Reason on record: ${explanation}`)).toBe(needsReason);
            expect(section).toContain(`Change it: gspot set ${row.key} <value>${target} [--reason "<why>"]`);
        }
        const reported = await runGspot(sandbox.path, ['explain', row.key, '--json']);
        expect(reported.code, reported.stdout + reported.stderr).toBe(0);
        expect(JSON.parse(reported.stdout)).toMatchObject({
            key: row.key,
            scopes: [
                { scope: '', current: row.current[0] },
                { scope: 'app', current: row.current[1], ...(row.needsReason[1] ? { reason: explanation } : {}) },
            ],
        });
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    },
);
test('a neutral format setting stays settable without a reason', async () => {
    const key = 'format.indent_style';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['data-files'], { level: 'all', rules: true, scopes: [{ path: 'app' }] }),
        'app/project.toml': 'name = "Project"\n',
    });

    const changed = await runGspot(sandbox.path, ['set', key, 'tab', '--scope', 'app']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const human = await runGspot(sandbox.path, ['explain', key]);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stdout).not.toContain('Reason:');
    const structured = await runGspot(sandbox.path, ['explain', key, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(JSON.parse(structured.stdout)).not.toHaveProperty('reason_needed');
    expect(JSON.parse(structured.stdout)).toMatchObject({
        scopes: [
            { scope: '', current: 'space' },
            { scope: 'app', current: 'tab' },
        ],
    });
});

test('explain shows the default of a path setting joined with the scope, as gspot uses it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true, scopes: [{ path: 'web', configurations: ['site'] }] }),
        'web/index.html': '<!doctype html><title>Example</title>\n',
    });
    const explained = await runGspot(sandbox.path, ['explain', 'site.build_folder', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    const { scopes } = JSON.parse(explained.stdout) as {
        scopes: { scope: string; default: unknown; current: unknown; source: string }[];
    };
    expect(scopes.filter((entry) => entry.scope === 'web')).toStrictEqual([
        { scope: 'web', default: 'web/dist', current: 'web/dist', source: 'configuration site' },
    ]);
});

test('explain tells you to write a record list by hand, not with gspot set', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { rules: true, scopes: [{ path: 'app' }] }),
        'index.js': 'export const example = 1;\n',
        'app/index.js': 'export const example = 1;\n',
    });
    const explained = await runGspot(sandbox.path, ['explain', 'import_rule']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(explained.stdout).toContain('write [[import_rule]] records by hand in gspot.toml');
    expect(explained.stdout).not.toContain('gspot set');
    expect(explained.stdout).not.toContain('--scope');
});
