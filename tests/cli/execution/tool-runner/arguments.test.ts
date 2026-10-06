import executables from 'which';
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { stringify } from 'smol-toml';
import { run } from '#cli/platform/spawn.ts';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { prepareCommand, runCommandCheck, commandEnvironment } from '#cli/execution/command/runner.ts';

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
    expect(batches.length).toBeGreaterThan(1);
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
    const policy = `configurations = []
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
    const plans = planRun(session, { stage: 'all', skips: [], only: ['sandbox/arguments'] });
    const planned = plans[0]!;
    planned.tool = { name: 'echo', installers: {}, kind: 'binary', env: { TOOL_RELEASE: 'v3.4.0' } };
    const prepared = prepareCommand(session, planned, planned.spec.command!, commandEnvironment(session, planned));
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
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ isDryRun: true, only: ['project/arguments'] }),
    );
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'project/arguments', status: 'passed' }]);
});

test('per-file failures name the selected file when expanded arguments follow it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
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
    const plans = planRun(session, { stage: 'all', skips: [], only: ['project/file-result'] });
    const planned = plans[0]!;
    planned.tool = { name: process.execPath, installers: {}, kind: 'binary' };
    const failed = await runCommandCheck(session, planned);
    expect(failed.status).toBe('failed');
    expect(failed.findings.map((finding) => finding.file)).toStrictEqual(['inputs/café source.txt']);
});

// Windows has no signals: a process that kills itself exits with a code.
test.skipIf(!isPosix)('a signaled per-file process is an execution error rather than a source finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
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
    const plans = planRun(session, { stage: 'all', skips: [], only: ['project/termination'] });
    const planned = plans[0]!;
    planned.tool = { name: process.execPath, installers: {}, kind: 'binary' };
    const failed = await runCommandCheck(session, planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toStrictEqual([]);
});

test.skipIf(!isPosix)(
    'a copied command uses its declared companion executable instead of an inactive shim',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: [],
                check: [
                    {
                        name: 'project/companion',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: [
                            process.execPath,
                            '-e',
                            "const result = Bun.spawnSync(['shellcheck', '--version']); process.stdout.write(result.stdout); process.exitCode = result.exitCode;",
                        ],
                    },
                ],
            }),
            'source.txt': '',
            'copy/.keep': '',
            'native/shellcheck': `#!${process.execPath}\nconsole.log('ShellCheck version: 0.11.0');\n`,
            'inactive/shellcheck': `#!${process.execPath}\nprocess.exit(7);\n`,
        });
        for (const path of ['native/shellcheck', 'inactive/shellcheck']) chmodSync(join(sandbox.path, path), 0o755);
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'commit', skips: [], only: ['project/companion'] })[0]!;
        planned.spec.other_tools = ['shellcheck'];
        planned.spec.env = { PATH: join(sandbox.path, 'inactive') };
        const which = spyOn(executables, 'sync').mockReturnValue(join(sandbox.path, 'native/shellcheck'));
        try {
            const result = await runCommandCheck(session, planned, { workspace: join(sandbox.path, 'copy') });
            expect(result.status, result.note).toBe('passed');
            expect(result.findings).toStrictEqual([]);
        } finally {
            which.mockRestore();
        }
    },
);
