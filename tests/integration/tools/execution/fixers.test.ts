import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import type { RunOptions } from '#cli/execution/execute.ts';
import { explain } from '#cli/commands/explain/subjects.ts';
import { textContaining } from '#tests/support/expectations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

if (!(process.platform === 'win32' || process.getuid?.() === 0))
    test('SQLFluff write failures remain execution errors when its exit code also means findings', async () => {
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
                version: 1,
                configurations: [],
                check: [
                    {
                        name: 'project/native',
                        command: [executable, 'lint', ...args, '--format', 'json', '{files}'],
                        fix_command: [executable, 'fix', ...args, '{files}'],
                        fix_order: spec.fix_order!,
                        fix_findings_exit_codes: spec.fix_findings_exit_codes!,
                        tool_errors: crashPattern,
                        output: spec.output!,
                        paths: ['source/*.sql'],
                        stage: 'commit',
                    },
                ],
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });
        const options: RunOptions = { stage: 'all', skips: [], fix: true, isDryRun: false, noCache: true };
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
        expect((await executeRun(await openSession(sandbox.path), options)).report.exitCode).toBe(0);
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
    const spec = configurationManifests()
        .get(entry.configuration)!
        .checks.find((check) => check.name === entry.check)!;
    const executable = Bun.which(entry.command[0]);
    if (executable === null) throw new Error(`The native fixer test requires ${entry.command[0]}.`);
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: [],
            check: [
                {
                    name: 'project/native',
                    command: [executable, ...entry.command.slice(1)],
                    fix_command: [executable, ...entry.fix.slice(1)],
                    fix_order: spec.fix_order!,
                    fix_findings_exit_codes: spec.fix_findings_exit_codes!,
                    output: spec.output!,
                    paths: [entry.path],
                    stage: 'commit',
                },
            ],
        }),
        [entry.config]: entry.toolConfiguration,
        [entry.path]: entry.defect,
    });
    const options: RunOptions = { stage: 'all', skips: [], fix: true, isDryRun: false, noCache: true };
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode, JSON.stringify({ report: failed.report, fixes: failed.fixes })).toBe(1);
    expect(failed.fixes?.results).toMatchObject([{ status: 'changed', changed: [entry.path] }]);
    expect(readFileSync(join(sandbox.path, entry.path), 'utf8')).toBe(entry.partial);
    await Bun.write(join(sandbox.path, entry.path), entry.corrected);
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
});

test.each(['javascript', 'typescript', 'svelte', 'vue', 'css'])(
    '%s correction status agrees with native residual diagnostics',
    async (configuration) => {
        await using sandbox = await testdir();
        const isCss = configuration === 'css';
        const tool = isCss ? 'stylelint' : 'eslint';
        const spec = configurationManifests()
            .get(configuration)!
            .checks.find((check) => check.name === `${configuration}/${tool}`)!;
        const executable = join(
            dirname(Bun.resolveSync(`${tool}/package.json`, import.meta.dir)),
            'bin',
            isCss ? 'stylelint.mjs' : 'eslint.js',
        );
        const path = isCss ? 'sample.css' : 'sample.js';
        const config = isCss ? 'native.json' : 'native.mjs';
        const command = [process.execPath, executable, '--config', config];
        const nativeConfiguration = isCss
            ? JSON.stringify({ rules: { 'color-hex-length': 'short', 'property-no-unknown': true } })
            : 'export default [{ rules: { semi: ["error", "always"], "no-undef": "error" } }];';
        const partial = isCss ? 'a { color: #fff; unknown: 1; }\n' : 'missing();\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                version: 1,
                configurations: [],
                check: [
                    {
                        name: 'project/native',
                        command: [...command, isCss ? '--formatter' : '--format', isCss ? 'unix' : 'json', '{files}'],
                        fix_command: [...command, '--fix', '{files}'],
                        fix_order: spec.fix_order!,
                        fix_findings_exit_codes: spec.fix_findings_exit_codes!,
                        findings_exit_codes: spec.findings_exit_codes!,
                        output: spec.output!,
                        paths: [path],
                        stage: 'commit',
                    },
                ],
            }),
            [config]: nativeConfiguration,
            [path]: isCss ? 'a { color: #ffffff; unknown: 1; }\n' : 'missing()\n',
        });
        const source = readFileSync(join(sandbox.path, path), 'utf8');
        writeFileSync(join(sandbox.path, config), isCss ? '{' : 'throw new Error("Invalid native configuration");');
        const invalid = await executeRun(await openSession(sandbox.path), {
            stage: 'all',
            skips: [],
            fix: false,
            isDryRun: false,
            noCache: true,
        });
        expect(invalid.report.exitCode).toBe(2);
        expect(invalid.report.checks).toMatchObject([{ status: 'error', findings: [] }]);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(source);
        writeFileSync(join(sandbox.path, config), nativeConfiguration);
        const session = await openSession(sandbox.path);
        const explanation = explain(session, 'project/native');
        expect(explanation).toMatchObject({ data: { fix_findings_exit_codes: [isCss ? 2 : 1] } });
        const options: RunOptions = { stage: 'all', skips: [], fix: true, isDryRun: false, noCache: true };
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ status: 'changed', changed: [path] }]);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(partial);
        await Bun.write(join(sandbox.path, path), isCss ? 'a { color: #fff; }\n' : 'export {};\n');
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode, JSON.stringify(corrected)).toBe(0);
    },
);

test.each([
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: 'sample.txt',
        defect: 'teh wether\n',
        partial: 'the wether\n',
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
            'gspot.toml': `version = 1\nconfigurations = ["${configuration}"]\n`,
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
        for (const output of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }).files.filter((file) => file.kind === 'config'))
            await Bun.write(join(sandbox.path, output.path), output.content);
        const options = { stage: 'all', skips: [], only: [check], fix: true, isDryRun: false, noCache: true } as const;
        const failed = await executeRun(session, { ...options, skips: [], only: [check] });
        expect(failed.report.exitCode, JSON.stringify({ report: failed.report, fixes: failed.fixes })).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ check, status: 'changed', changed: [path] }]);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(partial);
        const repeated = await executeRun(await openSession(sandbox.path), { ...options, skips: [], only: [check] });
        expect(repeated.report.exitCode).toBe(1);
        expect(repeated.fixes?.results).toMatchObject([{ check, status: 'unchanged', changed: [] }]);
        await Bun.write(join(sandbox.path, path), corrected);
        const passed = await executeRun(await openSession(sandbox.path), { ...options, skips: [], only: [check] });
        expect(passed.report.exitCode, JSON.stringify(passed.report)).toBe(0);
    },
);
