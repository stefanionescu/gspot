import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { SCHEDULE_RELEASE_MARKDOWN } from '#tests/config/configurations/general.ts';
import { EMPTY_VALE_INI, VALE_INSTALLED_FILES } from '#tests/config/setup/configurations.ts';
import { getBuiltInCheck, openFakeToolSession, planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

const VALE_ALERT = {
    Line: 1,
    Span: [3, 5],
    Check: 'gspot.Example',
    Message: 'Use a concrete example.',
} as const;

const VALE_SANDBOX_FILES = {
    ...VALE_INSTALLED_FILES,
    [GSPOT_PATHS.valeConfig]: EMPTY_VALE_INI,
    'example.md': '# Documentation\n',
};

async function openValeSandbox(resources: AsyncDisposableStack) {
    const settings = buildSandboxSettings(['prose', 'markdown'], { level: 'all' });
    const sandbox = resources.use(await createGitSandbox({ ...VALE_SANDBOX_FILES, 'gspot.toml': settings }));
    return await openFakeToolSession(sandbox.path, ['vale'], resources);
}

test('prose/vale sends Vale each stdin file as gspot read it at the start of the run, not a later edit', async () => {
    await using sandbox = await createGitSandbox({
        ...VALE_INSTALLED_FILES,
        'gspot.toml': buildSandboxSettings(['prose', 'typescript'], { level: 'all' }),
        [GSPOT_PATHS.valeConfig]: EMPTY_VALE_INI,
        'first.mts': '// First explanation.\n',
        'second.cts': '// Second explanation.\n',
    });

    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    const paths = ['first.mts', 'second.cts'];
    const previous = paths.map((path) => readBytes(session.cache, path).toString('utf8'));
    for (const path of paths) await writeFile(join(session.root, path), '// Changed after the run read it.\n');
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
});

test('the Vale check fails with the error line Vale prints when Vale exits non-zero', async () => {
    await using resources = new AsyncDisposableStack();
    const session = await openValeSandbox(resources);
    resources.use(
        fakeCommands().mockResolvedValue(
            buildProcessResult({ code: 2, stderr: 'Loading styles\nE100 [loadStyles] Runtime error\n' }),
        ),
    );
    const runtimeError = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(runtimeError).toMatchObject({ name: 'CheckStop', status: 'error' });
    expect(runtimeError.message).toContain('E100 [loadStyles] Runtime error');
});

test('the Vale check fails before running Vale when the Vale packages are not installed', async () => {
    await using resources = new AsyncDisposableStack();
    const session = await openValeSandbox(resources);
    await rm(join(session.root, GSPOT_PATHS.valeConfig));
    using run = fakeCommands();
    const uninstalledError = await captureRejection(runSandboxCheck(session.root, 'prose/vale'));
    expect(uninstalledError).toMatchObject({ name: 'CheckStop', status: 'missing' });
    expect(run).not.toHaveBeenCalled();
});

test('prose/commit-message runs Vale with the config of the gspot style alone, without the Vale packages', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
    });
    const messageFile = join(sandbox.path, '.git', 'COMMIT_EDITMSG');
    await writeFile(messageFile, 'fix(cli): keep the file\n\nRetry it.\n');
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['vale'], resources);
    const valeResult = buildProcessResult({ stdout: JSON.stringify({ 'stdin.md': [VALE_ALERT] }) });
    const run = resources.use(fakeCommands().mockResolvedValue(valeResult));
    const planned = planSandboxCheck(session, 'prose/commit-message');
    const findings = await getBuiltInCheck('prose/commit-message', { content: 'message', messageFile })(
        session,
        planned,
    );
    expect(run.mock.calls.map(([command]) => command.slice(1, 3))).toStrictEqual([
        ['--config', join(session.root, GSPOT_PATHS.valeMessageConfig)],
    ]);
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: '', rule: VALE_ALERT.Check, message: `Line 1: ${VALE_ALERT.Message}` },
    ]);
});

test('prose/dates reports dates in Markdown text and code comments, not in code', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose', 'markdown', 'typescript']),
        'guide.md':
            '# Schedule\n\nRelease on `03/04/2026` or\non 03/04/2026.\n\n```text\n05/06/2026\n```\n\nOr on 2026-03-04 or March 4, 2026.\n',
        'run.ts': "// Runs since 04.05.2026.\nexport const version = '01/02/2026';\n",
    });
    const findings = await runSandboxCheck(sandbox.path, 'prose/dates');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'guide.md', line: 4, rule: 'ambiguous-date' },
        { file: 'run.ts', line: 1, rule: 'ambiguous-date' },
    ]);
});

test('prose/dates checks a child file once at the root', async () => {
    const path = 'child/only.md';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'child', configurations: ['prose', 'docs'] }] }),
        [path]: SCHEDULE_RELEASE_MARKDOWN,
    });
    const session = await openSession(sandbox.path);
    const { report } = await runChecks(
        session,
        buildRunOptions({ cwd: sandbox.path, only: ['prose/dates'], pathArguments: [path] }),
    );
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'failed' },
    ]);
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, line }) => ({ file, line })))).toStrictEqual([
        { file: path, line: 3 },
    ]);
});
