import * as os from 'node:os';
import { stringify } from 'smol-toml';
import { dirname, join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { executeRun } from '#cli/run/execute.ts';
import { explain } from '#cli/output/explain.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, spyOn, test } from 'bun:test';
import { prepareCommand, runToolCheck } from '#cli/run/tool-runner.ts';
import { applyFixers, runFixer, scratchCopy } from '#cli/run/fixers.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import type { Session, PlannedCheck, RunOptions } from '#cli/types/execution.ts';

import {
    copyFileSync,
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';

const policy = `version = 1
configurations = []
[[check]]
name = "sandbox/correction"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix_order = "codemod"
fix_command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 3'])}
paths = ["source.txt"]
stage = "commit"
`;

test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'SQLFluff write failures remain execution errors when its exit code also means findings',
    async () => {
        await using sandbox = await testdir();
        const spec = configurationManifests()
            .get('sql')!
            .checks.find((check) => check.name === 'sql/sqlfluff')!;
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
                        tool_errors: spec.tool_errors!,
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
                { status: 'failed', changed: [], note: expect.stringContaining('PermissionError') },
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
        for (const output of emitAll(session).files.filter((file) => file.kind === 'config'))
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
        expect(passed.report.exitCode).toBe(0);
    },
);

test.each([false, true].flatMap((preview) => [false, true].map((isolated) => ({ preview, isolated }))))(
    'corrections reject a replaced external source before execution (preview $preview, isolated $isolated)',
    async ({ preview, isolated }) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        await createFileTree(external.path, { 'source.txt': 'external original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(session, "await Bun.write('source.txt', 'changed')");
        planned.spec.isolated_files = isolated;
        rmSync(join(sandbox.path, 'source.txt'));
        symlinkSync(join(external.path, 'source.txt'), join(sandbox.path, 'source.txt'));
        await expect(applyFixers(session, [planned], preview)).rejects.toThrow('Source link leaves the repository');
        expect(readFileSync(join(external.path, 'source.txt'), 'utf8')).toBe('external original');
        rmSync(join(sandbox.path, 'source.txt'));
        writeFileSync(join(sandbox.path, 'source.txt'), 'original');
        const corrected = await applyFixers(session, [planned], preview);
        expect(corrected.changed).toStrictEqual(['source.txt']);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'changed');
    },
);

async function correction(session: Session, script: string): Promise<PlannedCheck> {
    const [planned] = await planRun(session, { stage: 'all', skips: [] });
    if (planned === undefined) throw new Error('The sandbox has no planned correction.');
    return { ...planned, spec: { ...planned.spec, fix_command: [process.execPath, '-e', script] } };
}

describe('correction outcomes', () => {
    test.each([false, true])(
        'isolated corrections publish selected bytes and remove their workspace (preview %s)',
        async (preview) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': policy,
                'source.txt': 'original',
                'unowned.json': '{}',
            });
            const session = await openSession(sandbox.path);
            const trace = join(sandbox.path, 'workspace-path');
            const planned = await correction(
                session,
                `
            if (require('node:fs').existsSync('unowned.json')) throw new Error('Unowned configuration was copied.');
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write('source.txt', 'corrected');
            process.exitCode = 3;
        `,
            );
            planned.spec.isolated_files = true;
            planned.spec.fix_findings_exit_codes = [3];
            const result = await applyFixers(session, [planned], preview);
            expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
            expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'corrected');
            expect(readFileSync(join(sandbox.path, 'unowned.json'), 'utf8')).toBe('{}');
            expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
            if (preview) expect(result.diffs[0]).toContain('+corrected');
        },
    );

    test('isolated correction refuses to overwrite source changed during execution and cleans up', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const trace = join(sandbox.path, 'workspace-path');
        const planned = await correction(
            session,
            `
            await Bun.write(${JSON.stringify(trace)}, process.cwd());
            await Bun.write(${JSON.stringify(join(sandbox.path, 'source.txt'))}, 'new working content');
            await Bun.write('source.txt', 'isolated correction');
        `,
        );
        planned.spec.isolated_files = true;
        await expect(runFixer(session, planned, sandbox.path)).rejects.toThrow(
            'changed while its correction was running',
        );
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('new working content');
        expect(existsSync(readFileSync(trace, 'utf8'))).toBe(false);
        const corrected = await correction(session, "await Bun.write('source.txt', 'corrected')");
        corrected.spec.isolated_files = true;
        expect(await runFixer(session, corrected, sandbox.path)).toMatchObject({
            status: 'changed',
            changed: ['source.txt'],
        });
    });

    test.each([0, 3])('a declared fatal diagnostic overrides correction exit %s', async (code) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(
            session,
            `console.error('Fatal: cannot write'); process.exitCode = ${String(code)}`,
        );
        planned.spec.fix_findings_exit_codes = [3];
        planned.spec.tool_errors = '^Fatal:';
        const failed = await runFixer(session, planned, sandbox.path);
        expect(failed).toMatchObject({
            status: 'failed',
            changed: [],
            note: expect.stringContaining('Fatal: cannot write'),
        });
        const corrected = await correction(session, "await Bun.write('source.txt', 'corrected')");
        corrected.spec.tool_errors = planned.spec.tool_errors;
        expect(await runFixer(session, corrected, sandbox.path)).toMatchObject({
            status: 'changed',
            changed: ['source.txt'],
        });
    });

    test.each([
        { code: 3, content: 'original', status: 'unchanged' },
        { code: 3, content: 'corrected', status: 'changed' },
        { code: 4, content: 'partial', status: 'failed' },
    ])('declared finding exit $code retains the $status correction outcome', async ({ code, content, status }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(
            session,
            `await Bun.write('source.txt', ${JSON.stringify(content)}); process.exitCode = ${String(code)}`,
        );
        planned.spec.fix_findings_exit_codes = [3];
        const result = await runFixer(session, planned, sandbox.path);
        expect(result.status).toBe(status);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(content);
        expect(result.changed).toStrictEqual(content === 'original' ? [] : ['source.txt']);
    });
    test.each([
        { script: 'process.exitCode = 0', status: 'unchanged', after: 'original' },
        { script: "await Bun.write('source.txt', 'corrected')", status: 'changed', after: 'corrected' },
        { script: 'process.exitCode = 3', status: 'failed', after: 'original' },
        {
            script: "await Bun.write('source.txt', 'partial'); process.exitCode = 3",
            status: 'failed',
            after: 'partial',
        },
    ])('classifies $status from execution and resulting bytes', async ({ script, status, after }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const result = await runFixer(session, await correction(session, script), sandbox.path);
        expect(result.status).toBe(status);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe(after);
        expect(result.changed).toStrictEqual(after === 'original' ? [] : ['source.txt']);
        if (result.status === 'failed') expect(result.note).toContain('exited 3');
    });

    test('compares bytes that decode to the same replacement character', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        writeFileSync(join(sandbox.path, 'source.txt'), Buffer.from([0xff]));
        const planned = await correction(session, "await Bun.write('source.txt', new Uint8Array([0xfe]))");
        const result = await runFixer(session, planned, sandbox.path);
        expect(result.status).toBe('changed');
        expect(result.changed).toStrictEqual(['source.txt']);
        expect(readFileSync(join(sandbox.path, 'source.txt'))).toStrictEqual(Buffer.from([0xfe]));
    });

    test('counts deletion of an empty file as a change', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': '' });
        const session = await openSession(sandbox.path);
        const planned = await correction(session, "require('node:fs').unlinkSync('source.txt')");
        const result = await runFixer(session, planned, sandbox.path);
        expect(result.status).toBe('changed');
        expect(result.changed).toStrictEqual(['source.txt']);
        expect(existsSync(join(sandbox.path, 'source.txt'))).toBe(false);
    });

    test('distinguishes a skipped correction from an unavailable tool', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(session, "await Bun.write('source.txt', 'wrong')");
        const skipped = await runFixer(
            session,
            { ...planned, skip: { source: 'flag', note: 'Not selected.' } },
            sandbox.path,
        );
        const failed = await runFixer(
            session,
            { ...planned, spec: { ...planned.spec, fix_command: [join(sandbox.path, 'absent-tool')] } },
            sandbox.path,
        );
        expect(skipped.status).toBe('skipped');
        expect(failed.status).toBe('failed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    });

    test('runs the correction executable when it differs from the check executable', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(session, "await Bun.write('source.txt', 'corrected')");
        const result = await runFixer(
            session,
            { ...planned, tool: { name: join(sandbox.path, 'absent-check-tool'), installers: {}, windows: true } },
            sandbox.path,
        );
        expect(result.status).toBe('changed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    });

    test('fails the run when a correction exits nonzero even though its check passes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const outcome = await executeRun(session, {
            stage: 'all',
            skips: [],
            fix: true,
            isDryRun: false,
            noCache: true,
        });
        expect(outcome.report.checks[0]?.status).toBe('ok');
        expect(outcome.report.exitCode).toBe(2);
        expect(outcome.report.failed).toContain('sandbox/correction');
        expect(outcome.fixes?.results[0]?.status).toBe('failed');
    });

    test('removes the scratch directory after a failed correction and preserves source bytes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(
            session,
            "await Bun.write('source.txt', 'partial'); process.stdout.write(process.cwd()); process.exitCode = 3",
        );
        const report = await applyFixers(session, [planned], true);
        const result = report.results[0];
        expect(result?.status).toBe('failed');
        if (result?.status !== 'failed') throw new Error('The correction did not report its failure.');
        const scratch = result.note.slice(result.note.indexOf(': ') + 2);
        expect(scratch).toContain('gspot-fix-');
        expect(existsSync(scratch)).toBe(false);
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
        expect(report.changed).toStrictEqual(['source.txt']);
        expect(report.diffs.join('\n')).toContain('+partial');
    });

    test('splits 20,000 correction paths without losing or reordering arguments', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
        const session = await openSession(sandbox.path);
        const planned = await correction(session, 'process.exitCode = 0');
        const source = planned.files[0];
        if (source === undefined) throw new Error('The sandbox has no selected source.');
        const paths = Array.from({ length: 20_000 }, (_, index) => `long folder/café/${String(index)}/source.txt`);
        const files = paths.map((path) => ({ ...source, path }));
        const prepared = prepareCommand(session, { ...planned, files }, ['tool', '{files}'], process.execPath);
        expect(prepared.commands.length).toBeGreaterThan(1);
        expect(prepared.commands.flatMap((command) => command.argv.slice(1))).toStrictEqual(paths);
        for (const command of prepared.commands)
            expect(Buffer.byteLength(command.argv.join(' '))).toBeLessThan(100_000);
    });
});

test.each(['copy', 'read'])('cleans the scratch directory after a failed %s', async (operation) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(
        session,
        "const fs = require('node:fs'); fs.unlinkSync('source.txt'); fs.mkdirSync('source.txt');",
    );
    if (operation === 'copy') {
        rmSync(join(sandbox.path, 'source.txt'));
        mkdirSync(join(sandbox.path, 'source.txt'));
    }
    const temporary = join(sandbox.path, 'scratch');
    mkdirSync(temporary);
    const temporaryDirectory = spyOn(os, 'tmpdir').mockReturnValue(temporary);
    try {
        let failure: unknown;
        try {
            await applyFixers(session, [planned], true);
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        expect(readdirSync(temporary)).toStrictEqual([]);
    } finally {
        temporaryDirectory.mockRestore();
    }
    if (operation === 'read') expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('Correction environment paths expand against the execution root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'source.txt': 'original',
        'café settings.txt': 'corrected',
    });
    const session = await openSession(sandbox.path);
    const planned = await correction(
        session,
        "await Bun.write('source.txt', await Bun.file(process.env['SANDBOX_SETTINGS']).text())",
    );
    planned.spec.env = { SANDBOX_SETTINGS: '{root}/café settings.txt' };
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('a failed version probe blocks a check and its correction without changing source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await correction(session, "await Bun.write('source.txt', 'changed')");
    planned.tool = {
        name: 'version-teller',
        version: '3.8.1',
        windows: true,
        installers: {},
        version_command: ['-e', 'console.log("3.8.1"); process.exitCode = 7;'],
    };
    planned.spec.fix_command![0] = 'version-teller';
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const checked = await runToolCheck(session, planned);
        expect(checked.status).toBe('error');
        expect(checked.note).toContain('exited 7');
        const fixed = await runFixer(session, planned, sandbox.path);
        expect(fixed.status).toBe('failed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    } finally {
        which.mockRestore();
    }
});

test('preview copies workspace dependencies and preserves executable links without writing through either', async () => {
    await using repository = await testdir();
    await using external = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/bin/tool.js': 'console.log(require("../lib/value.cjs"));',
        'node_modules/tool/lib/value.cjs': 'module.exports = "tool works";',
    });
    await createFileTree(external.path, { 'value.js': 'external original' });
    mkdirSync(join(repository.path, 'node_modules/.bin'));
    symlinkSync('../tool/bin/tool.js', join(repository.path, 'node_modules/.bin/tool'));
    symlinkSync('../packages/core', join(repository.path, 'node_modules/core'));
    symlinkSync(external.path, join(repository.path, 'node_modules/external'));
    const session = await openSession(repository.path);
    const scratch = scratchCopy(
        session.root,
        ['packages/core/value.js'],
        session.repository.scopes.map((scope) => scope.path),
    );
    try {
        const result = Bun.spawnSync(['node', 'node_modules/.bin/tool'], {
            cwd: scratch,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(result.stdout.toString().trim()).toBe('tool works');
        writeFileSync(join(scratch, 'node_modules/core/value.js'), 'preview edit');
        writeFileSync(join(scratch, 'node_modules/external/value.js'), 'external preview edit');
        expect(readFileSync(join(repository.path, 'packages/core/value.js'), 'utf8')).toBe(
            'export default "original";',
        );
        expect(readFileSync(join(external.path, 'value.js'), 'utf8')).toBe('external original');
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

test.each(['canceled', 'timeout'].flatMap((failure) => [false, true].map((isolated) => ({ failure, isolated }))))(
    'a $failure correction retains partial changes and reports the process failure (isolated $isolated)',
    async ({ failure, isolated }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `${policy}\n[limits]\ntool_seconds = 1\n`,
            'source.txt': 'original',
        });
        const session = await openSession(sandbox.path);
        const controller = new AbortController();
        const planned = await correction(session, "await Bun.write('source.txt', 'partial'); await Bun.sleep(10000);");
        planned.spec.isolated_files = isolated;
        const timer =
            failure === 'canceled'
                ? setTimeout(() => {
                      controller.abort();
                  }, 500)
                : undefined;
        try {
            const result = await runFixer({ ...session, cancelSignal: controller.signal }, planned, sandbox.path);
            expect(result.status).toBe('failed');
            if (result.status !== 'failed') throw new Error('The correction did not report its process failure.');
            expect(result.note).toContain(failure === 'canceled' ? 'was canceled' : 'ran past 1 seconds');
            expect(result.changed).toStrictEqual(['source.txt']);
            expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            clearTimeout(timer);
        }
        const corrected = await runFixer(
            session,
            await correction(session, "await Bun.write('source.txt', 'corrected')"),
            sandbox.path,
        );
        expect(corrected.status).toBe('changed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    },
);

test('checks refresh the file inventory after a fixer creates a source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'input',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/inventory"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = process.argv.includes("added.txt") ? 0 : 1', '{files}'])}
fix_command = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("added.txt", "created")'])}
fix_order = "codemod"
`,
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], fix: true, isDryRun: false, noCache: true };
    const outcome = await executeRun(session, options);
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]!.files).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toContain('added.txt');
});
