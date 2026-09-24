import { join } from 'node:path';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { nextjsBuild, nextjsTypes } from '#cli/checks/nextjs/build.ts';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

for (const scope of ['', 'apps/web']) {
    describe(`Next.js output preservation in ${scope || 'root'}`, () => {
        for (const check of ['nextjs/typecheck', 'nextjs/build']) {
            test(`${check} reports a defect, accepts its correction, and preserves source output`, async () => {
                await using directory = await testdir();
                const path = (file: string) => join(scope, file);
                await createFileTree(directory.path, {
                    'gspot.toml': `version = 1\nconfigurations = ["nextjs"]\n${scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`}`,
                    [path('package.json')]: '{"private":true,"dependencies":{"next":"16.3.5"}}\n',
                    [path('tsconfig.json')]: '{"compilerOptions":{"strict":true}}\n',
                    [path('next-env.d.ts')]: '// Authored type declaration\n',
                    [path('.next/types/routes.d.ts')]: '// Retained route types\n',
                    [path('src/page.ts')]: 'bad input\n',
                    'unrelated/private.txt': 'Preserve unrelated scope\n',
                });
                commitAll(directory.path);
                const untracked = join(directory.path, path('.next/local-cache.bin'));
                writeFileSync(untracked, Buffer.from([0, 255, 1, 2]));
                const session = await openSession(directory.path);
                const spec = session.manifests.get('nextjs')!.checks.find((entry) => entry.name === check)!;
                const input: EngineInput = engineInput(session, {
                    scope: session.scopes.find((entry) => entry.scope.path === scope)!,
                    spec: spec,
                    files: session.repository.files,
                });
                const config = join(directory.path, path('tsconfig.json'));
                const original = readFileSync(config);
                chmodSync(config, 0o640);
                const mode = statSync(config).mode;
                const directories: string[] = [];
                const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
                const runBlocking = processes.runBlocking;
                const probe = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
                    if (command[0] === 'git') return runBlocking(command, options);
                    expect(command.slice(1)).toStrictEqual(['--version']);
                    return { code: 0, missing: false, duration: 1, stdout: 'Version 5.9.3', stderr: '' };
                });
                const run = spyOn(processes, 'run').mockImplementation(async (command, options) => {
                    const cwd = options.cwd;
                    directories.push(cwd);
                    expect(cwd).not.toBe(join(directory.path, scope));
                    const isBad = readFileSync(join(cwd, 'src/page.ts'), 'utf8').includes('bad');
                    if (command[1] === 'typegen' || command[1] === 'build') {
                        writeFileSync(join(cwd, 'tsconfig.json'), '{}\n');
                        writeFileSync(join(cwd, 'next-env.d.ts'), '// Generated\n');
                        mkdirSync(join(cwd, '.next/types'), { recursive: true });
                        writeFileSync(join(cwd, '.next/types/routes.d.ts'), '// Generated routes\n');
                    } else {
                        expect(readFileSync(join(cwd, '.next/types/routes.d.ts'), 'utf8')).toBe(
                            '// Generated routes\n',
                        );
                    }
                    const failed = isBad && command[1] !== 'typegen';
                    return {
                        code: failed ? 1 : 0,
                        missing: false,
                        duration: 1,
                        stdout:
                            failed && check === 'nextjs/typecheck'
                                ? 'src/page.ts(1,1): error TS2322: Type mismatch\n'
                                : '',
                        stderr: failed && check === 'nextjs/build' ? 'Error: Page is invalid\n' : '',
                    };
                });
                try {
                    const execute = check === 'nextjs/typecheck' ? nextjsTypes : nextjsBuild;
                    const found = await execute(input);
                    expect(found).toHaveLength(1);
                    expect(found[0]).toMatchObject({
                        check,
                        file: path(check === 'nextjs/typecheck' ? 'src/page.ts' : 'package.json').replaceAll('\\', '/'),
                        line: 1,
                    });
                    expect(found[0]!.message).toBe(
                        check === 'nextjs/typecheck' ? 'Type mismatch' : 'next build failed: Error: Page is invalid',
                    );
                    writeFileSync(join(directory.path, path('src/page.ts')), 'corrected input\n');
                    expect(await execute(input)).toStrictEqual([]);
                    expect(directories).toHaveLength(check === 'nextjs/typecheck' ? 4 : 2);
                    expect(directories.every((cwd) => !existsSync(cwd))).toBe(true);
                    expect(readFileSync(config)).toStrictEqual(original);
                    expect(statSync(config).mode).toBe(mode);
                    expect(readFileSync(untracked)).toStrictEqual(Buffer.from([0, 255, 1, 2]));
                    expect(readFileSync(join(directory.path, path('next-env.d.ts')), 'utf8')).toBe(
                        '// Authored type declaration\n',
                    );
                    expect(readFileSync(join(directory.path, path('.next/types/routes.d.ts')), 'utf8')).toBe(
                        '// Retained route types\n',
                    );
                    expect(readFileSync(join(directory.path, 'unrelated/private.txt'), 'utf8')).toBe(
                        'Preserve unrelated scope\n',
                    );
                } finally {
                    probe.mockRestore();
                    locate.mockRestore();
                    run.mockRestore();
                }
            });
        }
    });
}

test.each(['Generator failed', 'unknown command', 'Invalid project directory'])(
    'failed type generation %s cleans the isolated copy without restoring over source edits',
    async (diagnostic) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["nextjs"]\n',
            'package.json': '{"private":true}\n',
            'tsconfig.json': '{}\n',
        });
        const session = await openSession(directory.path);
        const spec = session.manifests.get('nextjs')!.checks.find((entry) => entry.name === 'nextjs/typecheck')!;
        const input: EngineInput = engineInput(session, {
            scope: session.scopes.find((entry) => entry.scope.path === '')!,
            spec: spec,
            files: session.repository.files,
        });
        let scratch = '';
        const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
        const run = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
            scratch = options.cwd;
            writeFileSync(join(scratch, 'tsconfig.json'), 'partial generator output\n');
            writeFileSync(join(directory.path, 'tsconfig.json'), 'Concurrent developer edit\n');
            return { code: 1, missing: false, duration: 1, stdout: '', stderr: `Error: ${diagnostic}` };
        });
        try {
            await expect(nextjsTypes(input)).rejects.toThrow(diagnostic);
            expect(scratch).not.toBe('');
            expect(existsSync(scratch)).toBe(false);
            expect(readFileSync(join(directory.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
            expect(existsSync(join(directory.path, 'next-env.d.ts'))).toBe(false);
        } finally {
            locate.mockRestore();
            run.mockRestore();
        }
    },
);
