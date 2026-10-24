import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readdir, writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

test.each(['fresh', 'stale-cli', 'stale-plugin'])(
    'the integration preload validates %s packed versions before running tests',
    async (state) => {
        await using sandbox = await testdir();
        await writePreloadFiles(sandbox.path, state);
        const suite = join(sandbox.path, 'child.test.ts');
        await writeFile(
            suite,
            `import { test, expect } from 'bun:test'; test('starts', () => expect(process.env.MISE_STATE_DIR).toBe(${JSON.stringify(join(sandbox.path, 'mise-state'))}));`,
        );
        const child = await runCommand(
            [process.execPath, 'test', '--preload', join(sandbox.path, 'preload.ts'), suite],
            { cwd: REPOSITORY_ROOT },
        );
        if (state === 'fresh') expect(child.code, child.stdout + child.stderr).toBe(0);
        else {
            expect(child.code).toBe(1);
            expect(child.stdout + child.stderr).toContain(
                'The packed packages are stale. Run mise run test integration or mise run test e2e first.',
            );
            expect(child.stdout + child.stderr).not.toContain('(pass) starts');
        }
    },
);

test.skipIf(isWindows)('SIGINT disposes integration resources and exits before the following test', async () => {
    await using sandbox = await testdir({ temp: {} });
    await writePreloadFiles(sandbox.path, 'fresh');
    const suite = join(sandbox.path, 'child.test.ts');
    await writeFile(
        suite,
        "import { test } from 'bun:test'; test('interrupts', async () => { process.kill(process.pid, 'SIGINT'); await new Promise(() => {}); }); test('never starts', () => { throw new Error('Later test ran'); });",
    );
    const child = await runCommand([process.execPath, 'test', '--preload', join(sandbox.path, 'preload.ts'), suite], {
        cwd: REPOSITORY_ROOT,
        env: { TMPDIR: join(sandbox.path, 'temp') },
    });
    expect(child.code, child.stdout + child.stderr).toBe(130);
    expect(child.stdout + child.stderr).not.toContain('Later test ran');
    expect(await readdir(join(sandbox.path, 'temp'))).toStrictEqual([]);
});

async function writePreloadFiles(root: string, state: string): Promise<void> {
    await writeFile(
        join(root, 'packages.json'),
        JSON.stringify(
            [cliPackage, eslintPluginPackage].map(({ name, version }) => ({
                name,
                version:
                    (state === 'stale-cli' && name === cliPackage.name) ||
                    (state === 'stale-plugin' && name === eslintPluginPackage.name)
                        ? '0.0.0-stale'
                        : version,
                filename: '',
                integrity: '',
            })),
        ),
    );
    await writeFile(join(root, 'tool-paths.txt'), '');
    const runFolderModule = join(REPOSITORY_ROOT, 'tests/setup/runner/run-folder.ts');
    const preload = join(REPOSITORY_ROOT, 'tests/setup/runner/integration.ts');
    await writeFile(
        join(root, 'preload.ts'),
        `import { mock } from 'bun:test'; await mock.module(${JSON.stringify(runFolderModule)}, () => ({ TEST_RUN_FOLDER: ${JSON.stringify(root)}, REPOSITORY_ROOT: ${JSON.stringify(REPOSITORY_ROOT)} })); await import(${JSON.stringify(preload)});`,
    );
}
