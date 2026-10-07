import executables from 'which';
import { join, basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { nextBuild, nextTypes } from '#cli/checks/framework/nextjs.ts';
import type { NextjsCommands } from '#tests/types/cli/checks/framework/nextjs.ts';
import { statSync, chmodSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Replace executable lookup and both process runners until disposal. Simulate generated files and diagnostics.
 * @param check the Next.js command whose diagnostic format to simulate
 * @returns captured commands and a disposer that restores the mocked boundaries
 */
function mockNextjsCommands(check: string): NextjsCommands {
    const failureOutput = {
        stdout: check === 'nextjs/tsc' ? 'src/page.ts(1,1): error TS2322: Type mismatch\n' : '',
        stderr: check === 'nextjs/build' ? 'Error: Page is invalid\n' : '',
    };
    const directories: string[] = [];
    // What the mocked commands were asked and saw, asserted once the check has run.
    const routesSeen: string[] = [];
    const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const runBlocking = processes.runBlocking;
    const inspection = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] === 'git') return runBlocking(command, options);
        return {
            code: 0,
            missing: false,
            duration: 1,
            stdout: basename(command[0] ?? '') === 'next' ? 'Next.js v16.3.5' : 'Version 5.9.3',
            stderr: '',
        };
    });
    const run = spyOn(processes, 'run').mockImplementation((command, options) => {
        const cwd = options.cwd;
        directories.push(cwd);
        const isBad = readFileSync(join(cwd, 'src/page.ts'), 'utf8').includes('bad');
        if (['typegen', 'build'].includes(command[1] ?? '')) {
            writeFileSync(join(cwd, 'tsconfig.json'), '{}\n');
            writeFileSync(join(cwd, 'next-env.d.ts'), '// Generated\n');
            mkdirSync(join(cwd, '.next/types'), { recursive: true });
            writeFileSync(join(cwd, '.next/types/routes.d.ts'), '// Generated routes\n');
        } else routesSeen.push(readFileSync(join(cwd, '.next/types/routes.d.ts'), 'utf8'));
        const failed = isBad && command[1] !== 'typegen';
        return Promise.resolve({
            code: failed ? 1 : 0,
            missing: false,
            duration: 1,
            ...(failed ? failureOutput : { stdout: '', stderr: '' }),
        });
    });
    return {
        directories,
        routesSeen,
        [Symbol.dispose]() {
            inspection.mockRestore();
            locate.mockRestore();
            run.mockRestore();
        },
    };
}

for (const scope of ['', 'apps/web'])
    for (const check of ['nextjs/tsc', 'nextjs/build'])
        test(`Next.js output preservation in ${scope || 'root'}: ${check} reports a defect, accepts its correction, and preserves source output`, async () => {
            await using directory = await testdir();
            const input = await prepareNextjsBuild(directory.path, scope, check);
            const untracked = join(directory.path, join(scope, '.next/local-cache.bin'));
            const config = join(directory.path, join(scope, 'tsconfig.json'));
            const original = readFileSync(config);
            const mode = statSync(config).mode;
            using read = mockNextjsCommands(check);
            const { directories, routesSeen } = read;
            const execute = check === 'nextjs/tsc' ? nextTypes : nextBuild;
            const found = await execute(input);
            expect(found).toHaveLength(1);
            expect(found[0]).toMatchObject({
                check,
                file: toPosix(join(scope, check === 'nextjs/tsc' ? 'src/page.ts' : 'package.json')),
                line: 1,
            });
            expect(found[0]!.message).toBe(
                check === 'nextjs/tsc' ? 'Type mismatch' : 'next build failed: Error: Page is invalid',
            );
            writeFileSync(join(directory.path, join(scope, 'src/page.ts')), 'corrected input\n');
            expect(await execute(input)).toStrictEqual([]);
            expect(directories).not.toContain(join(directory.path, scope));
            expect(routesSeen.every((text) => text === '// Generated routes\n')).toBe(true);
            expect(directories.every((cwd) => !existsSync(cwd))).toBe(true);
            expect(readFileSync(config)).toStrictEqual(original);
            expect(statSync(config).mode).toBe(mode);
            expect(readFileSync(untracked)).toStrictEqual(Buffer.from([0, 255, 1, 2]));
            expect(readFileSync(join(directory.path, join(scope, 'next-env.d.ts')), 'utf8')).toBe(
                '// Authored type declaration\n',
            );
            expect(readFileSync(join(directory.path, join(scope, '.next/types/routes.d.ts')), 'utf8')).toBe(
                '// Retained route types\n',
            );
            expect(readFileSync(join(directory.path, 'unrelated/private.txt'), 'utf8')).toBe(
                'Preserve unrelated scope\n',
            );
        });

test('failed type generation cleans the isolated copy without restoring over source edits', async () => {
    const diagnostic = 'Generator failed';
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
        'node_modules/.bin/next': '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n',
    });
    const session = await openSession(directory.path);
    const check = session.manifests.get('nextjs')!.checks.find((entry) => entry.name === 'nextjs/tsc')!;
    const input: CheckInput = buildCheckInput(session, check.name);
    let scratch = '';
    const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const runBlocking = processes.runBlocking;
    const inspection = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (basename(command[0] ?? '') !== 'next') return runBlocking(command, options);
        return { code: 0, missing: false, duration: 1, stdout: 'Next.js v16.3.5', stderr: '' };
    });
    const run = spyOn(processes, 'run').mockImplementation((_command, options) => {
        scratch = options.cwd;
        writeFileSync(join(scratch, 'tsconfig.json'), 'partial generator output\n');
        writeFileSync(join(directory.path, 'tsconfig.json'), 'Concurrent developer edit\n');
        return Promise.resolve({
            code: 1,
            missing: false,
            duration: 1,
            stdout: '',
            stderr: `Error: ${diagnostic}`,
        });
    });
    try {
        expect(await rejection(nextTypes(input))).toContain(diagnostic);
        expect(scratch).not.toBe('');
        expect(existsSync(scratch)).toBe(false);
        expect(readFileSync(join(directory.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
        expect(existsSync(join(directory.path, 'next-env.d.ts'))).toBe(false);
    } finally {
        inspection.mockRestore();
        locate.mockRestore();
        run.mockRestore();
    }
});

// Next.js projects for disposable build verification.

/**
 * Prepare tracked and untracked output for disposable Next.js build checks.
 * @param root the sandbox root
 * @param scope the selected project path
 * @param checkId the Next.js check to plan
 * @returns the check input with repository reads
 */
async function prepareNextjsBuild(root: string, scope: string, checkId: string): Promise<CheckInput> {
    const scopeTable = scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`;
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['nextjs'], { tables: scopeTable }),
        [join(scope, 'package.json')]: '{"private":true,"dependencies":{"next":"16.3.5"}}\n',
        [join(scope, 'tsconfig.json')]: '{"compilerOptions":{"strict":true}}\n',
        [join(scope, 'next-env.d.ts')]: '// Authored type declaration\n',
        [join(scope, '.next/types/routes.d.ts')]: '// Retained route types\n',
        [join(scope, 'src/page.ts')]: 'bad input\n',
        'node_modules/.bin/next': '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n',
        'unrelated/private.txt': 'Preserve unrelated scope\n',
    });
    commitAll(root);
    writeFileSync(join(root, join(scope, '.next/local-cache.bin')), Buffer.from([0, 255, 1, 2]));
    const session = await openSession(root);
    const check = session.manifests.get('nextjs')!.checks.find((entry) => entry.name === checkId)!;
    const input: CheckInput = buildCheckInput(session, check.name, { scope: scope });
    chmodSync(join(root, join(scope, 'tsconfig.json')), 0o640);
    return input;
}
