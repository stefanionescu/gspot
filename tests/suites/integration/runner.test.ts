import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readdir, writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { buildProgramArguments } from '#tests/setup/system/programs.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

test.each(['fresh', 'stale-cli', 'stale-plugin'])(
    'the integration preload validates %s packed versions before running tests',
    async (state) => {
        await using sandbox = await testdir();
        await writeRunFolder(sandbox.path, state);
        const child = await runCommand(
            [
                process.execPath,
                'test',
                '--preload',
                ...buildProgramArguments('runner/preload'),
                ...buildProgramArguments('runner/environment.test'),
            ],
            { cwd: REPOSITORY_ROOT, env: { TEST_RUN_FOLDER: sandbox.path } },
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
    await writeRunFolder(sandbox.path, 'fresh');
    const child = await runCommand(
        [
            process.execPath,
            'test',
            '--preload',
            ...buildProgramArguments('runner/preload'),
            ...buildProgramArguments('runner/interrupt.test'),
        ],
        { cwd: REPOSITORY_ROOT, env: { TMPDIR: join(sandbox.path, 'temp'), TEST_RUN_FOLDER: sandbox.path } },
    );
    expect(child.code, child.stdout + child.stderr).toBe(130);
    expect(child.stdout + child.stderr).not.toContain('Later test ran');
    expect(await readdir(join(sandbox.path, 'temp'))).toStrictEqual([]);
});

async function writeRunFolder(root: string, state: string): Promise<void> {
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
}
