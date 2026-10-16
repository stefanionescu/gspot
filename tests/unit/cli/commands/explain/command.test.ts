import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { TAPLO_REASON, TAPLO_OPTIONS } from '#tests/config/set.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import type { PathExplanation } from '#cli/types/commands/explain.ts';
import { REASON_VALUES, EXPLAIN_SETTINGS } from '#tests/config/explain.ts';
import { containing, containingAll, textContaining } from '#tests/setup/matchers.ts';

test("explain shows each scope's default and current naming limit", async () => {
    const settings = buildKnownSettings(
        selectConfigurations(['naming'], readManifests(createReadCache(process.cwd()))),
    );
    const swift = Number(settings.defaults.get('naming.swift.max_characters')?.value);
    const sql = Number(settings.defaults.get('naming.sql.max_words')?.value);
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['naming'], {
            level: 'all',
            tables: `[[scope]]\npath = "app"\n[scope.naming.swift]\nmax_characters = ${(swift - 2).toString()}\n`,
        }),
        'entry.sh': 'echo example\n',
        'app/entry.sh': 'echo example\n',
    });
    for (const [key, shipped, child] of [
        ['naming.swift.max_characters', swift, swift - 2],
        ['naming.sql.max_words', sql, sql],
    ] as const) {
        const explained = await runGspot(sandbox.path, ['explain', key, '--json']);
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout)).toMatchObject({
            kind: 'setting',
            scopes: [
                { scope: '', default: shipped, current: shipped },
                { scope: 'app', default: shipped, current: child },
            ],
        });
    }
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

test('a path explanation lists the command checks and the ignores that apply', async () => {
    await using sandbox = await testdir();
    const settings = `configurations = []
[[scope]]
path = "api"
configurations = []
[[command_check]]
name = "project/syntax"
command = ["bash", "-n", "{files}"]
paths = ["**/*.sh"]
stage = "manual"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': `${settings}\n[[ignore]]\ncheck = "project/syntax"\nreason = "The sandbox tests a disabled check."\n`,
        'api/build.sh': CLEAN_BASH_SCRIPT,
    });
    const ignored = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(ignored.code).toBe(0);
    expect(JSON.parse(ignored.stdout)).toMatchObject({
        ignores: [{ check: 'project/syntax', reason: 'The sandbox tests a disabled check.' }],
    });
    await writeFile(join(sandbox.path, 'gspot.toml'), settings);
    const corrected = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toMatchObject({
        checks: containingAll([containing({ check: 'project/syntax', stage: 'manual' })]),
        ignores: [],
    });
    expect(JSON.parse(corrected.stdout)).not.toHaveProperty('unchecked');
    const command = await runGspot(sandbox.path, ['explain', 'project/syntax', '--json']);
    expect(command.code, command.stdout + command.stderr).toBe(0);
    expect(JSON.parse(command.stdout)).toMatchObject({
        kind: 'check',
        check: 'project/syntax',
        stage: 'manual',
        command: ['bash', '-n', '{files}'],
        paths: ['**/*.sh'],
    });
    const remaining = (JSON.parse(ignored.stdout) as PathExplanation).checks;
    expect(remaining.map((entry) => entry.check)).not.toContain('project/syntax');
    expect(remaining.map((entry) => entry.check)).toContain('format/editorconfig-checker');
});

test('a configuration name stays a name, and a tracked or ./ path explains the file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EXPLAIN_SETTINGS,
        bash: CLEAN_BASH_SCRIPT,
        'api/build.sh': CLEAN_BASH_SCRIPT,
        'shellcheck/run.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const configuration = await runGspot(sandbox.path, ['explain', 'bash', '--json']);
    expect(configuration.code, configuration.stdout + configuration.stderr).toBe(0);
    expect(JSON.parse(configuration.stdout)).toMatchObject({
        kind: 'configuration',
        subject: 'bash',
        title: 'Bash, zsh, and Bats scripts',
    });
    const file = await runGspot(sandbox.path, ['explain', './bash', '--json']);
    expect(file.code, file.stdout + file.stderr).toBe(0);
    expect(JSON.parse(file.stdout)).toMatchObject({ kind: 'path', subject: 'bash', path: 'bash' });
    // The shellcheck folder shares a check's tool name; the tracked path still selects the file.
    const tracked = await runGspot(sandbox.path, ['explain', 'shellcheck/run.sh', '--json']);
    expect(tracked.code, tracked.stdout + tracked.stderr).toBe(0);
    expect(JSON.parse(tracked.stdout)).toMatchObject({ kind: 'path', subject: 'shellcheck/run.sh' });
});

test('a file path reports its scope, checks, and ignores', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EXPLAIN_SETTINGS,
        'api/build.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        kind: 'path',
        subject: 'api/build.sh',
        path: 'api/build.sh',
        scope: 'api',
        fileKind: 'source',
        configurations: containingAll(['bash']),
        checks: containingAll([{ check: 'bash/shellcheck', stage: 'commit', configuration: 'bash' }]),
        ignores: [
            {
                check: 'bash/shellcheck',
                rule: 'SC2086',
                reason: 'The script deliberately splits a list of arguments.',
            },
        ],
    });
});

test('a missing ./ path fails', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': EXPLAIN_SETTINGS, 'api/build.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const missing = await runGspot(sandbox.path, ['explain', './missing.sh', '--json']);
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.stdout)).toMatchObject({ error: 'arguments', message: textContaining('missing.sh') });
});

test('an unknown subject gets the command error', async () => {
    await using sandbox = await testdir();
    const result = await runGspot(sandbox.path, ['explain', 'unknown-configuration', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: textContaining('There is no configuration called `unknown-configuration`.'),
    });
});

test('configuration and check explanations still resolve without settings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    for (const [subject, kind] of [
        ['bash', 'configuration'],
        ['bash/shellcheck', 'check'],
    ] as const) {
        const result = await runGspot(sandbox.path, ['explain', subject, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ kind, subject });
    }
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

test.each([...REASON_VALUES])('explain $key shows each scope value and whether it needs a reason', async (row) => {
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
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'app/source.js': 'export const active = true;\n' });
    const result = await runGspot(sandbox.path, ['explain', row.key]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const sections = result.stdout.split('Scope: ').slice(1);
    expect(sections).toHaveLength(2);
    for (const [scope, section, owed, target] of [
        ['root', sections[0]!, row.owed[0], ''],
        ['app', sections[1]!, row.owed[1], ' --scope app'],
    ] as const) {
        expect(section).toStartWith(`${scope}\n`);
        expect(section.includes('If you set this value, give a reason:')).toBe(owed);
        expect(section.includes(`Reason on record: ${explanation}`)).toBe(owed);
        expect(section).toContain(`Change it: gspot set ${row.key} <value>${target} [--reason "..."]`);
    }
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
});

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
