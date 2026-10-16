import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { SQL_CHECK } from '#tests/config/sql.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type RunOptions } from '#cli/types/execution/check.ts';
import { DECLARATION_FILES } from '#tests/config/repository.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { checkReport, buildRunOptions } from '#tests/setup/run-gspot.ts';
import { getProjectDependencies } from '#cli/repository/dependency-files.ts';
import { TEXT_FIX, TEXT_CHECK, FIX_LINTER_CASES } from '#tests/config/execution.ts';
import { REACT_VUE_PACKAGES, CLEAR_DEPENDENCIES_SCRIPT, ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/config/npm.ts';

test('fix preserves discovered project scopes when checking each project task', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['docs'], { level: 'all' }),
        'package.json': '{"name":"root","private":true,"scripts":{"root":"true"}}',
        'README.md': 'Run `bun run root`.\n',
        'app/package.json': '{"name":"app","private":true,"scripts":{"child":"true"}}',
        'app/README.md': 'Run `bun run child`.\n',
        'app/main.js': 'export const ready = true;\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.repository.scopes.map(({ path }) => path)).toContain('app');
    const options = buildRunOptions({ only: ['docs/missing-paths'] });
    const plain = await executeRun(session, options);
    const fixed = await executeRun(await openSession(session.root), { ...options, fix: true });
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
        const check = readManifests(createReadCache(process.cwd()))
            .get(entry.configuration)!
            .checks.find((check) => check.name === `${entry.configuration}/${entry.tool}`)!;
        const executable = join(
            dirname(await Bun.resolve(`${entry.tool}/package.json`, import.meta.dir)),
            'bin',
            entry.executable,
        );
        const command = [process.execPath, executable, '--config', entry.config];
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: [],
                command_check: [
                    {
                        name: 'project/native',
                        command: [...command, ...entry.formatter, '{files}'],
                        fix: [...command, '--fix', '{files}'],
                        exit_codes: check.exit_codes!,
                        output: check.output,
                        paths: [entry.path],
                        stage: 'commit',
                    },
                ],
            }),
            [entry.config]: entry.nativeConfiguration,
            [entry.path]: entry.sample,
        });
        const source = await readFile(join(sandbox.path, entry.path), 'utf8');
        await writeFile(join(sandbox.path, entry.config), entry.invalidConfiguration);
        const invalid = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['project/native'] }),
        );
        expect(invalid.report.exitCode).toBe(2);
        expect(invalid.report.checks).toMatchObject([{ status: 'error', findings: [] }]);
        expect(await readFile(join(sandbox.path, entry.path), 'utf8')).toBe(source);
        await writeFile(join(sandbox.path, entry.config), entry.nativeConfiguration);
        const session = await openSession(sandbox.path);
        const options: RunOptions = buildRunOptions({ fix: true, only: ['project/native'] });
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ status: 'changed', changed: [entry.path] }]);
        expect(await readFile(join(sandbox.path, entry.path), 'utf8')).toBe(entry.partial);
        await Bun.write(join(sandbox.path, entry.path), entry.corrected);
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode, JSON.stringify(corrected)).toBe(0);
    },
);
{
    test('after --fix, the checks read the fixed file and other files stay as they were', async () => {
        await using sandbox = await testdir();
        const settings = `level = "all"
configurations = ["sql"]
[tools.sqlfluff]
dialect = "postgres"
[[command_check]]\nname = "project/correct-sql"
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
paths = ["query.sql"]
stage = "commit"
fix = [${JSON.stringify(process.execPath)}, "correct.cjs", "{files}"]
[command_check.output]
format = "none"
`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settings + SQL_CHECK,
            'query.sql': 'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n',
            'notes.txt': 'Authored notes.\n',
            'correct.cjs': String.raw`const fs = require("node:fs"); for (const path of process.argv.slice(2)) fs.writeFileSync(path, "select 1;\n");`,
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ only: ['project/read-sql', 'project/correct-sql'] });
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode).toBe(1);
        expect(failed.report.checks.flatMap((check) => check.findings)).toContainEqual(
            containing({ file: 'query.sql', line: 1 }),
        );
        const corrected = await executeRun(await openSession(session.root), { ...options, fix: true });
        expect(corrected.report.exitCode).toBe(0);
        expect(
            corrected.report.checks.map(({ check, status, findings }) => ({ check, status, findings })),
        ).toStrictEqual([
            { check: 'project/correct-sql', status: 'passed', findings: [] },
            { check: 'project/read-sql', status: 'passed', findings: [] },
        ]);
        expect(await Bun.file(join(sandbox.path, 'query.sql')).text()).toBe('select 1;\n');
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings + SQL_CHECK);
        expect(await Bun.file(join(sandbox.path, 'notes.txt')).text()).toBe('Authored notes.\n');
    });

    test('a later pass formats what a fix after the formatter wrote', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'source.txt': 'var x\n',
            'gspot.toml': `configurations = []
[[command_check]]\nname = "project/format"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK, '  ', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX, '  ', ' ', '{files}'])}
[[command_check]]\nname = "project/codemod"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK, 'var', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX, 'var', 'let ', '{files}'])}
`,
        });
        const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/format', 'project/codemod'] });
        const outcome = await executeRun(await openSession(sandbox.path), options);
        expect(outcome.report.exitCode, JSON.stringify(outcome.report.checks)).toBe(0);
        expect(outcome.fixes?.results).toMatchObject([
            { check: 'project/format', status: 'changed', changed: ['source.txt'] },
            { check: 'project/codemod', status: 'changed', changed: ['source.txt'] },
        ]);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('let x\n');
    });

    test('a fixer that fails midway leaves the later fixers to run in order and keep their edits', async () => {
        const entries = ['first', 'second', 'third'].map((name, index) => {
            const script = String.raw`const fs = require('node:fs'); fs.appendFileSync('order.log', '${name}\n'); fs.writeFileSync('${name}.txt', 'fixed\n'); process.exitCode = ${index === 0 ? '3' : '0'};`;
            return `[[command_check]]\nname = "sandbox/${name}"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}\nfix = ${JSON.stringify([process.execPath, '-e', script])}\npaths = ["${name}.txt"]\nstage = "commit"\n`;
        });
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `configurations = []\n${entries.join('')}`,
            'first.txt': 'original\n',
            'second.txt': 'original\n',
            'third.txt': 'original\n',
        });
        const fixed = await checkReport(sandbox.path, [
            'check',
            '--only',
            'sandbox/first',
            'sandbox/second',
            'sandbox/third',
            '--fix',
            '--json',
        ]);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(2);
        expect(fixed.report.failed).toStrictEqual(['sandbox/first']);
        // A second pass reruns the fixers whose files the first pass changed; the failed fixer does not run again.
        expect(await readFile(join(sandbox.path, 'order.log'), 'utf8')).toBe('first\nsecond\nthird\nsecond\nthird\n');
        for (const name of ['first', 'second', 'third'])
            expect(await readFile(join(sandbox.path, `${name}.txt`), 'utf8')).toBe('fixed\n');
    });

    test('checks refresh the file inventory after a fixer creates a source', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'source.txt': 'input',
            'gspot.toml': `configurations = []
[[command_check]]\nname = "project/inventory"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = process.argv.includes("added.txt") ? 0 : 1', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("added.txt", "created")'])}
`,
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/inventory'] });
        const outcome = await executeRun(session, options);
        expect(outcome.report.exitCode).toBe(0);
        expect(outcome.report.checks[0]!.fileCount).toBe(2);
        expect(session.repository.files.map((file) => file.path)).not.toContain('added.txt');
    });
}
{
    test('a fix run keeps the generated-file list', async () => {
        const text = settingsText(['nextjs', 'cloudflare'], {
            tables: `[[command_check]]
name = "project/correct"
paths = ["marker.txt"]
stage = "commit"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX, 'before', 'after', '{files}'])}
output = { format = "none" }
[[scope]]
path = "app"
configurations = ["nextjs", "cloudflare"]
`,
        });
        await using sandbox = await testdir({ 'gspot.toml': text, 'marker.txt': 'before', ...DECLARATION_FILES });
        const session = await openSession(sandbox.path);
        const before = session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path);
        expect(before.toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
            'app/next-env.d.ts',
            'app/worker-configuration.d.ts',
            'next-env.d.ts',
            'worker-configuration.d.ts',
        ]);
        const report = await executeRun(session, buildRunOptions({ only: ['project/correct'], fix: true }));
        expect(report.report.checks.find(({ check }) => check === 'project/correct')?.status).toBe('passed');
        expect(report.fixes?.changed).toContain('marker.txt');
        expect(
            session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path),
        ).toStrictEqual(before);
    });
}
{
    test('fix verification preserves the caller session and its child package facts', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...REACT_VUE_PACKAGES,
            'gspot.toml': settingsText(['javascript'], {
                tables: `[[scope]]
path = "app"
configurations = ["javascript"]
[[command_check]]\nname = "project/update-package"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix = ${JSON.stringify([process.execPath, '-e', CLEAR_DEPENDENCIES_SCRIPT])}
paths = ["package.json"]
stage = "commit"
[command_check.output]
format = "none"
`,
            }),
        });
        const session = await openSession(sandbox.path);
        const outcome = await executeRun(session, buildRunOptions({ only: ['project/update-package'], fix: true }));
        expect(outcome.report.exitCode).toBe(0);
        expect(outcome.fixes?.results).toMatchObject([
            { check: 'project/update-package', status: 'changed', changed: ['package.json'] },
        ]);
        expect(getProjectDependencies(session.packageManifests, '')).toStrictEqual({ react: '19.0.0' });
        expect(getProjectDependencies(session.packageManifests, 'app')).toStrictEqual({ vue: '3.5.0' });
        expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(ROOT_PACKAGE_WITHOUT_DEPENDENCIES);
        expect(await Bun.file(join(sandbox.path, 'app/package.json')).text()).toBe(
            REACT_VUE_PACKAGES['app/package.json'],
        );
    });
}
