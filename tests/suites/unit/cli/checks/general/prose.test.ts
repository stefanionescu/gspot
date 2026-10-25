import { join, dirname } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { VALE_ALERT, VALE_OUTPUT_CASES, VALE_SANDBOX_FILES } from '#tests/config/checks/general/prose.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';

test('Vale gets the timeout setting, and its alerts become findings with file, line and column', async () => {
    await using sandbox = await testdir();
    const path = 'sample.md';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['prose', 'markdown'], { tables: 'tool_timeout_seconds = 1\n' }),
        [GSPOT_PATHS.valeConfigFile]: 'Packages =\n',
        [path]: '# Example text\n',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    const valeResult = buildProcessResult({ stdout: JSON.stringify({ [join(sandbox.path, path)]: [VALE_ALERT] }) });
    const spawn = spyOn(processes, 'spawnProcess').mockResolvedValue(valeResult);
    const run = resources.use(spawn);
    const result = await runChecks(session, buildRunOptions({ only: ['prose/vale'] }));
    expect(run.mock.calls).toHaveLength(1);
    const [command, options] = run.mock.calls[0]!;
    expect(options.timeoutSeconds).toBe(1);
    expect(options.cwd).toBe(join(sandbox.path, dirname(GSPOT_PATHS.valeConfigFile)));
    const valePath = join(process.cwd(), 'test-tools', 'vale');
    expect(command).toStrictEqual([
        valePath,
        '--config',
        join(sandbox.path, GSPOT_PATHS.valeConfigFile),
        '--output',
        'JSON',
        '--no-exit',
        join(sandbox.path, path),
    ]);
    expect(options.stdin).toBeUndefined();

    expect(result.report.checks).toMatchObject([{ check: 'prose/vale', status: 'failed' }]);
    expect(result.report.checks[0]!.findings).toStrictEqual([
        matchFields({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
    ]);
});

test('prose/vale sends Vale each stdin file as gspot read it at the start of the run, not a later edit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose', 'typescript']),
        [GSPOT_PATHS.valeConfigFile]: 'Packages =\n',
        'first.mts': '// First explanation.\n',
        'second.cts': '// Second explanation.\n',
    });

    const session = await openSession(sandbox.path);
    const paths = ['first.mts', 'second.cts'];
    const previous = paths.map((path) => readCachedBytes(session.reads, path).toString('utf8'));
    for (const path of paths) await writeFile(join(session.root, path), '// Changed after the run read it.\n');

    using resources = new DisposableStack();
    const fakes = fakeToolExecutables([getTool(session.configurations.values(), 'vale')]);
    resources.use(fakes);
    const scanned: string[] = [];
    const nativePaths: string[] = [];
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            nativePaths.push(...command.filter((argument) => argument.startsWith('--path=')));
            scanned.push(options.stdin!);
            return Promise.resolve(buildProcessResult({ stdout: JSON.stringify({ 'source.mts.ts': [VALE_ALERT] }) }));
        }),
    );
    const findings = await findBuiltInCheck('prose/vale')(session, planSandboxCheck(session, 'prose/vale', { paths }));
    expect(run.mock.calls.map(([command]) => command.includes('--ext=.ts'))).toStrictEqual(paths.map(() => true));
    expect(scanned).toStrictEqual(previous);
    expect(nativePaths).toStrictEqual(paths.map((path) => `--path=${join(sandbox.path, path)}.ts`));
    expect(findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual(
        paths.map((file) => ({ file, line: 1, column: 3, rule: 'gspot.Example' })),
    );
    for (const path of paths)
        expect(await readFile(join(session.root, path), 'utf8')).toBe('// Changed after the run read it.\n');
});

test('Vale reads known file types by path, and .mts files and scripts without an extension through stdin', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose', 'typescript', 'bash']),
        [GSPOT_PATHS.valeConfigFile]: 'Packages =\n',
        'a.tsx': '// Component explanation.\n',
        'a.mts': '// Module explanation.\n',
        'hooks/pre-commit': '#!/bin/sh\n# Hook explanation.\n',
        'a.png': 'Image bytes',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: '{}' }));
    expect(await runSandboxCheck(session.root, 'prose/vale')).toStrictEqual([]);
    expect(
        run.mock.calls.map(([command, options]) => ({
            paths: command.filter(
                (argument) => argument === join(sandbox.path, 'a.tsx') || argument.startsWith('--path='),
            ),
            stdin: options.stdin,
        })),
    ).toStrictEqual([
        { paths: [join(sandbox.path, 'a.tsx')], stdin: undefined },
        { paths: [`--path=${join(sandbox.path, 'a.mts.ts')}`], stdin: '// Module explanation.\n' },
        { paths: [`--path=${join(sandbox.path, 'hooks/pre-commit.py')}`], stdin: '#!/bin/sh\n# Hook explanation.\n' },
    ]);
});

test.each([...VALE_OUTPUT_CASES])(
    'Vale alerts with $name become findings at the reported file, line, and column',
    async ({ stdout, findings }) => {
        await using resources = new AsyncDisposableStack();
        const sandbox = resources.use(await testdir(VALE_SANDBOX_FILES));
        const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
        const parsed = Object.fromEntries(
            Object.entries(JSON.parse(stdout) as Record<string, unknown>).map(([path, alerts]) => [
                join(session.root, path),
                alerts,
            ]),
        );
        const absoluteOutput = JSON.stringify(parsed);
        resources.use(
            spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: absoluteOutput })),
        );
        const found = await runSandboxCheck(session.root, 'prose/vale');
        expect(found.map(({ help: _help, ...finding }) => finding)).toStrictEqual([...findings]);
    },
);

test.each(['diagnostic text', '{"file.md":[{}]}'])('the Vale check refuses malformed output %s', async (stdout) => {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await testdir(VALE_SANDBOX_FILES));
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);

    resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout })));
    const runSandboxCheckError = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(runSandboxCheckError.message).toBe('Vale printed output that gspot cannot read.');
});

test('the Vale check fails with the error line Vale prints when Vale exits non-zero', async () => {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await testdir(VALE_SANDBOX_FILES));
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: 2, stderr: 'Loading styles\nE100 [loadStyles] Runtime error\n' }),
        ),
    );
    const runtimeError = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(runtimeError.message).toBe('Vale did not run (exit 2): E100 [loadStyles] Runtime error');
});

test('the Vale check fails before running Vale when the Vale packages are not installed', async () => {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await testdir(VALE_SANDBOX_FILES));
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    await rm(join(sandbox.path, GSPOT_PATHS.valeConfigFile));
    using run = spyOn(processes, 'spawnProcess');
    const uninstalledError = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(uninstalledError.message).toBe('The Vale packages are not installed. Run gspot install.');
    expect(run).not.toHaveBeenCalled();
});
