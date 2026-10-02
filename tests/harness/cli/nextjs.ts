// Next.js projects for disposable build verification.
import executables from 'which';
import { join } from 'node:path';
import { spyOn } from 'bun:test';
import { createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Prepare tracked and untracked output for disposable Next.js build checks.
 * @param root the sandbox root
 * @param scope the selected project path
 * @param check the Next.js check to plan
 * @returns the check input with repository reads
 */
export async function prepareNextjsBuild(root: string, scope: string, check: string): Promise<EngineInput> {
    const scopeTable = scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`;
    await createFileTree(root, {
        'gspot.toml': policyOf(['nextjs'], scopeTable),
        [join(scope, 'package.json')]: '{"private":true,"dependencies":{"next":"16.3.5"}}\n',
        [join(scope, 'tsconfig.json')]: '{"compilerOptions":{"strict":true}}\n',
        [join(scope, 'next-env.d.ts')]: '// Authored type declaration\n',
        [join(scope, '.next/types/routes.d.ts')]: '// Retained route types\n',
        [join(scope, 'src/page.ts')]: 'bad input\n',
        'unrelated/private.txt': 'Preserve unrelated scope\n',
    });
    commitAll(root);
    writeFileSync(join(root, join(scope, '.next/local-cache.bin')), Buffer.from([0, 255, 1, 2]));
    const session = await openSession(root);
    const spec = session.manifests.get('nextjs')!.checks.find((entry) => entry.name === check)!;
    const input: EngineInput = scopeInput(session, spec, scope);
    chmodSync(join(root, join(scope, 'tsconfig.json')), 0o640);
    return input;
}

/**
 * Read native commands while simulating generated files and compiler diagnostics.
 * @param check the Next.js command whose diagnostic format to simulate
 * @returns reads and a disposer that restores the process boundaries
 */
export function readNextjsCommands(check: string): {
    directories: string[];
    inspections: string[][];
    routesSeen: string[];
    [Symbol.dispose]: () => void;
} {
    const failureOutput = {
        stdout: check === 'nextjs/typecheck' ? 'src/page.ts(1,1): error TS2322: Type mismatch\n' : '',
        stderr: check === 'nextjs/build' ? 'Error: Page is invalid\n' : '',
    };
    const directories: string[] = [];
    // What the mocked commands were asked and saw, asserted once the check has run.
    const inspections: string[][] = [];
    const routesSeen: string[] = [];
    const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const runBlocking = processes.runBlocking;
    const inspection = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] === 'git') return runBlocking(command, options);
        inspections.push(command.slice(1));
        return { code: 0, missing: false, duration: 1, stdout: 'Version 5.9.3', stderr: '' };
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
        inspections,
        routesSeen,
        [Symbol.dispose]() {
            inspection.mockRestore();
            locate.mockRestore();
            run.mockRestore();
        },
    };
}
