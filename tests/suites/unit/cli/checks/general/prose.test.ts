import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { getTool } from '#cli/manifests/tools.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { runSandboxCheck, getBuiltInCheck, planSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';

import {
    VALE_ALERT,
    EMPTY_VALE_INI,
    VALE_OUTPUT_CASES,
    VALE_SANDBOX_FILES,
    VALE_INSTALLED_FILES,
} from '#tests/config/checks/general/prose.ts';

test('Vale gets the timeout setting, and its alerts become findings with file, line and column', async () => {
    await using sandbox = await testdir();
    const path = 'sample.md';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['prose', 'markdown'], { tables: 'tool_timeout_seconds = 1\n' }),
        [GSPOT_PATHS.valeConfigFile]: EMPTY_VALE_INI,
        [path]: '# Example text\n',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    const valeResult = buildProcessResult({ stdout: JSON.stringify({ [join(sandbox.path, path)]: [VALE_ALERT] }) });
    const spawn = fakeCommands().mockResolvedValue(valeResult);
    const run = resources.use(spawn);
    const result = await runChecks(session, buildRunOptions({ only: ['prose/vale'] }));
    expect(run.mock.calls.map(([, options]) => options.timeoutSeconds)).toStrictEqual([1]);

    expect(result.report.checks).toMatchObject([{ check: 'prose/vale', status: 'failed' }]);
    expect(result.report.checks[0]!.findings).toStrictEqual([
        matchFields({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
    ]);
});

test('prose/vale sends Vale each stdin file as gspot read it at the start of the run, not a later edit', async () => {
    await using sandbox = await testdir({
        ...VALE_INSTALLED_FILES,
        'gspot.toml': buildSandboxSettings(['prose', 'typescript'], { level: 'all' }),
        [GSPOT_PATHS.valeConfigFile]: EMPTY_VALE_INI,
        'first.mts': '// First explanation.\n',
        'second.cts': '// Second explanation.\n',
    });

    const session = await openSession(sandbox.path);
    const paths = ['first.mts', 'second.cts'];
    const previous = paths.map((path) => readBytes(session.cache, path).toString('utf8'));
    for (const path of paths) await writeFile(join(session.root, path), '// Changed after the run read it.\n');

    using resources = new DisposableStack();
    const fakes = fakeToolExecutables([getTool(session.configurationsByName.values(), 'vale')]);
    resources.use(fakes);
    const scanned: string[] = [];
    resources.use(
        fakeCommands().mockImplementation((_command, options) => {
            scanned.push(options.stdin!);
            return Promise.resolve(buildProcessResult({ stdout: JSON.stringify({ 'source.mts.ts': [VALE_ALERT] }) }));
        }),
    );
    const findings = await getBuiltInCheck('prose/vale')(session, planSandboxCheck(session, 'prose/vale', { paths }));
    expect(scanned).toStrictEqual(previous);
    expect(findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual(
        paths.map((file) => ({ file, line: 1, column: 3, rule: 'gspot.Example' })),
    );
    for (const path of paths)
        expect(await readFile(join(session.root, path), 'utf8')).toBe('// Changed after the run read it.\n');
});

test.each([...VALE_OUTPUT_CASES])(
    'Vale alerts with $name become findings at the reported file, line, and column',
    async ({ stdout, findings }) => {
        await using resources = new AsyncDisposableStack();
        const sandbox = resources.use(
            await testdir({ ...VALE_SANDBOX_FILES, 'gspot.toml': buildSandboxSettings(['prose', 'markdown']) }),
        );
        const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
        const parsed = Object.fromEntries(
            Object.entries(JSON.parse(stdout) as Record<string, unknown>).map(([path, alerts]) => [
                join(session.root, path),
                alerts,
            ]),
        );
        const absoluteOutput = JSON.stringify(parsed);
        resources.use(fakeCommands().mockResolvedValue(buildProcessResult({ stdout: absoluteOutput })));
        const found = await runSandboxCheck(session.root, 'prose/vale');
        expect(found.map(({ help: _help, ...finding }) => finding)).toStrictEqual([...findings]);
    },
);

test.each(['diagnostic text', '{"file.md":[{}]}'])('the Vale check refuses malformed output %s', async (stdout) => {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(
        await testdir({ ...VALE_SANDBOX_FILES, 'gspot.toml': buildSandboxSettings(['prose', 'markdown']) }),
    );
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);

    resources.use(fakeCommands().mockResolvedValue(buildProcessResult({ stdout })));
    const error = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(error.message).toBe('Vale printed output that gspot cannot read.');
});

test('the Vale check fails with the error line Vale prints when Vale exits non-zero', async () => {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(
        await testdir({ ...VALE_SANDBOX_FILES, 'gspot.toml': buildSandboxSettings(['prose', 'markdown']) }),
    );
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    resources.use(
        fakeCommands().mockResolvedValue(
            buildProcessResult({ code: 2, stderr: 'Loading styles\nE100 [loadStyles] Runtime error\n' }),
        ),
    );
    const runtimeError = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(runtimeError.message).toBe('Vale did not run (exit 2): E100 [loadStyles] Runtime error');
});

test('the Vale check fails before running Vale when the Vale packages are not installed', async () => {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(
        await testdir({ ...VALE_SANDBOX_FILES, 'gspot.toml': buildSandboxSettings(['prose', 'markdown']) }),
    );
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    await rm(join(sandbox.path, GSPOT_PATHS.valeConfigFile));
    using run = fakeCommands();
    const uninstalledError = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(uninstalledError.message).toBe('The Vale packages are not installed. Run gspot install.');
    expect(run).not.toHaveBeenCalled();
});
