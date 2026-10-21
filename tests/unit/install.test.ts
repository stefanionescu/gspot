import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { runCommand } from '#tests/setup/processes.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { symlink, readFile, writeFile } from 'node:fs/promises';
import { installSandbox, runSandboxStep } from '#tests/setup/install.ts';
import { TEST_RUN_FOLDER_NAME, TEST_RUN_FOLDER_SCRIPT } from '#tests/data/test-setup.ts';

test('each checkout has a distinct stable folder for its test-run packages and launcher', async () => {
    const source = await readFile(new URL('../setup/install.ts', import.meta.url), 'utf8');
    const config = fileURLToPath(new URL('../../tsconfig.json', import.meta.url));
    const modules = fileURLToPath(new URL('../node_modules', import.meta.url));
    await using sandbox = await testdir();
    const checkouts = ['first', 'second'].map((name) => join(sandbox.path, name));
    for (const root of checkouts) {
        await createFileTree(root, {
            'tests/setup/install.ts': source,
            'tsconfig.json': JSON.stringify({ extends: config }),
            'package.json': '{"private":true,"type":"module"}',
        });
        await symlink(modules, join(root, 'node_modules'), isWindows ? 'junction' : 'dir');
    }
    const results = [];
    for (const root of [...checkouts, checkouts[0]!]) {
        const result = await runCommand(
            [
                process.execPath,
                '--eval',
                TEST_RUN_FOLDER_SCRIPT,
                pathToFileURL(join(root, 'tests/setup/install.ts')).href,
            ],
            { cwd: sandbox.path },
        );
        expect(result.code, result.stdout + result.stderr).toBe(0);
        results.push(result.stdout.trim());
    }
    expect(results[0]).not.toBe(results[1]);
    expect(results[0]).toBe(results[2]);
    for (const folder of results) expect(folder).toStartWith(join(tmpdir(), `${TEST_RUN_FOLDER_NAME}-`));
});

test('a required sandbox command returns its output and names the command and root on failure', async () => {
    const success = { code: 0, stdout: 'success output\n', stderr: 'success detail\n' };
    const failed = { code: 7, stdout: 'partial output\n', stderr: 'failure detail\n' };
    const sandbox: Sandbox = {
        root: '/sandbox/project',
        environment: {},
        run: (_root, commandArguments) => Promise.resolve(commandArguments[0] === 'apply' ? success : failed),
    };
    expect(await runSandboxStep(sandbox, ['apply'])).toBe(success);
    const failure: unknown = await runSandboxStep(sandbox, ['install', '--json']).catch((error: unknown) => error);
    expect(failure).toMatchObject({
        message: 'gspot install --json failed in /sandbox/project:\npartial output\nfailure detail\n',
    });
});

test('sandbox installation returns init JSON, applies its options, and prepares files without installing tools', async () => {
    await using folder = await testdir();
    const sandbox: Sandbox = { root: folder.path, environment: {}, run: runGspot };
    const output = await installSandbox(sandbox, {
        configurations: ['bash'],
        level: 'recommended',
        without: ['bash'],
        install: false,
        prepare: async (root) => {
            await writeFile(join(root, 'prepared.txt'), 'Prepared with the installed settings.\n');
        },
    });
    expect(output.code).toBe(0);
    const initialized: unknown = JSON.parse(output.stdout);
    expect(initialized).toBeObject();
    const settings = readSettings(folder.path).settings;
    expect(settings.level).toBe('recommended');
    expect(settings.configurations).not.toContain('bash');
    expect(await readFile(join(folder.path, 'prepared.txt'), 'utf8')).toBe('Prepared with the installed settings.\n');
});
