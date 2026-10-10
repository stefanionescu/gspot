import which from 'which';
import { testdir } from 'testdirs';
import { join, basename } from 'node:path';
import * as tools from '#cli/tools/public.ts';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

test.each([
    { failure: 'missing', note: 'could not be started' },
    { failure: 'deadline', note: 'ran past' },
    { failure: 'cancellation', note: 'was canceled' },
    { failure: 'unexpected', note: 'Installation failed.' },
])(
    'frozen installation reports $failure as inability, preserves the repository, and retries successfully',
    async ({ failure, note }) => {
        await using directory = await testdir({
            'gspot.toml': buildPolicy(['dependencies']),
            'package.json': '{"name":"example","private":true}\n',
            'bun.lock': 'original lockfile\n',
            'node_modules/protected.txt': 'installed dependency\n',
        });
        const session = await openSession(directory.path);
        const options = buildRunOptions({
            stage: 'push',
            skips: [],
            only: ['dependencies/stale-lockfile'],
        });
        const copies: string[] = [];
        using spawn = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
            copies.push(options.cwd);
            await writeFile(join(options.cwd, 'bun.lock'), 'partial installation\n');
            await mkdir(join(options.cwd, 'node_modules'), { recursive: true });
            await writeFile(join(options.cwd, 'node_modules/protected.txt'), 'replacement dependency\n');
            return {
                code: 1,
                stdout: '',
                stderr: 'Installation failed.',
                duration: 1,
                missing: failure === 'missing',
                isTimedOut: failure === 'deadline',
                isCanceled: failure === 'cancellation',
            };
        });
        const outcome = await executeRun(session, options);
        const result = outcome.report.checks[0]!;
        expect(result.status).toBe(failure === 'missing' ? 'missing' : 'error');
        expect(result.note).toContain(note);
        expect(result.findings).toStrictEqual([]);
        expect(await readFile(join(directory.path, 'bun.lock'), 'utf8')).toBe('original lockfile\n');
        expect(await readFile(join(directory.path, 'node_modules/protected.txt'), 'utf8')).toBe(
            'installed dependency\n',
        );
        expect(await Promise.all(copies.map((path) => pathExists(path)))).toStrictEqual(copies.map(() => false));
        spawn.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
        const retry = await executeRun(session, options);
        const fresh = retry.report.checks[0]!;
        expect(fresh.status).toBe('passed');
    },
);

test('Yarn Berry preserves its lockfile with install --immutable', async () => {
    const files = {
        'gspot.toml': buildPolicy(['dependencies']),
        'package.json': '{"name":"example","private":true}\n',
        'yarn.lock': '__metadata:\n  version: 8\n',
    };
    await using directory = await testdir(files);
    using _inspection = spyOn(tools, 'inspectTool').mockReturnValue({ name: 'yarn', state: 'ok', path: 'yarn' });
    using yarn = spyOn(processes, 'run').mockResolvedValue({
        code: 0,
        stdout: '',
        stderr: '',
        missing: false,
        duration: 1,
    });
    const session = await openSession(directory.path);
    const outcome = await executeRun(
        session,
        buildRunOptions({
            stage: 'push',
            skips: [],
            only: ['dependencies/stale-lockfile'],
        }),
    );
    expect(outcome.report.checks[0]!.status).toBe('passed');
    expect(
        yarn.mock.calls.map(([[executable, ...commandArguments]]) => [basename(executable!), ...commandArguments]),
    ).toStrictEqual([['yarn', 'install', '--immutable']]);
    for (const [path, text] of Object.entries(files))
        expect(await readFile(join(directory.path, path), 'utf8')).toBe(text);
    expect(await Promise.all(yarn.mock.calls.map(([, options]) => pathExists(options.cwd)))).toStrictEqual([false]);
});

test.each(['recommended', 'all'] as const)(
    '%s frozen installs retain complete inputs only after a manifest changes',
    async (level) => {
        await using directory = await testdir({
            'gspot.toml': buildPolicy(['dependencies'], {
                level,
                tables: '[scope.app]\nconfigurations = ["dependencies"]\n',
            }),
            'package.json': '{"name":"root","private":true}\n',
            'bun.lock': 'Original lockfile.\n',
            'source.txt': 'Root source.\n',
            'app/package.json': '{"name":"child","private":true}\n',
            'app/source.txt': 'Child source.\n',
        });
        const commands: string[][] = [];
        const inputs: string[][] = [];
        using _process = spyOn(processes, 'run').mockImplementation(async (command, options) => {
            commands.push([...command]);
            inputs.push(
                await Promise.all(
                    ['source.txt', 'app/source.txt'].map((path) => readFile(join(options.cwd, path), 'utf8')),
                ),
            );
            return { code: 0, stdout: '', stderr: '', missing: false, duration: 1 };
        });
        const session = await openSession(directory.path);
        const options = { stage: 'push' as const, skips: [], only: ['dependencies/stale-lockfile'] };
        const untouched = await executeRun(session, buildRunOptions({ ...options, staged: ['app/source.txt'] }));
        expect(untouched.report.checks).toStrictEqual([]);
        expect(commands).toStrictEqual([]);
        const triggered = await executeRun(session, buildRunOptions({ ...options, staged: ['app/package.json'] }));
        expect(triggered.report.checks).toMatchObject([{ check: 'dependencies/stale-lockfile', status: 'passed' }]);
        expect(commands).toStrictEqual([[which.sync('bun'), 'install', '--frozen-lockfile', '--dry-run']]);
        expect(inputs).toStrictEqual([['Root source.\n', 'Child source.\n']]);
        expect(await readFile(join(directory.path, 'bun.lock'), 'utf8')).toBe('Original lockfile.\n');
    },
);
