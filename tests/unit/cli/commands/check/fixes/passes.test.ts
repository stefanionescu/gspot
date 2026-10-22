import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { type RunOptions } from '#cli/types/runs/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { SQL_COMMAND_CHECK_TABLES } from '#tests/data/runs/command.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import { TYPE_DECLARATION_FILES } from '#tests/data/repository/file-classification.ts';
import { REACT_VUE_PACKAGES, ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/data/repository/dependency-files.ts';

import {
    TEXT_FIX_SCRIPT,
    FIX_LINTER_CASES,
    TEXT_CHECK_SCRIPT,
    GENERATED_TYPE_FILES,
    CLEAR_DEPENDENCIES_SCRIPT,
} from '#tests/data/commands/check/fixes/passes.ts';

test('a fix run rereads the repository and keeps the package scopes it found', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        'package.json': '{"name":"root","private":true,"scripts":{"root":"true"}}',
        'README.md': 'Run `bun run root`.\n',
        'app/package.json': '{"name":"app","private":true,"scripts":{"child":"true"}}',
        'app/README.md': 'Run `bun run child`.\n',
        'app/main.js': 'export const ready = true;\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.repository.scopeFolders.map(({ path }) => path)).toContain('app');
    const options = buildRunOptions({ only: ['docs/missing-paths'] });
    const plain = await runChecks(session, options);
    const fixed = await runChecks(await openSession(session.root), { ...options, fix: true });
    expect(plain.report.exitCode).toBe(0);
    expect(fixed.report.exitCode, JSON.stringify(fixed.report.checks)).toBe(0);
    expect(fixed.report.checks.map(({ scope, status, findings }) => ({ scope, status, findings }))).toStrictEqual(
        plain.report.checks.map(({ scope, status, findings }) => ({ scope, status, findings })),
    );
});

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
    const settings = `level = "all"
configurations = ["sql"]
[tools.sqlfluff]
dialect = "postgres"
[[command_check]]\nid = "project/correct-sql"
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
paths = ["query.sql"]
stage = "commit"
fix = [${JSON.stringify(process.execPath)}, "correct.cjs", "{files}"]
[command_check.output]
format = "none"
`;
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
    expect(failed.report.checks.flatMap((check) => check.findings)).toContainEqual(
        matchFields({ file: 'query.sql', line: 1 }),
    );
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
            tables: `[[command_check]]
id = "project/format"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK_SCRIPT, '  ', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX_SCRIPT, '  ', ' ', '{files}'])}
[[command_check]]
id = "project/codemod"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK_SCRIPT, 'var', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX_SCRIPT, 'var', 'let ', '{files}'])}
`,
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
        return `[[command_check]]\nid = "sandbox/${name}"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}\nfix = ${JSON.stringify([process.execPath, '-e', script])}\npaths = ["${name}.txt"]\nstage = "commit"\n`;
    });
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: entries.join('') }),
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

test('checks refresh the file inventory after a fixer creates a source', async () => {
    await using sandbox = await testdir({
        'source.txt': 'input',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: `[[command_check]]
id = "project/inventory"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = process.argv.includes("added.txt") ? 0 : 1', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("added.txt", "created")'])}
`,
        }),
    });

    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/inventory'] });
    const result = await runChecks(session, options);
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks[0]!.fileCount).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toContain('added.txt');
});

test('a fix run keeps the generated-file list', async () => {
    const text = buildSandboxSettings(['nextjs', 'cloudflare'], {
        tables: `[[command_check]]
id = "project/correct"
paths = ["marker.txt"]
stage = "commit"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX_SCRIPT, 'before', 'after', '{files}'])}
output = { format = "none" }
[[scope]]
path = "app"
configurations = ["nextjs", "cloudflare"]
`,
    });
    await using sandbox = await testdir({ 'gspot.toml': text, 'marker.txt': 'before', ...TYPE_DECLARATION_FILES });
    const session = await openSession(sandbox.path);
    const before = session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path);
    expect(before.toSorted((left, right) => left.localeCompare(right))).toStrictEqual([...GENERATED_TYPE_FILES]);
    const report = await runChecks(session, buildRunOptions({ only: ['project/correct'], fix: true }));
    expect(report.report.checks.find(({ check }) => check === 'project/correct')?.status).toBe('passed');
    expect(report.fixes?.changed).toContain('marker.txt');
    expect(session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path)).toStrictEqual(
        before,
    );
});

test('a fix run leaves the session of its caller and the dependencies of each package unchanged', async () => {
    await using sandbox = await testdir({
        ...REACT_VUE_PACKAGES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: `[[scope]]
path = "app"
configurations = ["javascript"]
[[command_check]]\nid = "project/update-package"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix = ${JSON.stringify([process.execPath, '-e', CLEAR_DEPENDENCIES_SCRIPT])}
paths = ["package.json"]
stage = "commit"
[command_check.output]
format = "none"
`,
        }),
    });

    using resources = new DisposableStack();
    const session = await openSession(sandbox.path, { resources });
    const result = await runChecks(session, buildRunOptions({ only: ['project/update-package'], fix: true }));
    expect(result.report.exitCode).toBe(0);
    expect(result.fixes?.results).toMatchObject([
        { check: 'project/update-package', status: 'changed', changed: ['package.json'] },
    ]);
    expect(listProjectDependencyNames(session.repository.dependencyFiles, '')).toStrictEqual([]);
    expect(listProjectDependencyNames(session.repository.dependencyFiles, 'app')).toStrictEqual(['vue']);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(ROOT_PACKAGE_WITHOUT_DEPENDENCIES);
    expect(await readFile(join(sandbox.path, 'app/package.json'), 'utf8')).toBe(REACT_VUE_PACKAGES['app/package.json']);
});

test('a fixer that leaves a code file that fails to parse is named in the fix report', async () => {
    await using sandbox = await testdir();
    const breaker = String.raw`const fs = require("node:fs"); for (const path of process.argv.slice(2)) fs.writeFileSync(path, "import Hls, type { A } from 'hls.js';\n");`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: `[[command_check]]
id = "project/merge-imports"
stage = "commit"
paths = ["*.ts"]
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
fix = [${JSON.stringify(process.execPath)}, "breaker.cjs", "{files}"]
[command_check.output]
format = "none"
`,
        }),
        'client.ts': "import Hls from 'hls.js';\nexport { Hls };\n",
        'notes.ts': "export const note = 'kept';\n",
        'breaker.cjs': breaker,
    });
    const session = await openSession(sandbox.path);
    const result = await runChecks(session, { ...buildRunOptions({ only: ['project/merge-imports'] }), fix: true });
    expect(result.fixes?.broken).toStrictEqual(['client.ts', 'notes.ts']);
});
