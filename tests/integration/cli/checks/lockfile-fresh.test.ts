import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { planRun } from '#cli/execution/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { lockfileFresh } from '#cli/checks/dependencies/lockfile/fresh.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

test.each(['missing', 'deadline', 'cancellation', 'registry', 'authentication', 'unexpected'])(
    'frozen installation reports %s as inability, preserves the repository, and retries successfully',
    async (failure) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["dependencies"]\n',
            'package.json': '{"name":"example","private":true}\n',
            'bun.lock': 'original lock\n',
            'node_modules/protected.txt': 'installed dependency\n',
        });
        const session = await openSession(directory.path);
        const [planned] = await planRun(session, {
            stage: 'push',
            skips: [],
            only: ['integrity/lockfile-fresh'],
        });
        const copies: string[] = [];
        const spawn = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
            copies.push(options.cwd);
            writeFileSync(join(options.cwd, 'bun.lock'), 'partial installation\n');
            mkdirSync(join(options.cwd, 'node_modules'), { recursive: true });
            writeFileSync(join(options.cwd, 'node_modules/protected.txt'), 'replacement dependency\n');
            return {
                code: 1,
                stdout: '',
                stderr:
                    failure === 'registry'
                        ? 'ConnectionRefused downloading package metadata'
                        : failure === 'authentication'
                          ? 'HTTP 401 Unauthorized'
                          : 'Installation failed.',
                duration: 1,
                missing: failure === 'missing',
                isTimedOut: failure === 'deadline',
                isCanceled: failure === 'cancellation',
            };
        });
        try {
            const result = await runEngineCheck(session, lockfileFresh, planned!);
            expect(result.status).toBe(failure === 'missing' ? 'missing' : 'error');
            expect(result.findings).toStrictEqual([]);
            expect(readFileSync(join(directory.path, 'bun.lock'), 'utf8')).toBe('original lock\n');
            expect(readFileSync(join(directory.path, 'node_modules/protected.txt'), 'utf8')).toBe(
                'installed dependency\n',
            );
            expect(copies).toHaveLength(1);
            expect(copies.every((path) => !existsSync(path))).toBe(true);
            spawn.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
            expect((await runEngineCheck(session, lockfileFresh, planned!)).status).toBe('ok');
        } finally {
            spawn.mockRestore();
        }
    },
);
