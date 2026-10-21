import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { SETTING_REASON } from '#tests/data/commands/set.ts';
import { REASON_VALUES } from '#tests/data/commands/explain.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';

test.each(['swift', 'sql'])("explain shows each scope's default and current naming limit (%j)", async (language) => {
    const settings = buildKnownSettings(selectConfigurations(['naming'], readManifests()), 'recommended');
    const swift = Number(settings.defaults.get('naming.swift.max_characters')?.value);
    const sql = Number(settings.defaults.get('naming.sql.max_words')?.value);
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['naming'], {
            level: 'all',
            tables: `[[scope]]\npath = "app"\n[scope.naming.swift]\nmax_characters = ${(swift - 2).toString()}\n`,
        }),
        'entry.sh': 'echo example\n',
        'app/entry.sh': 'echo example\n',
    });

    const [key, shipped, child] =
        language === 'swift' ? ['naming.swift.max_characters', swift, swift - 2] : ['naming.sql.max_words', sql, sql];

    const explained = await runGspot(sandbox.path, ['explain', key, '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(JSON.parse(explained.stdout)).toMatchObject({
        kind: 'setting',
        scopes: [
            { scope: '', default: shipped, current: shipped },
            { scope: 'app', default: shipped, current: child },
        ],
    });
});
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
    expect(JSON.parse(result.stdout)).toMatchObject({
        scopes: [
            { scope: 'api', current: 90, source: '[scope "api"]' },
            { scope: 'api/worker', current: 95, source: '[scope "api/worker"]' },
        ],
    });
});

test('explain reads an inherited limits.function_lines value and its reason, and writes nothing', async () => {
    await using sandbox = await testdir();
    const settings =
        'configurations = ["structure"]\n[limits]\nfunction_lines = { value = 100, reason = ' +
        JSON.stringify(SETTING_REASON) +
        ' }\n[[scope]]\npath = "app"\n';
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
test.each(REASON_VALUES.flatMap((row) => [0, 1].map((index) => ({ row, index }))))(
    'explain $key shows each scope value and whether it needs a reason (%j)',
    async ({ row, index }) => {
        await using sandbox = await testdir();
        const explanation = 'The sandbox preserves the project convention for this native setting.';
        const separator = row.key.lastIndexOf('.');
        const table = row.key.slice(0, separator);
        const field = row.key.slice(separator + 1);
        const settings = `configurations = ["naming"]
[${table}]
${field} = ${row.root}
[[scope]]\npath = "app"
configurations = []
[scope.${table}]
${field} = ${row.owed[1] ? `{ value = ${row.child}, reason = "${explanation}" }` : row.child}
`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'app/source.js': 'export const active = true;\n',
        });
        const result = await runGspot(sandbox.path, ['explain', row.key]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const sections = result.stdout.split('Scope: ').slice(1);
        expect(sections).toHaveLength(2);
        const [scope, section, owed, target] = (
            [
                ['root', sections[0]!, row.owed[0], ''],
                ['app', sections[1]!, row.owed[1], ' --scope app'],
            ] as const
        )[index]!;

        expect(section).toStartWith(`${scope}\n`);
        expect(section.includes('If you set this value, give a reason:')).toBe(owed);
        expect(section.includes(`Reason on record: ${explanation}`)).toBe(owed);
        expect(section).toContain(`Change it: gspot set ${row.key} <value>${target} [--reason "..."]`);
        const reported = await runGspot(sandbox.path, ['explain', row.key, '--json']);
        expect(reported.code, reported.stdout + reported.stderr).toBe(0);
        expect(JSON.parse(reported.stdout)).toMatchObject({
            key: row.key,
            scopes: [
                { scope: '', current: row.current[0] },
                { scope: 'app', current: row.current[1], ...(row.owed[1] ? { reason: explanation } : {}) },
            ],
        });
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    },
);
test('a neutral format setting stays settable without a reason', async () => {
    const level = 'all';
    const key = 'format.indent_style';
    const value = 'tab';
    const root = 'space';
    const child = 'tab';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['files'], { level: level, rules: true, scopes: [{ path: 'app' }] }),
        'app/project.toml': 'name = "Project"\n',
    });

    const changed = await runGspot(sandbox.path, ['set', key, value, '--scope', 'app']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const human = await runGspot(sandbox.path, ['explain', key]);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stdout).not.toContain('Reason:');
    const structured = await runGspot(sandbox.path, ['explain', key, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(JSON.parse(structured.stdout)).not.toHaveProperty('reason_needed');
    expect(JSON.parse(structured.stdout)).toMatchObject({
        scopes: [
            { scope: '', current: root },
            { scope: 'app', current: child },
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
        scopes: { scope: string; default: unknown; current: unknown }[];
    };
    const web = scopes.find((entry) => entry.scope === 'web');
    expect(web?.default).toBe(web?.current);
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
