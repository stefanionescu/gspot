// Next.js projects for installed consumers and disposable build verification.
import executables from 'which';
import { spyOn } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import type { EngineInput } from '#cli/types/checks.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { linkInstalledModules } from '#tests/support/cli/platforms.ts';
import type { NextjsRead } from '#tests/types/integration/cli/checks.ts';
import { NEXT_PAGE, NEXT_CONFIG, NEXT_LAYOUT } from '#tests/inputs/cli.ts';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { INSTALLED_MODULES, INSTALLED_BIN_PATH } from '#tests/support/cli/modules.ts';

/** init selecting nextjs without the recommendations the tests leave out. */
const NEXT_INIT = initArgs(['nextjs'], ['naming', 'spelling', 'css', 'files']); /**
 * Plants the project beside this repository's node_modules, initializes it, and sets the all level.
 * @returns the sandbox and the environment its commands run with
 */
export async function installedNextProject(): Promise<{
    sandbox: Awaited<ReturnType<typeof testdir>>;
    environment: Record<string, string>;
}> {
    // Webpack requires the linked dependencies and the sandbox to share a drive.
    const sandbox = await testdir(
        {},
        { dirname: join(join(INSTALLED_MODULES, '../..'), 'gspot-test-' + randomUUID()) },
    );
    try {
        await createFileTree(sandbox.path, {
            '.gitignore': 'node_modules\n.next\n',
            'package.json': `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "next": "16.3.5",\n        "next-intl": "4.3.9",\n        "react": "19.1.1",\n        "react-dom": "19.1.1"\n    }\n}\n`,
            'tsconfig.json':
                '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": ["DOM", "DOM.Iterable", "ES2022"],\n        "noEmit": true,\n        "plugins": [{ "name": "next" }]\n    },\n    "include": ["app"]\n}\n',
            'next.config.mjs': NEXT_CONFIG,
            'app/page.tsx': NEXT_PAGE,
            'app/layout.tsx': NEXT_LAYOUT,
            'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
            'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
        });
        linkInstalledModules(join(sandbox.path, 'node_modules'));
        commitAll(sandbox.path);
        const environment = {
            PATH: `${INSTALLED_BIN_PATH}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
        };
        await install(sandbox.path, NEXT_INIT, environment);
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        if (selected.code !== 0)
            throw new Error(`Next.js setup failed (${String(selected.code)}): ${selected.stdout}${selected.stderr}`);
        return { sandbox, environment };
    } catch (error) {
        await sandbox[Symbol.asyncDispose]();
        throw error;
    }
}

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
    const input: EngineInput = engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === scope)!,
        spec: spec,
        files: session.repository.files,
    });
    chmodSync(join(root, join(scope, 'tsconfig.json')), 0o640);
    return input;
}

/**
 * Read native commands while simulating generated files and compiler diagnostics.
 * @param check the Next.js command whose diagnostic format to simulate
 * @returns reads and a disposer that restores the process boundaries
 */
export function readNextjsCommands(check: string): NextjsRead {
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
