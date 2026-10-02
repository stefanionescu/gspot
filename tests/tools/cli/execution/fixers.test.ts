import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/harness/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { kitManifests } from '#cli/kits/manifests.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import { writeConfigs } from '#tests/harness/cli/generated.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import type { RunOptions } from '#cli/types/execution/execution.ts';
import { chmodSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';

if (!(process.platform === 'win32' || process.getuid?.() === 0))
    test('SQLFluff write failures remain execution errors when its exit code also means findings', async () => {
        await using sandbox = await testdir();
        const sql = kitManifests().get('sql')!;
        const spec = sql.checks.find((check) => check.name === 'sql/sqlfluff')!;
        // A repository command declares the crash pattern itself; the manifest keeps it on the sqlfluff tool.
        const crashPattern = sql.tools.find((tool) => tool.name === 'sqlfluff')!.crash_pattern!;
        const executable = Bun.which('sqlfluff');
        if (executable === null) throw new Error('The native fixer test requires SQLFluff.');
        const args = ['--dialect', 'postgres', '--ignore-local-config', '--disable-progress-bar'];
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                kits: [],
                check: [
                    {
                        name: 'project/native',
                        command: [executable, 'lint', ...args, '--format', 'json', '{files}'],
                        fix_command: [executable, 'fix', ...args, '{files}'],
                        findings_exit_codes: spec.findings_exit_codes!,
                        tool_errors: crashPattern,
                        output: spec.output!,
                        paths: ['source/*.sql'],
                        stage: 'commit',
                    },
                ],
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });
        const options: RunOptions = runOptions({ fix: true });
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
    });

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
    const spec = kitManifests()
        .get(entry.configuration)!
        .checks.find((check) => check.name === entry.check)!;
    const executable = Bun.which(entry.command[0]);
    if (executable === null) throw new Error(`The native fixer test requires ${entry.command[0]}.`);
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            kits: [],
            check: [
                {
                    name: 'project/native',
                    command: [executable, ...entry.command.slice(1)],
                    fix_command: [executable, ...entry.fix.slice(1)],
                    findings_exit_codes: spec.findings_exit_codes!,
                    output: spec.output!,
                    paths: [entry.path],
                    stage: 'commit',
                },
            ],
        }),
        [entry.config]: entry.toolConfiguration,
        [entry.path]: entry.defect,
    });
    const options: RunOptions = runOptions({ fix: true });
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
            'gspot.toml': policyOf([configuration], '', 'all'),
            '.gitignore': '.gspot/\n',
            [path]: defect,
        });
        if (configuration === 'python') {
            const ruff = Bun.which('ruff');
            if (ruff === null) throw new Error('The native fixer test requires the pinned Ruff executable.');
            const bin = join(sandbox.path, '.gspot/.venv', process.platform === 'win32' ? 'Scripts' : 'bin');
            mkdirSync(bin, { recursive: true });
            copyFileSync(ruff, join(bin, process.platform === 'win32' ? 'ruff.exe' : 'ruff'));
        }
        const session = await openSession(sandbox.path);
        await writeConfigs(session, sandbox.path);
        const options = runOptions({ only: [check], fix: true });
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
        'gspot.toml': policyOf(['bash'], '', 'all'),
        'example.sh': source,
    });
    const session = await openSession(sandbox.path);
    await writeConfigs(session, sandbox.path);
    const options = runOptions({ only: ['bash/shfmt'] });
    const defect = await executeRun(session, options);
    expect(defect.report.exitCode, JSON.stringify(defect.report)).toBe(1);
    const correction = await executeRun(await openSession(sandbox.path), { ...options, fix: true });
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'example.sh')).text()).not.toBe(source);
    const verified = await executeRun(await openSession(sandbox.path), options);
    expect(verified.report.exitCode, JSON.stringify(verified.report)).toBe(0);
});
