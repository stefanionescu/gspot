import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { runChecks } from '#cli/commands/check/run.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { type RunOptions } from '#cli/types/runs/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { SQL_COMMAND_CHECK_TABLES } from '#tests/config/commands/samples.ts';
import { FIX_LINTER_CASES } from '#tests/config/commands/check/fixes/passes.ts';
import { runGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

test.each([...FIX_LINTER_CASES])(
    'after --fix, the $configuration check status matches what the linter still reports',
    async (row) => {
        await using sandbox = await createGitSandbox({});
        const check = readConfigurations()
            .get(row.configuration)!
            .checks.find((check) => check.id === `${row.configuration}/${row.tool}`)!;
        const executable = join(
            dirname(await Bun.resolve(`${row.tool}/package.json`, import.meta.dir)),
            'bin',
            row.executable,
        );
        const command = [process.execPath, executable, '--config', row.config];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/native',
                            command: [...command, ...row.formatter, '{files}'],
                            fix: [...command, '--fix', '{files}'],
                            exit_codes: check.exit_codes!,
                            output: check.output,
                            paths: [row.path],
                            stage: 'commit',
                        },
                    ],
                }),
            }),
            [row.config]: row.nativeConfiguration,
            [row.path]: row.sample,
        });
        const source = await readFile(join(sandbox.path, row.path), 'utf8');
        await writeFile(join(sandbox.path, row.config), row.invalidConfiguration);
        const invalid = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/native'] }));
        expect(invalid.report.exitCode).toBe(2);
        expect(invalid.report.checks).toMatchObject([{ status: 'error', findings: [] }]);
        expect(await readFile(join(sandbox.path, row.path), 'utf8')).toBe(source);
        await writeFile(join(sandbox.path, row.config), row.nativeConfiguration);
        const session = await openSession(sandbox.path);
        const options: RunOptions = buildRunOptions({ fix: true, only: ['project/native'] });
        const failed = await runChecks(session, options);
        expect(failed.report.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ status: 'changed', changed: [row.path] }]);
        expect(await readFile(join(sandbox.path, row.path), 'utf8')).toBe(row.partial);
        await writeFile(join(sandbox.path, row.path), row.corrected);
        const corrected = await runChecks(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode, JSON.stringify(corrected)).toBe(0);
    },
);

test('after --fix, the checks read the fixed file and other files stay as they were', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['sql'], {
        level: 'all',
        tables: `[tools.sqlfluff]\ndialect = "postgres"\n${stringify({
            command_check: [
                {
                    id: 'project/correct-sql',
                    command: buildProgramCommand('fakes/tool'),
                    paths: ['query.sql'],
                    stage: 'commit',
                    fix: buildProgramCommand('fakes/tool', '--text', 'select 1;\n', '{files}'),
                    output: { format: 'none' },
                },
            ],
        })}`,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings + SQL_COMMAND_CHECK_TABLES,
        'query.sql': 'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n',
        'notes.txt': 'Authored notes.\n',
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
    await using sandbox = await createGitSandbox({
        'source.txt': 'var x\n',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/format',
                        stage: 'commit',
                        paths: ['*.txt'],
                        command: buildProgramCommand('checks/search', '--text', '  ', '--', '{files}'),
                        fix: buildProgramCommand('checks/replacement', '  ', ' ', '{files}'),
                    },
                    {
                        id: 'project/codemod',
                        stage: 'commit',
                        paths: ['*.txt'],
                        command: buildProgramCommand('checks/search', '--text', 'var', '--', '{files}'),
                        fix: buildProgramCommand('checks/replacement', 'var', 'let ', '{files}'),
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
    const checks = ['first', 'second', 'third'].map((name, index) => {
        return {
            id: `sandbox/${name}`,
            command: buildProgramCommand('fakes/tool'),
            fix: buildProgramCommand(
                'fakes/tool',
                '--append',
                `order.log=${name}\n`,
                '--write',
                `${name}.txt=fixed\n`,
                '--exit',
                index === 0 ? '3' : '0',
            ),
            paths: [`${name}.txt`],
            stage: 'commit',
        };
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: checks }) }),
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
    expect(await readFile(join(sandbox.path, 'order.log'), 'utf8')).toBe('first\nsecond\nthird\nsecond\nthird\n');
    for (const name of ['first', 'second', 'third'])
        expect(await readFile(join(sandbox.path, `${name}.txt`), 'utf8')).toBe('fixed\n');
});
