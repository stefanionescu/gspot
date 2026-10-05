import { join } from 'node:path';
import { toolPin } from '#cli/tools/pins.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { readSource } from '#cli/platform/source.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { buildTrackedFile } from '#tests/harness/tracked.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { vale, routeFor, routeGroups } from '#cli/checks/general/prose/vale.ts';
import { DIAGNOSTIC, EXECUTION_FAILURES } from '#tests/config/cli/checks/general/prose.ts';

test('an outdated Vale executable reports its missing acquisition without scanning', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'markdown'], { tables: 'run_with = "mise"\n' }),
        '.gspot/config/vale.ini': 'Packages =\n',
        'sample.md': '# Example text\n',
    });
    const session = await openSession(directory.path);
    const tool = toolPin(session.manifests.values(), 'vale');
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([{ ...tool, version: '0.0.1' }]));
    using spawn = spyOn(processes, 'run');
    const outcome = await executeRun(session, buildRunOptions({ only: ['prose/vale'] }));
    expect(outcome.report.exitCode).toBe(2);
    expect(outcome.report.checks).toMatchObject([{ check: 'prose/vale', status: 'missing', findings: [] }]);
    expect(outcome.report.checks[0]!.note).toContain('0.0.1');
    expect(outcome.report.checks[0]!.note).toContain('gspot install');
    expect(spawn).not.toHaveBeenCalled();
});

test.each(EXECUTION_FAILURES)(
    'Vale reports $name without interpreting an empty output as success',
    async ({ flags, diagnostic }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose', 'markdown'], { tables: 'tool_timeout_seconds = 1\n' }),
            '.gspot/config/vale.ini': 'Packages =\n',
            'sample.md': '# Example text\n',
        });
        const session = await openSession(directory.path);
        using resources = new DisposableStack();
        resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'vale')]));
        resources.use(
            spyOn(processes, 'run').mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: '',
                missing: false,
                duration: 1,
                ...flags,
            }),
        );
        const outcome = await executeRun(session, buildRunOptions({ only: ['prose/vale'] }));
        expect(outcome.report.exitCode).toBe(2);
        expect(outcome.report.checks).toMatchObject([{ check: 'prose/vale', status: 'error', findings: [] }]);
        expect(outcome.report.checks[0]!.note).toContain(diagnostic);
    },
);

test('Vale receives its configured deadline and returns located native alerts', async () => {
    await using directory = await testdir();
    const path = 'sample.md';
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'markdown'], { tables: 'tool_timeout_seconds = 1\n' }),
        '.gspot/config/vale.ini': 'Packages =\n',
        [path]: '# Example text\n',
    });
    const session = await openSession(directory.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'vale')]));
    resources.use(
        spyOn(processes, 'run').mockImplementation((command, options) => {
            expect(options.timeoutMs).toBe(1000);
            expect(options.cwd).toBe(directory.path);
            expect(command).toContain(path);
            expect(options.stdin).toBeUndefined();
            return Promise.resolve({
                code: 0,
                stdout: JSON.stringify({ [join(directory.path, path)]: [DIAGNOSTIC] }),
                stderr: '',
                missing: false,
                duration: 1,
            });
        }),
    );
    const result = await executeRun(session, buildRunOptions({ only: ['prose/vale'] }));
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks).toMatchObject([{ check: 'prose/vale', status: 'failed' }]);
    expect(result.report.checks[0]!.findings).toStrictEqual([
        containing({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
    ]);
});

test('each stdin route scans the bytes held by the run and maps its own alerts', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'typescript']),
        '.gspot/config/vale.ini': 'Packages =\n',
        'first.mts': '// First explanation.\n',
        'second.cts': '// Second explanation.\n',
    });
    const session = await openSession(directory.path);
    const paths = ['first.mts', 'second.cts'];
    const original = paths.map((path) => readSource(session.root, path, session.reads).toString('utf8'));
    for (const path of paths) await Bun.write(join(session.root, path), '// Changed after the run read it.\n');
    const input = buildEngineInput(session, 'prose/vale', { paths });
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'vale')]));
    const scanned: string[] = [];
    resources.use(
        spyOn(processes, 'run').mockImplementation((command, options) => {
            expect(command).toContain('--ext=.ts');
            scanned.push(options.stdin!);
            return Promise.resolve({
                code: 0,
                missing: false,
                duration: 1,
                stderr: '',
                stdout: JSON.stringify({ stdin: [DIAGNOSTIC] }),
            });
        }),
    );
    const findings = await vale(input);
    expect(scanned).toStrictEqual(original);
    expect(findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual(
        paths.map((file) => ({ file, line: 1, column: 3, rule: 'gspot.Example' })),
    );
    for (const path of paths)
        expect(await Bun.file(join(session.root, path)).text()).toBe('// Changed after the run read it.\n');
});

describe('prose routes', () => {
    test('known grammars read paths while module aliases and extensionless scripts use typed stdin', () => {
        expect(routeFor(buildTrackedFile('a.tsx'))).toStrictEqual({ path: 'a.tsx', mode: 'path', extension: '.ts' });
        expect(routeFor(buildTrackedFile('a.mts'))).toStrictEqual({ path: 'a.mts', mode: 'stdin', extension: '.ts' });
        expect(routeFor(buildTrackedFile('hooks/pre-commit', ['shell', 'text']))).toStrictEqual({
            path: 'hooks/pre-commit',
            mode: 'stdin',
            extension: '.py',
        });
        expect(routeFor(buildTrackedFile('a.png'))).toBeUndefined();
    });

    test('path routes group by extension and an extensionless script stands alone', () => {
        const groups = routeGroups([
            buildTrackedFile('a.md'),
            buildTrackedFile('b.md'),
            buildTrackedFile('c.ts'),
            buildTrackedFile('d.sh'),
            buildTrackedFile('e.sh'),
            buildTrackedFile('hooks/pre-commit', ['shell', 'text']),
        ]);
        const paths = [];
        for (const group of groups) paths.push(group.map((route) => route.path));
        expect(paths).toStrictEqual([['a.md', 'b.md'], ['c.ts'], ['d.sh', 'e.sh'], ['hooks/pre-commit']]);
    });
});
