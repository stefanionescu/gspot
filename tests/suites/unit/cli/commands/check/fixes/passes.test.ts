import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { runChecks } from '#cli/commands/check/run.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { type RunOptions } from '#cli/types/runs/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { SQL_COMMAND_CHECK_TABLES } from '#tests/config/commands/samples.ts';
import { TYPE_DECLARATION_FILES } from '#tests/config/repository/files/classify.ts';
import { runGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    TEXT_FIX_SCRIPT,
    FIX_LINTER_CASES,
    TEXT_CHECK_SCRIPT,
    GENERATED_TYPE_FILES,
} from '#tests/config/commands/check/fixes/passes.ts';

test.each([...FIX_LINTER_CASES])(
    'after --fix, the $configuration check status matches what the linter still reports',
    async (entry) => {
        await using sandbox = await testdir();
        const check = readConfigurations()
            .get(entry.configuration)!
            .checks.find((check) => check.id === `${entry.configuration}/${entry.tool}`)!;
        const executable = join(
            dirname(await Bun.resolve(`${entry.tool}/package.json`, import.meta.dir)),
            'bin',
            entry.executable,
        );
        const command = [process.execPath, executable, '--config', entry.config];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/native',
                            command: [...command, ...entry.formatter, '{files}'],
                            fix: [...command, '--fix', '{files}'],
                            exit_codes: check.exit_codes!,
                            output: check.output,
                            paths: [entry.path],
                            stage: 'commit',
                        },
                    ],
                }),
            }),
            [entry.config]: entry.nativeConfiguration,
            [entry.path]: entry.sample,
        });
        const source = await readFile(join(sandbox.path, entry.path), 'utf8');
        await writeFile(join(sandbox.path, entry.config), entry.invalidConfiguration);
        const invalid = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/native'] }));
        expect(invalid.report.exitCode).toBe(2);
        expect(invalid.report.checks).toMatchObject([{ status: 'error', findings: [] }]);
        expect(await readFile(join(sandbox.path, entry.path), 'utf8')).toBe(source);
        await writeFile(join(sandbox.path, entry.config), entry.nativeConfiguration);
        const session = await openSession(sandbox.path);
        const options: RunOptions = buildRunOptions({ fix: true, only: ['project/native'] });
        const failed = await runChecks(session, options);
        expect(failed.report.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ status: 'changed', changed: [entry.path] }]);
        expect(await readFile(join(sandbox.path, entry.path), 'utf8')).toBe(entry.partial);
        await writeFile(join(sandbox.path, entry.path), entry.corrected);
        const corrected = await runChecks(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode, JSON.stringify(corrected)).toBe(0);
    },
);

test('after --fix, the checks read the fixed file and other files stay as they were', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['sql'], {
        level: 'all',
        tables: `[tools.sqlfluff]\ndialect = "postgres"\n${stringify({
            command_check: [
                {
                    id: 'project/correct-sql',
                    command: [process.execPath, '-e', 'process.exitCode = 0'],
                    paths: ['query.sql'],
                    stage: 'commit',
                    fix: [process.execPath, 'correct.cjs', '{files}'],
                    output: { format: 'none' },
                },
            ],
        })}`,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings + SQL_COMMAND_CHECK_TABLES,
        'query.sql': 'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n',
        'notes.txt': 'Authored notes.\n',
        'correct.cjs': String.raw`const fs = require("node:fs"); for (const path of process.argv.slice(2)) fs.writeFileSync(path, "select 1;\n");`,
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['project/read-sql', 'project/correct-sql'] });
    const failed = await runChecks(session, options);
    expect(failed.report.exitCode).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual([{ file: 'query.sql', line: 1, rule: undefined }]);
    const corrected = await runChecks(await openSession(session.root), { ...options, fix: true });
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks.map(({ check, status, findings }) => ({ check, status, findings }))).toStrictEqual([
        { check: 'project/correct-sql', status: 'passed', findings: [] },
        { check: 'project/read-sql', status: 'passed', findings: [] },
    ]);
    expect(await readFile(join(sandbox.path, 'query.sql'), 'utf8')).toBe('select 1;\n');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings + SQL_COMMAND_CHECK_TABLES);
    expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('Authored notes.\n');
});

test('a later pass formats what a fix after the formatter wrote', async () => {
    await using sandbox = await testdir({
        'source.txt': 'var x\n',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/format',
                        stage: 'commit',
                        paths: ['*.txt'],
                        command: [process.execPath, '-e', TEXT_CHECK_SCRIPT, '  ', '{files}'],
                        fix: [process.execPath, '-e', TEXT_FIX_SCRIPT, '  ', ' ', '{files}'],
                    },
                    {
                        id: 'project/codemod',
                        stage: 'commit',
                        paths: ['*.txt'],
                        command: [process.execPath, '-e', TEXT_CHECK_SCRIPT, 'var', '{files}'],
                        fix: [process.execPath, '-e', TEXT_FIX_SCRIPT, 'var', 'let ', '{files}'],
                    },
                ],
            }),
        }),
    });

    const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/format', 'project/codemod'] });
    const result = await runChecks(await openSession(sandbox.path), options);
    expect(result.report.exitCode, JSON.stringify(result.report.checks)).toBe(0);
    expect(result.fixes?.results).toMatchObject([
        { check: 'project/format', status: 'changed', changed: ['source.txt'] },
        { check: 'project/codemod', status: 'changed', changed: ['source.txt'] },
    ]);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('let x\n');
});

test('a fixer that fails midway leaves the later fixers to run in order and keep their edits', async () => {
    const entries = ['first', 'second', 'third'].map((name, index) => {
        const script = String.raw`const fs = require('node:fs'); fs.appendFileSync('order.log', '${name}\n'); fs.writeFileSync('${name}.txt', 'fixed\n'); process.exitCode = ${index === 0 ? '3' : '0'};`;
        return {
            id: `sandbox/${name}`,
            command: [process.execPath, '-e', 'process.exitCode = 0'],
            fix: [process.execPath, '-e', script],
            paths: [`${name}.txt`],
            stage: 'commit',
        };
    });
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: entries }) }),
        'first.txt': 'original\n',
        'second.txt': 'original\n',
        'third.txt': 'original\n',
    });

    const fixed = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            '--only',
            'sandbox/first,sandbox/second,sandbox/third',
            '--fix',
            '--json',
        ]),
    );
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(2);
    expect(fixed.report.failed).toStrictEqual(['sandbox/first']);
    // A second pass reruns the fixers whose files the first pass changed; the failed fixer does not run again.
    expect(await readFile(join(sandbox.path, 'order.log'), 'utf8')).toBe('first\nsecond\nthird\nsecond\nthird\n');
    for (const name of ['first', 'second', 'third'])
        expect(await readFile(join(sandbox.path, `${name}.txt`), 'utf8')).toBe('fixed\n');
});

test('a fix run keeps the generated-file list', async () => {
    const text = buildSandboxSettings(['nextjs', 'cloudflare'], {
        scopes: [{ path: 'app', configurations: ['nextjs', 'cloudflare'] }],
        tables: stringify({
            command_check: [
                {
                    id: 'project/correct',
                    paths: ['marker.txt'],
                    stage: 'commit',
                    command: [process.execPath, '-e', 'process.exitCode = 0'],
                    fix: [process.execPath, '-e', TEXT_FIX_SCRIPT, 'before', 'after', '{files}'],
                    output: { format: 'none' },
                },
            ],
        }),
    });
    await using sandbox = await testdir({ 'gspot.toml': text, 'marker.txt': 'before', ...TYPE_DECLARATION_FILES });
    const session = await openSession(sandbox.path);
    const before = session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path);
    expect(before.toSorted((left, right) => left.localeCompare(right))).toStrictEqual([...GENERATED_TYPE_FILES]);
    const result = await runChecks(session, buildRunOptions({ only: ['project/correct'], fix: true }));
    expect(result.report.checks.find(({ check }) => check === 'project/correct')?.status).toBe('passed');
    expect(result.fixes?.changed).toStrictEqual(['marker.txt']);
    expect(session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path)).toStrictEqual(
        before,
    );
});
