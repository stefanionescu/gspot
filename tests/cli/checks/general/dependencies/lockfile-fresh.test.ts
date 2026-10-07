import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

test.each(['missing', 'deadline', 'cancellation', 'unexpected'] as const)(
    'frozen installation reports %s as inability, preserves the repository, and retries successfully',
    async (failure) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['dependencies']),
            'package.json': '{"name":"example","private":true}\n',
            'bun.lock': 'original lock\n',
            'node_modules/protected.txt': 'installed dependency\n',
        });
        const session = await openSession(directory.path);
        const options = buildRunOptions({
            stage: 'push',
            skips: [],
            only: ['dependencies/lockfile-fresh'],
        });
        const copies: string[] = [];
        const spawn = spyOn(processes, 'run').mockImplementation((_command, options) => {
            copies.push(options.cwd);
            writeFileSync(join(options.cwd, 'bun.lock'), 'partial installation\n');
            mkdirSync(join(options.cwd, 'node_modules'), { recursive: true });
            writeFileSync(join(options.cwd, 'node_modules/protected.txt'), 'replacement dependency\n');
            return Promise.resolve({
                code: 1,
                stdout: '',
                stderr: {
                    missing: 'Installation failed.',
                    deadline: 'Installation failed.',
                    cancellation: 'Installation failed.',
                    unexpected: 'Installation failed.',
                }[failure],
                duration: 1,
                missing: failure === 'missing',
                isTimedOut: failure === 'deadline',
                isCanceled: failure === 'cancellation',
            });
        });
        try {
            const outcome = await executeRun(session, options);
            const result = outcome.report.checks[0]!;
            expect(result.status).toBe(failure === 'missing' ? 'missing' : 'error');
            expect(result.findings).toStrictEqual([]);
            expect(readFileSync(join(directory.path, 'bun.lock'), 'utf8')).toBe('original lock\n');
            expect(readFileSync(join(directory.path, 'node_modules/protected.txt'), 'utf8')).toBe(
                'installed dependency\n',
            );
            expect(copies.every((path) => !existsSync(path))).toBe(true);
            spawn.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
            const retry = await executeRun(session, options);
            const fresh = retry.report.checks[0]!;
            expect(fresh.status).toBe('passed');
        } finally {
            spawn.mockRestore();
        }
    },
);
