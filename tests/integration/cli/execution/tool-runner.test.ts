import { resolveCheck } from '#cli/execution/engines.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { fileBatches } from '#cli/execution/file-batches.ts';
import { planRun } from '#cli/execution/plan.ts';
import { openSession } from '#cli/execution/session.ts';
import { prepareCommand, runToolCheck } from '#cli/execution/tool-runner.ts';
import { run } from '#cli/platform/spawn.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

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
    expect(received).toStrictEqual(files);
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
    expect(JSON.parse(result.stdout)).toStrictEqual([
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
                const deadline = performance.now() + 5000;
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
            expect(outcome.report.checks[0]!.findings).toStrictEqual([]);
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
    expect(failed.findings.map((finding) => finding.file)).toStrictEqual(['inputs/café source.txt']);
    writeFileSync(join(sandbox.path, 'inputs/café source.txt'), 'valid');
    const corrected = await runToolCheck(session, planned);
    expect(corrected.status).toBe('ok');
    expect(corrected.findings).toStrictEqual([]);
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
    expect(failed.findings).toStrictEqual([]);
    planned.spec.command![2] = 'process.exitCode = 0';
    expect((await runToolCheck(session, planned)).status).toBe('ok');
});

test.each(['{file}', '{files}'])(
    'declared findings exits distinguish partial reports from fatal %s execution',
    async (placeholder) => {
        await using sandbox = await testdir();
        const source = 'input.txt';
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                version: 1,
                configurations: [],
                check: [
                    {
                        name: 'project/exit-contract',
                        command: [process.execPath, 'checker.cjs', placeholder],
                        paths: [source],
                        stage: 'commit',
                        findings_exit_codes: [1],
                        output: { format: 'regex', pattern: '^(?<file>.+):(?<line>\\d+): (?<message>.+)$' },
                    },
                ],
            }),
            [source]: '1',
            'checker.cjs':
                'const fs = require("node:fs"); const file = process.argv[2]; const status = Number(fs.readFileSync(file, "utf8")); if (status !== 0) console.log(`${file}:1: Located defect before exit`); process.exitCode = status;',
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'all', skips: [] }))[0]!;
        planned.tool = { name: process.execPath, installers: {}, windows: true };
        const finding = await runToolCheck(session, planned);
        expect(finding.status).toBe('fail');
        expect(finding.findings).toStrictEqual([
            expect.objectContaining({ file: source, line: 1, message: 'Located defect before exit' }),
        ]);
        writeFileSync(join(sandbox.path, source), '7');
        const fatal = await runToolCheck(session, planned);
        expect(fatal.status).toBe('error');
        expect(fatal.findings).toStrictEqual([]);
        expect(fatal.note).toContain('exit 7');
        expect(await Bun.file(join(sandbox.path, source)).text()).toBe('7');
        writeFileSync(join(sandbox.path, source), '0');
        const corrected = await runToolCheck(session, planned);
        expect(corrected.status).toBe('ok');
        expect(corrected.findings).toStrictEqual([]);
    },
);

test.each([0, 1, 3])(
    'Actionlint removes its prepared project after adapter exit %i without changing source permissions',
    async (code) => {
        await using sandbox = await testdir();
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = 'on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
            '.github/workflows/caller.yml': workflow,
            actionlint: `#!${process.execPath}\nif (process.argv.includes('--version')) console.log('1.7.12'); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${code} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${code}; }\n`,
        });
        chmodSync(executable, 0o755);
        chmodSync(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await resolveCheck(planned.spec)(session, planned);
        expect(result.status, JSON.stringify(result)).toBe(code === 0 ? 'ok' : code === 1 ? 'fail' : 'error');
        const workspace = await Bun.file(record).text();
        expect(workspace).not.toBe(sandbox.path);
        expect(existsSync(workspace)).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        expect(statSync(join(sandbox.path, '.github/workflows/caller.yml')).mode & 0o777).toBe(0o444);
        expect(existsSync(join(sandbox.path, '.git'))).toBe(false);
        if (code === 3) {
            expect(result.note).toContain('exit 3');
            expect(result.findings).toStrictEqual([]);
        }
    },
);
