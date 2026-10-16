import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { REASON_VALUES } from '#tests/data/commands/explain.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { TAPLO_REASON, TAPLO_OPTIONS } from '#tests/data/commands/set.ts';

test.each(['swift', 'sql'])("explain shows each scope's default and current naming limit (%j)", async (language) => {
    const settings = buildKnownSettings(
        selectConfigurations(['naming'], readManifests(createReadCache(process.cwd()))),
    );
    const swift = Number(settings.defaults.get('naming.swift.max_characters')?.value);
    const sql = Number(settings.defaults.get('naming.sql.max_words')?.value);
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['naming'], {
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = []
[[scope]]
path = "api"
configurations = ["jest"]
[scope.coverage]
lines = 90
[[scope]]
path = "api/worker"
configurations = []
[scope.coverage]
lines = 95
`,
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
test('explain reads extra Taplo options and their inherited reason, and writes nothing', async () => {
    await using sandbox = await testdir();
    const settings = `configurations = ["files"]\n[tools.taplo]\nextra = { value = { compact_inline_tables = true }, reason = "${TAPLO_REASON}" }\n[[scope]]\npath = "app"\n`;
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'app/settings.toml': 'enabled = true\n' });
    const explained = await runGspot(sandbox.path, ['explain', 'tools.taplo.extra', '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(JSON.parse(explained.stdout)).toMatchObject({
        kind: 'setting',
        key: 'tools.taplo.extra',
        type: 'table',
        scopes: ['', 'app'].map((scope) => ({
            scope,
            current: TAPLO_OPTIONS,
            source: 'gspot.toml',
            reason: TAPLO_REASON,
        })),
    });
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
});
test.each(REASON_VALUES.flatMap((row) => [0, 1].map((index) => ({ row, index }))))(
    'explain $key shows each scope value and whether it needs a reason (%j)',
    async ({ row, index }) => {
        await using sandbox = await testdir();
        const explanation = 'The sandbox preserves the project convention for this native setting.';
        const settings = `configurations = ["naming"]
[${row.table}]
${row.field} = ${row.root}
[[scope]]\npath = "app"
configurations = []
[scope.${row.table}]
${row.field} = ${row.owed[1] ? `{ value = ${row.child}, reason = "${explanation}" }` : row.child}
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
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
    },
);
test('a neutral format setting stays settable without a reason', async () => {
    const level = 'all';
    const key = 'format.indent_style';
    const value = 'tab';
    const root = 'space';
    const child = 'tab';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "${level}"\nconfigurations = ["files"]\n[[scope]]\npath = "app"\n`,
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
