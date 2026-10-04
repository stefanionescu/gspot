import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { TYPO } from '#tests/config/harness/spelling.ts';
import { environmentExecutable } from '#cli/platform/paths.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import type { RunOptions } from '#cli/types/execution/runtime.ts';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { chmodSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform/locations.ts';

// Root ignores the read-only permission bits that provoke the write failure.
test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'SQLFluff write failures remain execution errors when its exit code also means findings',
    async () => {
        await using sandbox = await testdir();
        const sql = configurationManifests().get('sql')!;
        const spec = sql.checks.find((check) => check.name === 'sql/sqlfluff')!;
        // A repository command declares the crash pattern itself; the manifest keeps it on the sqlfluff tool.
        const crashPattern = sql.tools.find((tool) => tool.name === 'sqlfluff')!.crash_pattern!;
        const executable = Bun.which('sqlfluff');
        if (executable === null) throw new Error('The native fixer test requires SQLFluff.');
        const args = ['--dialect', 'postgres', '--ignore-local-config', '--disable-progress-bar'];
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: [],
                check: [
                    {
                        name: 'project/native',
                        command: [executable, 'lint', ...args, '--format', 'json', '{files}'],
                        fix: [executable, 'fix', ...args, '{files}'],
                        exit_codes: spec.exit_codes!,
                        crash_pattern: crashPattern,
                        output: spec.output!,
                        paths: ['source/*.sql'],
                        stage: 'commit',
                    },
                ],
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });
        const options: RunOptions = buildRunOptions({ fix: true });
        chmodSync(join(sandbox.path, 'source'), 0o500);
        try {
            const failed = await executeRun(await openSession(sandbox.path), options);
            expect(failed.report.exitCode).toBe(2);
            expect(failed.fixes?.results).toMatchObject([
                { status: 'failed', changed: [], note: textContaining('PermissionError') },
            ]);
            expect(readFileSync(join(sandbox.path, 'source/sample.sql'), 'utf8')).toBe('select  * from foo;\n');
        } finally {
            chmodSync(join(sandbox.path, 'source'), 0o700);
        }
        const remaining = await executeRun(await openSession(sandbox.path), options);
        expect(remaining.report.exitCode).toBe(1);
        expect(remaining.fixes?.results).toMatchObject([{ status: 'changed', changed: ['source/sample.sql'] }]);
        await Bun.write(join(sandbox.path, 'source/sample.sql'), 'select id from foo;\n');
        const executed = await executeRun(await openSession(sandbox.path), options);
        expect(executed.report.exitCode).toBe(0);
    },
);

test.each([
    {
        configuration: 'sql',
        check: 'sql/sqlfluff',
        path: 'sample.sql',
        config: 'native.cfg',
        toolConfiguration: '[sqlfluff]\ndialect = postgres\nrules = LT01,AM04\n',
        command: ['sqlfluff', 'lint', '--ignore-local-config', '--config', 'native.cfg', '--format', 'json', '{files}'],
        fix: [
            'sqlfluff',
            'fix',
            '--ignore-local-config',
            '--config',
            'native.cfg',
            '--disable-progress-bar',
            '{files}',
        ],
        defect: 'select  * from foo;\n',
        partial: 'select * from foo;\n',
        corrected: 'select id from foo;\n',
    },
    {
        configuration: 'markdown',
        check: 'markdown/markdownlint',
        path: 'sample.md',
        config: 'native.mjs',
        toolConfiguration:
            'export default {config:{default:false,MD024:true,MD009:{br_spaces:0}},noBanner:true,noProgress:true,outputFormatters:[[({results,logMessage})=>logMessage(JSON.stringify(results))]]};',
        command: ['markdownlint-cli2', '--no-globs', '--config', 'native.mjs', '{files}'],
        fix: ['markdownlint-cli2', '--fix', '--no-globs', '--config', 'native.mjs', '{files}'],
        defect: '# Title\n\nA trailing space.  \n\n## Same\n\n## Same\n',
        partial: '# Title\n\nA trailing space.\n\n## Same\n\n## Same\n',
        corrected: '# Title\n\nA trailing space.\n\n## Same\n\n## Different\n',
    },
])('$check preserves native partial corrections and accepts a manual correction', async (entry) => {
    await using sandbox = await testdir();
    const spec = configurationManifests()
        .get(entry.configuration)!
        .checks.find((check) => check.name === entry.check)!;
    const executable = Bun.which(entry.command[0]);
    if (executable === null) throw new Error(`The native fixer test requires ${entry.command[0]}.`);
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            check: [
                {
                    name: 'project/native',
                    command: [executable, ...entry.command.slice(1)],
                    fix: [executable, ...entry.fix.slice(1)],
                    exit_codes: spec.exit_codes!,
                    output: spec.output!,
                    paths: [entry.path],
                    stage: 'commit',
                },
            ],
        }),
        [entry.config]: entry.toolConfiguration,
        [entry.path]: entry.defect,
    });
    const options: RunOptions = buildRunOptions({ fix: true });
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode, JSON.stringify({ report: failed.report, fixes: failed.fixes })).toBe(1);
    expect(failed.fixes?.results).toMatchObject([{ status: 'changed', changed: [entry.path] }]);
    expect(readFileSync(join(sandbox.path, entry.path), 'utf8')).toBe(entry.partial);
    await Bun.write(join(sandbox.path, entry.path), entry.corrected);
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
});

test.each([
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: 'sample.txt',
        defect: `${TYPO.the} ${TYPO.whether}\n`,
        partial: `the ${TYPO.whether}\n`,
        corrected: 'the whether\n',
    },
    {
        configuration: 'python',
        check: 'python/ruff',
        path: 'sample.py',
        defect: '"""Sample module."""\nimport os\n\nassert True\n',
        partial: '"""Sample module."""\n\nassert True\n',
        corrected: '"""Sample module."""\n',
    },
])(
    '$check fixes available defects while unresolved findings remain status 1',
    async ({ configuration, check, path, defect, partial, corrected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([configuration], { level: 'all' }),
            '.gitignore': '.gspot/\n',
            [path]: defect,
        });
        if (configuration === 'python') {
            const ruff = Bun.which('ruff');
            if (ruff === null) throw new Error('The native fixer test requires the pinned Ruff executable.');
            const executable = environmentExecutable(join(sandbox.path, PYTHON_ENVIRONMENT_DIRECTORY), 'ruff');
            mkdirSync(dirname(executable), { recursive: true });
            copyFileSync(ruff, executable);
        }
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ only: [check], fix: true });
        const failed = await executeRun(session, { ...options, skips: [], only: [check] });
        expect(failed.report.exitCode, JSON.stringify({ report: failed.report, fixes: failed.fixes })).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ check, status: 'changed', changed: [path] }]);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(partial);
        const repeated = await executeRun(await openSession(sandbox.path), {
            ...options,
            skips: [],
            only: [check],
        });
        expect(repeated.report.exitCode).toBe(1);
        expect(repeated.fixes?.results).toMatchObject([{ check, status: 'unchanged', changed: [] }]);
        await Bun.write(join(sandbox.path, path), corrected);
        const passed = await executeRun(await openSession(sandbox.path), {
            ...options,
            skips: [],
            only: [check],
        });
        expect(passed.report.exitCode, JSON.stringify(passed.report)).toBe(0);
    },
);

test('shfmt reports and fixes ordinary shell formatting', async () => {
    await using sandbox = await testdir();
    const source = "if true;then\nprintf '%s\\n' one\nfi\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
        'example.sh': source,
    });
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['bash/shfmt'] });
    const defect = await executeRun(session, options);
    expect(defect.report.exitCode, JSON.stringify(defect.report)).toBe(1);
    const correction = await executeRun(await openSession(sandbox.path), { ...options, fix: true });
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'example.sh')).text()).not.toBe(source);
    const verified = await executeRun(await openSession(sandbox.path), options);
    expect(verified.report.exitCode, JSON.stringify(verified.report)).toBe(0);
});

test.each(['space', 'tab'])('shfmt fixes shell indentation using the configured %s style', async (style) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'format'], {
            tables: `[format]\nindent_style = "${style}"\nindent_width = 4\n`,
        }),
        'example.sh': 'if true; then\n  echo ready\nfi\n',
    });
    const options = buildRunOptions({ only: ['bash/shfmt'] });
    const correction = await executeRun(await openSession(sandbox.path), { ...options, fix: true });
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    const indent = style === 'space' ? ' '.repeat(4) : '\t';
    expect(await Bun.file(join(sandbox.path, 'example.sh')).text()).toBe(`if true; then\n${indent}echo ready\nfi\n`);
    const verified = await executeRun(await openSession(sandbox.path), options);
    expect(verified.report.exitCode, JSON.stringify(verified.report)).toBe(0);
});

test('shfmt reports a syntax error as a source finding and accepts the repaired script with a space in its name', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'format']),
        'broken script.sh': 'if then\n',
    });
    const options = buildRunOptions({ only: ['bash/shfmt'] });
    const defect = await executeRun(await openSession(sandbox.path), options);
    expect(defect.report.exitCode, JSON.stringify(defect.report)).toBe(1);
    expect(defect.report.checks).toMatchObject([
        { status: 'failed', findings: [{ file: 'broken script.sh', line: 1, column: 1, fixable: false }] },
    ]);
    await Bun.write(join(sandbox.path, 'broken script.sh'), 'echo example\n');
    const correction = await executeRun(await openSession(sandbox.path), options);
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    expect(correction.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
