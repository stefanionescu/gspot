import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { runChecks } from '#cli/checks/run/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import type { Session } from '#cli/types/planning.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { VALE_ALERT } from '#tests/data/checks/prose.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { checkFindings, buildCheckInput, openPinnedSession } from '#tests/setup/check-input.ts';

test('Vale gets the timeout setting, and its alerts become findings with file, line and column', async () => {
    await using folder = await testdir();
    const path = 'sample.md';
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['prose', 'markdown'], { tables: 'tool_timeout_seconds = 1\n' }),
        '.gspot/config/vale.ini': 'Packages =\n',
        [path]: '# Example text\n',
    });
    using resources = new DisposableStack();
    const session = await openPinnedSession(folder.path, ['vale'], resources);
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ stdout: JSON.stringify({ [join(folder.path, path)]: [VALE_ALERT] }) }),
        ),
    );
    const result = await runChecks(session, buildRunOptions({ only: ['prose/vale'] }));
    expect(run.mock.calls).toHaveLength(1);
    const [command, options] = run.mock.calls[0]!;
    expect(options.timeoutSeconds).toBe(1);
    expect(options.cwd).toBe(join(folder.path, '.gspot/config'));
    expect(command).toContain(join(folder.path, '.gspot/config/vale.ini'));
    expect(command).toContain(join(folder.path, path));
    expect(options.stdin).toBeUndefined();
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks).toMatchObject([{ check: 'prose/vale', status: 'failed' }]);
    expect(result.report.checks[0]!.findings).toStrictEqual([
        matchFields({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
    ]);
});

test('files Vale reads from stdin are scanned as read at the start of the run', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['prose', 'typescript']),
        '.gspot/config/vale.ini': 'Packages =\n',
        'first.mts': '// First explanation.\n',
        'second.cts': '// Second explanation.\n',
    });
    const session = await openSession(folder.path);
    const paths = ['first.mts', 'second.cts'];
    const original = paths.map((path) => readCachedBytes(session.reads, path).toString('utf8'));
    for (const path of paths) await Bun.write(join(session.root, path), '// Changed after the run read it.\n');

    using resources = new DisposableStack();
    resources.use(fakePinnedExecutables([getToolDeclaration(session.manifests.values(), 'vale')]));
    const scanned: string[] = [];
    const nativePaths: string[] = [];
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            nativePaths.push(...command.filter((argument) => argument.startsWith('--path=')));
            scanned.push(options.stdin!);
            return Promise.resolve(buildProcessResult({ stdout: JSON.stringify({ 'source.mts.ts': [VALE_ALERT] }) }));
        }),
    );
    const findings = await CHECK_IMPLEMENTATIONS['prose/vale'].check(buildCheckInput(session, 'prose/vale', { paths }));
    expect(run.mock.calls.map(([command]) => command.includes('--ext=.ts'))).toStrictEqual(paths.map(() => true));
    expect(scanned).toStrictEqual(original);
    expect(nativePaths).toStrictEqual(paths.map((path) => `--path=${join(folder.path, path)}.ts`));
    expect(findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual(
        paths.map((file) => ({ file, line: 1, column: 3, rule: 'gspot.Example' })),
    );
    for (const path of paths)
        expect(await Bun.file(join(session.root, path)).text()).toBe('// Changed after the run read it.\n');
});

test('Vale reads known file types by path, and .mts files and scripts without an extension through stdin', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['prose', 'typescript', 'bash']),
        '.gspot/config/vale.ini': 'Packages =\n',
        'a.tsx': '// Component explanation.\n',
        'a.mts': '// Module explanation.\n',
        'hooks/pre-commit': '#!/bin/sh\n# Hook explanation.\n',
        'a.png': 'Image bytes',
    });
    using resources = new DisposableStack();
    const session = await openPinnedSession(sandbox.path, ['vale'], resources);
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: '{}' }));
    expect(await checkFindings(session.root, 'prose/vale')).toStrictEqual([]);
    expect(
        run.mock.calls.map(([command, options]) => ({
            paths: command.filter((part) => part === join(sandbox.path, 'a.tsx') || part.startsWith('--path=')),
            stdin: options.stdin,
        })),
    ).toStrictEqual([
        { paths: [join(sandbox.path, 'a.tsx')], stdin: undefined },
        { paths: [`--path=${join(sandbox.path, 'a.mts.ts')}`], stdin: '// Module explanation.\n' },
        { paths: [`--path=${join(sandbox.path, 'hooks/pre-commit.py')}`], stdin: '#!/bin/sh\n# Hook explanation.\n' },
    ]);
});

test.each([
    {
        name: 'file and stdin report locations',
        stdout: JSON.stringify({
            'docs/a.md': [{ Line: 3, Span: [10, 15], Check: 'gspot.marketing', Message: "Marketing word 'robust'." }],
            'stdin.rb': [{ Line: 2, Span: [5, 6], Check: 'Google.We', Message: 'Try not to use first-person plural.' }],
        }),
        findings: [
            {
                check: 'prose/vale',
                file: 'docs/a.md',
                line: 3,
                column: 10,
                rule: 'gspot.marketing',
                message: "Marketing word 'robust'.",
                fixable: false,
            },
            {
                check: 'prose/vale',
                file: 'stdin.rb',
                line: 2,
                column: 5,
                rule: 'Google.We',
                message: 'Try not to use first-person plural.',
                fixable: false,
            },
        ],
    },
    {
        name: 'control characters in report paths',
        stdout:
            JSON.stringify({
                [join('docs', 'café:part\nname.md')]: [
                    { Line: 3, Span: [10, 15], Check: 'gspot.marketing', Message: 'Marketing word.' },
                ],
            }) + '\r\n',
        findings: [
            {
                check: 'prose/vale',
                file: 'docs/café:part\nname.md',
                line: 3,
                column: 10,
                rule: 'gspot.marketing',
                message: 'Marketing word.',
                fixable: false,
            },
        ],
    },
    { name: 'empty reports', stdout: '{}', findings: [] },
])('Vale preserves $name through the check', async ({ stdout, findings }) => {
    await using resources = new AsyncDisposableStack();
    const session = await prepareValeSession(resources);
    const absoluteOutput = JSON.stringify(
        Object.fromEntries(
            Object.entries(JSON.parse(stdout) as Record<string, unknown>).map(([path, alerts]) => [
                join(session.root, path),
                alerts,
            ]),
        ),
    );
    resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: absoluteOutput })));
    expect(await checkFindings(session.root, 'prose/vale')).toStrictEqual(
        findings.map((finding) => ({
            ...finding,
            help: 'Rewrite the sentence the alert names, add a real name and its reason to the root allowed_words setting, or use `gspot ignore prose/vale --rule <rule> --reason "<why>"`.',
        })),
    );
});

test.each(['diagnostic text', '{"file.md":[{}]}'])('the Vale check refuses malformed output %s', async (stdout) => {
    await using resources = new AsyncDisposableStack();
    const session = await prepareValeSession(resources);

    resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout })));
    const failure = await checkFindings(session.root, 'prose/vale').catch((error: unknown) => error);
    if (stdout.startsWith('{')) expect(String(failure)).toContain('Line');
    else expect(failure).toBeInstanceOf(SyntaxError);
});

/** Create a Markdown sandbox for the valid and refused Vale output tests. */
async function prepareValeSession(resources: AsyncDisposableStack): Promise<Session> {
    const sandbox = resources.use(
        await testdir({
            'gspot.toml': buildSettingsText(['prose', 'markdown']),
            '.gspot/config/vale.ini': 'Packages =\n',
            'example.md': '# Documentation\n',
        }),
    );
    return await openPinnedSession(sandbox.path, ['vale'], resources);
}
