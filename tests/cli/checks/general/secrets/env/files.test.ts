import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { git, commitAll } from '#tests/harness/git.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { checkReport, buildRunOptions } from '#tests/harness/gspot.ts';
import { STAGED_CASES, TRACKED_PATTERNS } from '#tests/config/cli/checks/general/secrets/env/files.ts';

test('tracked-file checks distinguish environment files from templates in nested folders', async () => {
    await using directory = await testdir();
    const privateFiles = ['.env', '.env.local', 'nested/.dev.vars', 'nested/.dev.vars.production'];
    const templates = ['.env.example', '.env.template', 'nested/.env.sample', 'nested/.dev.vars.example'];
    await createFileTree(
        directory.path,
        Object.fromEntries([...privateFiles, ...templates].map((path) => [path, 'EXAMPLE=value\n'])),
    );
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-f', '.']).code).toBe(0);
    await Bun.write(join(directory.path, 'gspot.toml'), buildPolicy(['secrets'], { level: 'all' }));
    const input = buildCheckInput(await openSession(directory.path), 'repository/tracked-files', { paths: [] });
    expect(
        BUILT_IN_CHECKS['repository/tracked-files'].input(input).map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual(privateFiles.map((file) => ({ file, rule: 'tracked-file' })));
});

test.each([...STAGED_CASES])('staged environment policy respects a check that is $name', async (entry) => {
    await using sandbox = await testdir();
    const policy = buildPolicy([...entry.configurations], {
        tables: `[check."project/source"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "commit"
${entry.ignore}`,
    });
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original\n' });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        '.env': 'PUBLIC_EXAMPLE=value\n',
        '.env.example': 'PUBLIC_EXAMPLE=example\n',
        'source.txt': 'changed\n',
    });
    expect(git(sandbox.path, ['add', '-f', '.env', '.env.example', 'source.txt']).code).toBe(0);
    const result = await checkReport(sandbox.path, [
        'check',
        '--staged',
        '--only',
        entry.check,
        ...entry.flags,
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(entry.code);
    const report = result.report;
    expect(report.checks).toMatchObject([
        {
            check: entry.check,
            status: entry.status,
            findings: entry.findings,
        },
    ]);
    expect(await Bun.file(join(sandbox.path, '.env')).text()).toBe('PUBLIC_EXAMPLE=value\n');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});

test('checks share one index within a run and see corrections in the next run', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['secrets', 'javascript', 'xcode'], { level: 'all' }),
        'App.xcodeproj/project.pbxproj': '{}\n',
        '.env': 'EXAMPLE=value\n',
        'node_modules/example/index.js': 'export {};\n',
    });
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-f', '.']).code).toBe(0);
    const session = await openSession(directory.path);
    using resources = new DisposableStack();
    const reads = resources.use(spyOn(processes, 'runBinary'));
    const blocking = resources.use(spyOn(processes, 'runBlocking'));
    const indexReads = () => [...reads.mock.calls, ...blocking.mock.calls].filter(([argv]) => argv.includes('--stage'));
    const options = buildRunOptions({
        only: ['repository/tracked-files', 'xcode/symlinks'],
    });
    const before = await executeRun(session, options);
    expect(before.report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'xcode/symlinks', status: 'passed' },
        { check: 'repository/tracked-files', status: 'failed' },
    ]);
    expect(indexReads()).toHaveLength(1);
    expect([...reads.mock.calls, ...blocking.mock.calls].some(([argv]) => argv.includes('--cached'))).toBe(false);
    expect(git(directory.path, ['rm', '-r', '--cached', '--', '.env', 'node_modules']).code).toBe(0);
    const after = await executeRun(session, options);
    expect(after.report.exitCode).toBe(0);
    expect(after.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
    expect(indexReads()).toHaveLength(2);
    expect(session.repository.index.some((entry) => entry.path === '.env')).toBe(true);
    expect(await Bun.file(join(directory.path, '.env')).text()).toBe('EXAMPLE=value\n');
});

test.each(['recommended', 'all'] as const)(
    '%s tracked-file patterns follow root, child, and sibling selections without exempting nested templates',
    async (level) => {
        await using sandbox = await testdir();
        const { refused, allowed, scopes } = TRACKED_PATTERNS;
        const policy = buildPolicy(['javascript'], { level, tables: scopes });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            ...Object.fromEntries([...refused, ...allowed].map((path) => [path, 'PUBLIC_EXAMPLE=value\n'])),
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-f', '.']).code).toBe(0);
        const input = buildCheckInput(await openSession(sandbox.path), 'repository/tracked-files', { paths: [] });
        const found = BUILT_IN_CHECKS['repository/tracked-files'].input({
            ...input,
            index: [...input.index, ...input.index],
        });
        expect(found.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            refused.toSorted((left, right) => left.localeCompare(right)),
        );
        expect(found.every(({ rule, line }) => rule === 'tracked-file' && line === 1)).toBe(true);
        expect(
            input.selections
                .find(({ scope }) => scope.path === 'python')
                ?.selected.map(({ configuration }) => configuration.name),
        ).toContain('python');
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            policy +
                '\n[[ignore]]\ncheck = "repository/tracked-files"\npaths = ["python/.venv/**"]\nreason = "The existing Python example fixture is retained for this isolated index control."\n',
        );
        const ignored = await checkReport(sandbox.path, ['check', '--only', 'repository/tracked-files', '--json']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(1);
        expect(
            ignored.report.checks
                .flatMap(({ findings }) => findings.map(({ file }) => file))
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(
            refused
                .filter((path) => !path.startsWith('python/.venv/'))
                .toSorted((left, right) => left.localeCompare(right)),
        );
        expect(await Bun.file(join(sandbox.path, 'node_modules/.env.example')).text()).toBe('PUBLIC_EXAMPLE=value\n');
    },
);
