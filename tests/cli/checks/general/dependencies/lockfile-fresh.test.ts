import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

test.each(['missing', 'deadline', 'cancellation', 'unexpected'] as const)(
    'frozen installation reports %s as inability, preserves the repository, and retries successfully',
    async (failure) => {
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
            only: ['dependencies/lockfile-fresh'],
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
