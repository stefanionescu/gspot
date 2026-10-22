import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/projects.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { FAILED_INSTALL_CASES, PACKAGE_MANAGER_TIMEOUT } from '#tests/data/install/npm/project.ts';
import { installNpmTools, prepareNpmLockfile, assertPackageManagerVersion } from '#cli/install/npm/project.ts';

/**
 * Fake bun 1.4.2, and fail every other bun run.
 *
 * @param failure what a failed run prints, or that it ran out of time.
 * @returns the mock, which restores bun when disposed.
 */
function fakeFailingBun(failure: Partial<Pick<SpawnResult, 'stdout' | 'stderr' | 'timedOut'>>): Disposable {
    return fakeCommand('bun', (command) =>
        Promise.resolve(
            buildProcessResult(
                command[1] === '--version'
                    ? { code: 0, missing: false, duration: 0, stdout: '1.4.2\n', stderr: '' }
                    : { code: 1, missing: false, duration: 0, stdout: '', stderr: '', ...failure },
            ),
        ),
    );
}

/** Wrap package.json text as the generated tool project file. */
function buildNpmConfigFile(content: string): GeneratedFile {
    return { path: '.gspot/package.json', content };
}

test.each([...FAILED_INSTALL_CASES])(
    'a failed $operation keeps the files and hides credentials',
    async ({ frozen, operation }) => {
        const refusal = 'HTTP 403 Forbidden';
        await using sandbox = await testdir();
        const token = 'synthetic-registry-failure-token';
        const password = 'synthetic-registry-password/with spaces';
        const registry = `https://alex:${encodeURIComponent(password)}@registry.example.com/`;
        const source = `registry=${registry}\n//registry.example.com/:_authToken=${token}\n`;
        const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
        const original = frozen
            ? packageJson
            : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
        const lockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: frozen ? '3.8.1' : '3.8.0' } } },
        });
        await createFileTree(sandbox.path, {
            '.npmrc': source,
            'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
            '.gspot/package.json': original,
            '.gspot/bun.lock': lockfile,
        });
        await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
        const session = await openSession(sandbox.path);
        using owner = openWriter(sandbox.path);
        using resources = new DisposableStack();
        resources.use(
            fakeFailingBun({
                stdout: `Downloading ${registry}private-check-tool\n${password}\n${token}`,
                stderr: `${refusal} from ${registry}private-check-tool`,
            }),
        );
        const installationError = await (
            frozen
                ? installNpmTools(buildToolInstall(session, owner))
                : prepareNpmLockfile(buildToolInstall(session, owner), buildNpmConfigFile(packageJson), undefined)
        ).catch((error: unknown) => error);
        expect(installationError).toBeInstanceOf(Error);
        expect(installationError).toMatchObject({
            name: 'GspotError',
            code: 'install',
            message: `bun ${operation} failed (exit 1).\nDownloading https://[redacted]@registry.example.com/private-check-tool\n[redacted]\n[redacted]\n${refusal} from https://[redacted]@registry.example.com/private-check-tool`,
        });
        expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe(original);
        expect(await readFile(join(sandbox.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
    },
);

test('an npm install that runs past the time limit names the limit', async () => {
    await using sandbox = await testdir();
    const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        '.gspot/package.json': packageJson,
        '.gspot/bun.lock': JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.1' } } } }),
    });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    using _bun = fakeFailingBun({ timedOut: true });
    expect(await captureRejection(installNpmTools(buildToolInstall(session, owner)))).toBe(
        `The command bun install --frozen-lockfile --linker hoisted ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
    );
});

test.each([false, true])('credentials in a lockfile are refused: $name', async (frozen) => {
    await using sandbox = await testdir();
    const token = 'synthetic-generated-lockfile-token';
    const source = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${token}\n`;
    const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
    const credentialLockfile = JSON.stringify({
        workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
        packages: { prettier: ['prettier@3.8.1', `https://registry.example.com/${token}`, {}, 'integrity'] },
    });
    const original = frozen ? packageJson : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
    const lockfile = frozen
        ? credentialLockfile
        : JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.0' } } } });
    await createFileTree(sandbox.path, {
        '.npmrc': source,
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        '.gspot/package.json': original,
        '.gspot/bun.lock': lockfile,
        '.gspot/node_modules/authored.txt': 'keep installed files',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    using boundary = fakeCommand('bun', async (command, options) => {
        if (!frozen && command[1] !== '--version') await writeFile(join(options.cwd, 'bun.lock'), credentialLockfile);
        return buildProcessResult({
            code: 0,
            missing: false,
            duration: 0,
            stdout: command[1] === '--version' ? '1.4.2\n' : '',
            stderr: '',
        });
    });
    const message = await captureRejection(
        prepareNpmLockfile(buildToolInstall(session, owner), buildNpmConfigFile(packageJson), undefined),
    );
    expect(message).toBe(
        frozen
            ? 'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.'
            : 'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.',
    );
    expect(message).not.toContain(token);
    expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe(original);
    expect(await readFile(join(sandbox.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
    expect(await readFile(join(sandbox.path, '.gspot/node_modules/authored.txt'), 'utf8')).toBe('keep installed files');
    if (frozen) expect(boundary).not.toHaveBeenCalled();
    else expect(boundary).toHaveBeenCalled();
});

test('a missing Node stops npm before it writes a lockfile and keeps a cached lockfile', async () => {
    const packageJson = JSON.stringify({
        ...NPM_TOOL_PROJECT,
        devDependencies: { prettier: '3.8.1' },
    });
    const lockfile = JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.1' } } } });
    await using sandbox = await testdir({
        'source.txt': 'kept\n',
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using _path = overrideEnvironment({
        PATH: join(sandbox.path, 'missing-bin'),
        MISE_DATA_DIR: join(sandbox.path, 'missing-mise'),
    });
    using owner = openWriter(sandbox.path);
    const message = await captureRejection(
        prepareNpmLockfile(buildToolInstall(session, owner), buildNpmConfigFile(packageJson), undefined),
    );
    expect(message).toBe('The npm tool project needs Node.js to create its lockfile. Install Node.js.');
    expect(await isOnDisk(join(sandbox.path, '.gspot/package.json'))).toBe(false);
    await createFileTree(sandbox.path, { ['.gspot/package.json']: packageJson, '.gspot/bun.lock': lockfile });
    const cached = await prepareNpmLockfile(
        buildToolInstall(session, owner),
        buildNpmConfigFile(packageJson),
        undefined,
    );
    expect(cached.content).toBe(lockfile);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('kept\n');
    expect(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe(packageJson);
    expect(await readFile(join(sandbox.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
});
test('a package manager version timeout names the install command and configured limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    const context = buildToolInstall(session, owner);
    using _bun = fakeCommand('bun', () => Promise.resolve(buildProcessResult(PACKAGE_MANAGER_TIMEOUT)));
    expect(await captureRejection(assertPackageManagerVersion(context))).toBe(
        `The command bun --version ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
    );
    expect(context.steps).toStrictEqual([['bun', '--version']]);
});
