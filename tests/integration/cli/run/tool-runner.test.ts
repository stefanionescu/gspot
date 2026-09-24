import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { run } from '#cli/platform/spawn.ts';
import { executeRun } from '#cli/run/execute.ts';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import { fileBatches } from '#cli/run/file-batches.ts';
import { prepareCommand, runToolCheck } from '#cli/run/tool-runner.ts';

describe('file batches', () => {
    test('a list that fits is one batch, and a long list splits under the budget in order', () => {
        expect(fileBatches(['a.sh', 'b.sh'], ['tool'], 'linux')).toEqual([['a.sh', 'b.sh']]);
        const files = Array.from({ length: 5000 }, (_, index) => `scripts/deploy/step-${String(index)}.sh`);
        const batches = fileBatches(files, ['tool'], 'linux');
        expect(batches.length).toBeGreaterThan(1);
        expect(batches.flat()).toEqual(files);
        for (const batch of batches) expect(batch.join(' ').length).toBeLessThanOrEqual(100_000);
    });
});

test('Windows batches reserve quoted paths and the resolved executable', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `docs/café folder (draft)/page-${String(index)}.md`);
    const fixed = [
        'C:/workspace with spaces/node_modules/.bin/markdownlint.cmd',
        '--config',
        'C:/workspace with spaces/.gspot/markdown.json',
    ];
    const batches = fileBatches(files, fixed, 'win32');
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(files);
    for (const batch of batches) {
        const command = [...fixed, ...batch].map((argument) => `"${argument}"`).join(' ');
        expect(command.length).toBeLessThan(8191);
    }
});

test('Unix batches count Unicode bytes and reject an argument that cannot fit', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `資料/結果-${String(index)}.txt`);
    const batches = fileBatches(files, ['tool'], 'linux');
    expect(batches.flat()).toEqual(files);
    for (const batch of batches) expect(Buffer.byteLength(['tool', ...batch].join(' '))).toBeLessThan(100_000);
    expect(() => fileBatches(['x'.repeat(100_001)], ['tool'], 'linux')).toThrow('file argument exceeds');
    expect(() => fileBatches([], ['x'.repeat(100_001)], 'linux')).toThrow('Tool arguments exceed');
});

test('Batched tool invocations preserve spaced Unicode file arguments', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'echo.cjs': 'process.stdout.write(JSON.stringify(process.argv.slice(2)));',
        'node_modules/.bin/echo.cmd': '@echo off\r\nnode "%~dp0..\\..\\echo.cjs" %*\r\n',
    });
    const fixed =
        process.platform === 'win32'
            ? [join(sandbox.path, 'node_modules/.bin/echo.cmd')]
            : [process.execPath, join(sandbox.path, 'echo.cjs')];
    const files = Array.from({ length: 300 }, (_, index) => `docs/café (draft & review)/page-${String(index)}.md`);
    const batches = fileBatches(files, fixed, 'win32');
    const received: string[] = [];
    for (const batch of batches) {
        const result = await run([...fixed, ...batch], { cwd: sandbox.path });
        expect(result.code).toBe(0);
        expect(result.stdout).toBe(JSON.stringify(batch));
        received.push(...batch);
    }
    expect(received).toEqual(files);
});

test('per-file execution preserves expanded flags and arguments after the file', async () => {
    const policy = `version = 1
configurations = []
[[check]]
name = "sandbox/arguments"
command = ${JSON.stringify([process.execPath, 'echo.cjs', '{existing:--config:settings.txt}', '{file}', 'config', '--quiet'])}
paths = ["inputs/**"]
stage = "commit"
`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'settings.txt': '',
        'inputs/café source.txt': '',
        'echo.cjs': 'process.stdout.write(JSON.stringify([process.env.TOOL_RELEASE, ...process.argv.slice(2)]));',
    });
    const session = await openSession(sandbox.path);
    const planned = (await planRun(session, { stage: 'all', skips: [] }))[0]!;
    planned.tool = { name: 'echo', windows: true, installers: {}, env: { TOOL_RELEASE: 'v3.4.0' } };
    const prepared = prepareCommand(session, planned, planned.spec.command!);
    const result = await run(prepared.commands[0]!.argv, { cwd: prepared.cwd, env: prepared.env });
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
        'v3.4.0',
        '--config',
        join(sandbox.path, 'settings.txt'),
        'inputs/café source.txt',
        'config',
        '--quiet',
    ]);
});

test('a repository command receives a declared empty argument without changing its position', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: [],
            check: [
                {
                    name: 'project/arguments',
                    command: [
                        process.execPath,
                        '-e',
                        'process.exitCode = process.argv.at(-1) === "" ? 0 : 1',
                        '--',
                        '',
                    ],
                    paths: ['source.txt'],
                    stage: 'commit',
                },
            ],
        }),
        'source.txt': 'source input',
    });
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: [],
        fix: false,
        isDryRun: true,
        noCache: true,
    });
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'project/arguments', status: 'ok' }]);
});

test.each(['outdated', 'timeout', 'canceled'] as const)(
    'Ansible adapter reports %s through the shared runner and accepts corrected execution',
    async (failure) => {
        await using sandbox = await testdir();
        const executable = join(sandbox.path, '.gspot/.venv/bin/ansible-lint');
        const version = failure === 'outdated' ? '23.0.0' : '26.8.0';
        const script = (version: string, slow: boolean): string => `#!${process.execPath}
if (process.argv.includes('--version')) { console.log(${JSON.stringify(version)}); }
else { await Bun.write('started.txt', 'started'); ${slow ? 'await Bun.sleep(10_000);' : ''} }
`;
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["ansible", "structure"]\n[limits]\ntool_seconds = 1\n',
            'deploy/ansible.cfg': '[defaults]\n',
            'deploy/site.yml': '---\n- hosts: all\n  tasks: []\n',
            '.gspot/.venv/bin/ansible-lint': script(version, failure !== 'outdated'),
        });
        chmodSync(executable, 0o755);
        const controller = new AbortController();
        const session = await openSession(sandbox.path);
        const options = {
            stage: 'all' as const,
            skips: [],
            only: ['ansible/lint'],
            fix: false,
            isDryRun: false,
            noCache: true,
        };
        const running = executeRun(session, { ...options, cancelSignal: controller.signal });
        try {
            if (failure === 'canceled') {
                const deadline = performance.now() + 5_000;
                while (!existsSync(join(sandbox.path, 'deploy/started.txt')) && performance.now() < deadline)
                    await Bun.sleep(20);
                expect(existsSync(join(sandbox.path, 'deploy/started.txt'))).toBe(true);
                controller.abort();
            }
            const outcome = await running;
            expect(outcome.report.exitCode).toBe(2);
            expect(outcome.report.checks).toHaveLength(1);
            expect(outcome.report.checks[0]!.status).toBe(failure === 'outdated' ? 'missing' : 'error');
            expect(outcome.report.checks[0]!.note).toContain(
                failure === 'outdated' ? 'is below 24.0.0' : failure === 'timeout' ? 'ran past 1 seconds' : 'canceled',
            );
            expect(outcome.report.checks[0]!.findings).toEqual([]);
            expect(existsSync(join(sandbox.path, 'deploy/started.txt'))).toBe(failure !== 'outdated');
            writeFileSync(executable, script('26.8.0', false));
            const corrected = await executeRun(await openSession(sandbox.path), options);
            expect(corrected.report.exitCode).toBe(0);
            expect(corrected.report.checks[0]!.status).toBe('ok');
        } finally {
            controller.abort();
            await running;
        }
    },
);

test('an adapter observes a changed executable version on the next command instead of reusing its old success', async () => {
    await using sandbox = await testdir();
    const command = (version: string): string =>
        `#!${process.execPath}\nif (process.argv.includes('--version')) console.log(${JSON.stringify(version)});\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["ansible"]\n',
        '.gitignore': '.gspot/\n.venv/\n',
        'ansible.cfg': '[defaults]\n',
        'site.yml': '---\n- hosts: all\n  tasks: []\n',
        '.gspot/.venv/bin/ansible-lint': command('26.8.0'),
    });
    const executable = join(sandbox.path, '.gspot/.venv/bin/ansible-lint');
    chmodSync(executable, 0o755);
    const options = { stage: 'commit' as const, skips: [], only: ['ansible/lint'], fix: false, isDryRun: false };
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.checks[0]!.status).toBe('ok');
    writeFileSync(executable, command('23.0.0'));
    const changed = await executeRun(await openSession(sandbox.path), options);
    expect(changed.report.exitCode).toBe(2);
    expect(changed.report.checks[0]!.status).toBe('missing');
    expect(changed.report.checks[0]!.note).toContain('23.0.0 is below 24.0.0');
    writeFileSync(executable, command('26.8.0'));
    expect((await executeRun(await openSession(sandbox.path), options)).report.exitCode).toBe(0);
});

test('cached results observe executable replacement and permissions in a reused session', async () => {
    await using sandbox = await testdir();
    const script = (failed: boolean): string => `#!${process.execPath}\nprocess.exitCode = ${failed ? 1 : 0};\n`;
    const executable = join(sandbox.path, 'checker');
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = []\n[[check]]\nname = "project/cache"\nstage = "commit"\npaths = ["source.txt"]\ninputs = ["source.txt"]\ncommand = ${JSON.stringify([executable])}\n`,
        'source.txt': 'input\n',
        checker: script(false),
    });
    chmodSync(executable, 0o755);
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false };
    expect((await executeRun(session, options)).report.exitCode).toBe(0);
    expect((await executeRun(session, options)).report.checks[0]!.status).toBe('cache');
    writeFileSync(executable, script(true));
    const changed = await executeRun(session, options);
    expect(changed.report.exitCode).toBe(1);
    expect(changed.report.checks[0]!.status).toBe('fail');
    chmodSync(executable, 0o644);
    expect((await executeRun(session, options)).report.exitCode).toBe(2);
    chmodSync(executable, 0o755);
    writeFileSync(executable, script(false));
    expect((await executeRun(session, options)).report.exitCode).toBe(0);
});

test('per-file failures name the selected file when expanded arguments follow it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: [],
            check: [
                {
                    name: 'project/file-result',
                    command: [
                        process.execPath,
                        'validate.cjs',
                        '{existing:--config:settings.txt}',
                        '{file}',
                        'config',
                        '--quiet',
                    ],
                    paths: ['inputs/**'],
                    stage: 'commit',
                },
            ],
        }),
        'settings.txt': '',
        'inputs/café source.txt': 'invalid',
        'validate.cjs':
            'const fs = require("node:fs"); process.exitCode = fs.readFileSync(process.argv[4], "utf8") === "valid" ? 0 : 1;',
    });
    const session = await openSession(sandbox.path);
    const planned = (await planRun(session, { stage: 'all', skips: [] }))[0]!;
    planned.tool = { name: process.execPath, installers: {}, windows: true };
    const failed = await runToolCheck(session, planned);
    expect(failed.status).toBe('fail');
    expect(failed.findings.map((finding) => finding.file)).toEqual(['inputs/café source.txt']);
    writeFileSync(join(sandbox.path, 'inputs/café source.txt'), 'valid');
    const corrected = await runToolCheck(session, planned);
    expect(corrected.status).toBe('ok');
    expect(corrected.findings).toEqual([]);
});

test('a signaled per-file process is an execution error rather than a source finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: [],
            check: [
                {
                    name: 'project/termination',
                    command: [process.execPath, '-e', 'process.kill(process.pid, "SIGTERM")', '{file}'],
                    paths: ['source.txt'],
                    stage: 'commit',
                },
            ],
        }),
        'source.txt': 'valid source',
    });
    const session = await openSession(sandbox.path);
    const planned = (await planRun(session, { stage: 'all', skips: [] }))[0]!;
    planned.tool = { name: process.execPath, installers: {}, windows: true };
    const failed = await runToolCheck(session, planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toEqual([]);
    planned.spec.command![2] = 'process.exitCode = 0';
    expect((await runToolCheck(session, planned)).status).toBe('ok');
});
