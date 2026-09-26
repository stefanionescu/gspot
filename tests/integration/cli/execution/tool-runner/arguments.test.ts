import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { planRun } from '#cli/execution/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { fileBatches } from '#cli/execution/file-batches.ts';
import { prepareCommand, runToolCheck } from '#cli/execution/tool-runner.ts';

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
    const plans = await planRun(session, { stage: 'all', skips: [] });
    const planned = plans[0]!;
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
    const plans = await planRun(session, { stage: 'all', skips: [] });
    const planned = plans[0]!;
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
    const plans = await planRun(session, { stage: 'all', skips: [] });
    const planned = plans[0]!;
    planned.tool = { name: process.execPath, installers: {}, windows: true };
    const failed = await runToolCheck(session, planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toStrictEqual([]);
    planned.spec.command![2] = 'process.exitCode = 0';
    const result = await runToolCheck(session, planned);
    expect(result.status).toBe('ok');
});
