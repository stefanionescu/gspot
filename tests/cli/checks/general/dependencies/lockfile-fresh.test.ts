import { join, basename } from 'node:path';
import * as tools from '#cli/tools/public.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
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
        await using directory = await testdir();
        await createFileTree(directory.path, {
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
        const spawn = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
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
        try {
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
        } finally {
            spawn.mockRestore();
        }
    },
);

test('Yarn Berry validates metadata locks with install --immutable and preserves repository inputs', async () => {
    await using directory = await testdir();
    const files = {
        'gspot.toml': buildPolicy(['dependencies']),
        'package.json': '{"name":"example","private":true}\n',
        'yarn.lock': '__metadata:\n  version: 8\n',
    };
    await createFileTree(directory.path, files);
    const commands: string[][] = [];
    const copies: string[] = [];
    using _inspection = spyOn(tools, 'inspectTool').mockReturnValue({ name: 'yarn', state: 'ok', path: 'yarn' });
    using _yarn = spyOn(processes, 'run').mockImplementation((command, options) => {
        commands.push([...command]);
        copies.push(options.cwd);
        return Promise.resolve({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
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
        commands.map(([executable, ...commandArguments]) => [basename(executable!), ...commandArguments]),
    ).toStrictEqual([['yarn', 'install', '--immutable']]);
    for (const [path, text] of Object.entries(files))
        expect(await readFile(join(directory.path, path), 'utf8')).toBe(text);
    expect(await Promise.all(copies.map((path) => pathExists(path)))).toStrictEqual([false]);
});
