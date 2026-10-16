import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { VALE_ALERT } from '#tests/config/prose.ts';
import * as processes from '#cli/system/processes.ts';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { readSource } from '#cli/system/files/reads.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { processResult } from '#tests/setup/processes.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

test('Vale gets the timeout setting, and its alerts become findings with file, line and column', async () => {
    await using directory = await testdir();
    const path = 'sample.md';
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose', 'markdown'], { tables: 'tool_timeout_seconds = 1\n' }),
        '.gspot/config/vale.ini': 'Packages =\n',
        [path]: '# Example text\n',
    });
    const session = await openSession(directory.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'vale')]));
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            processResult({ stdout: JSON.stringify({ [join(directory.path, path)]: [VALE_ALERT] }) }),
        ),
    );
    const result = await executeRun(session, buildRunOptions({ only: ['prose/vale'] }));
    expect(run.mock.calls).toHaveLength(1);
    const [command, options] = run.mock.calls[0]!;
    expect(options.timeoutSeconds).toBe(1000);
    expect(options.cwd).toBe(join(directory.path, '.gspot/config'));
    expect(command).toContain(join(directory.path, '.gspot/config/vale.ini'));
    expect(command).toContain(join(directory.path, path));
    expect(options.stdin).toBeUndefined();
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks).toMatchObject([{ check: 'prose/vale', status: 'failed' }]);
    expect(result.report.checks[0]!.findings).toStrictEqual([
        containing({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
    ]);
});

test('files Vale reads from stdin are scanned as read at the start of the run', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose', 'typescript']),
        '.gspot/config/vale.ini': 'Packages =\n',
        'first.mts': '// First explanation.\n',
        'second.cts': '// Second explanation.\n',
    });
    const session = await openSession(directory.path);
    const paths = ['first.mts', 'second.cts'];
    const original = paths.map((path) => readSource(session.root, path, session.reads).toString('utf8'));
    for (const path of paths) await Bun.write(join(session.root, path), '// Changed after the run read it.\n');

    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'vale')]));
    const scanned: string[] = [];
    const nativePaths: string[] = [];
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            nativePaths.push(...command.filter((argument) => argument.startsWith('--path=')));
            scanned.push(options.stdin!);
            return Promise.resolve(processResult({ stdout: JSON.stringify({ 'source.mts.ts': [VALE_ALERT] }) }));
        }),
    );
    const findings = await CHECK_FUNCTIONS['prose/vale'](buildCheckInput(session, 'prose/vale', { paths }));
    expect(run.mock.calls.map(([command]) => command.includes('--ext=.ts'))).toStrictEqual(paths.map(() => true));
    expect(scanned).toStrictEqual(original);
    expect(nativePaths).toStrictEqual(paths.map((path) => `--path=${join(directory.path, path)}.ts`));
    expect(findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual(
        paths.map((file) => ({ file, line: 1, column: 3, rule: 'gspot.Example' })),
    );
    for (const path of paths)
        expect(await Bun.file(join(session.root, path)).text()).toBe('// Changed after the run read it.\n');
});

test('Vale reads known file types by path, and .mts files and scripts without an extension through stdin', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['prose', 'typescript', 'bash']),
        '.gspot/config/vale.ini': 'Packages =\n',
        'a.tsx': '// Component explanation.\n',
        'a.mts': '// Module explanation.\n',
        'hooks/pre-commit': '#!/bin/sh\n# Hook explanation.\n',
        'a.png': 'Image bytes',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'vale')]));
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(processResult({ stdout: '{}' }));
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

test('Vale groups path files by extension and reads each script without an extension alone', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['prose', 'markdown', 'typescript', 'bash']),
        '.gspot/config/vale.ini': 'Packages =\n',
        'a.md': '# A\n',
        'b.md': '# B\n',
        'c.ts': '// C\n',
        'd.sh': '#!/bin/sh\n# D\n',
        'e.sh': '#!/bin/sh\n# E\n',
        'hooks/pre-commit': '#!/bin/sh\n# Hook\n',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'vale')]));
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(processResult({ stdout: '{}' }));
    expect(await checkFindings(session.root, 'prose/vale')).toStrictEqual([]);
    const sourcePaths = new Set(['a.md', 'b.md', 'c.ts', 'd.sh', 'e.sh'].map((path) => join(sandbox.path, path)));
    expect(
        run.mock.calls.map(([command]) =>
            command.filter((part) => sourcePaths.has(part) || part.startsWith('--path=')),
        ),
    ).toStrictEqual([
        ...[['a.md', 'b.md'], ['c.ts'], ['d.sh', 'e.sh']].map((paths) => paths.map((path) => join(sandbox.path, path))),
        [`--path=${join(sandbox.path, 'hooks/pre-commit.py')}`],
    ]);
});

test.each([
    {
        name: 'native file and stdin report locations',
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
        name: 'control characters in native report paths',
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
    { name: 'empty native reports', stdout: '{}', findings: [] },
])('Vale preserves $name through the check', async ({ stdout, findings }) => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['prose', 'markdown']),
        '.gspot/config/vale.ini': 'Packages =\n',
        'example.md': '# Documentation\n',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'vale')]));
    const absoluteOutput = JSON.stringify(
        Object.fromEntries(
            Object.entries(JSON.parse(stdout) as Record<string, unknown>).map(([path, alerts]) => [
                join(sandbox.path, path),
                alerts,
            ]),
        ),
    );
    resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(processResult({ stdout: absoluteOutput })));
    expect(await checkFindings(session.root, 'prose/vale')).toStrictEqual(
        findings.map((finding) => ({
            ...finding,
            help: 'Rewrite the sentence the alert names, write a real name and its reason in the root allowed_words setting, or use gspot ignore prose/vale --rule `<rule>` --reason "`<why>`".',
        })),
    );
});

test.each(['diagnostic text', '{"file.md":[{}]}'])(
    'the Vale check refuses malformed native output %s',
    async (stdout) => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText(['prose', 'markdown']),
            '.gspot/config/vale.ini': 'Packages =\n',
            'example.md': '# Documentation\n',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        resources.use(mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'vale')]));
        resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(processResult({ stdout })));
        expect(checkFindings(session.root, 'prose/vale')).rejects.toThrow(
            stdout.startsWith('{') ? 'Line' : SyntaxError,
        );
    },
);
