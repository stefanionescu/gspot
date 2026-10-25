import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { openWriter } from '#cli/apply/write/writer.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import type { NpmToolInstall } from '#cli/types/install/npm.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';
import { FAILED_INSTALL_CASES } from '#tests/config/install/npm/project.ts';
import { PACKAGE_MANAGER_ARGUMENTS } from '#cli/config/install/npm/project.ts';
import { installNpmTools, prepareNpmLockfile } from '#cli/install/npm/project.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function fakeFailingBun(failure: Partial<Pick<SpawnResult, 'stdout' | 'stderr' | 'timedOut'>>): Disposable {
    return fakeCommand('mise', (command) =>
        Promise.resolve(
            buildProcessResult(command.at(-1) === '--version' ? { stdout: '1.4.2\n' } : { code: 1, ...failure }),
        ),
    );
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
        const packageJson = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.1' } });
        const original = frozen
            ? packageJson
            : JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.0' } });
        const lockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: frozen ? '3.8.1' : '3.8.0' } } },
        });
        await createFileTree(sandbox.path, {
            '.npmrc': source,
            'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
            [GSPOT_PATHS.npmProject]: original,
            [`${DOT_GSPOT}/bun.lock`]: lockfile,
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
        const installationError = await captureRejection(
            frozen
                ? installNpmTools(buildToolInstall(session, owner) as NpmToolInstall)
                : prepareNpmLockfile(
                      buildToolInstall(session, owner) as NpmToolInstall,
                      { path: GSPOT_PATHS.npmProject, content: packageJson },
                      undefined,
                  ),
        );
        expect(installationError).toMatchObject({
            name: 'GspotError',
            code: 'install',
            message: `bun ${operation} failed (exit 1).\nDownloading https://[redacted]@registry.example.com/private-check-tool\n[redacted]\n[redacted]\n${refusal} from https://[redacted]@registry.example.com/private-check-tool`,
        });
        expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(original);
        expect(await readFile(join(sandbox.path, `${DOT_GSPOT}/bun.lock`), 'utf8')).toBe(lockfile);
    },
);

test('an npm install that runs past the time limit names the limit', async () => {
    await using sandbox = await testdir();
    const packageJson = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.1' } });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: packageJson,
        [`${DOT_GSPOT}/bun.lock`]: JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.1' } } } }),
    });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    using _bun = fakeFailingBun({ timedOut: true });
    const installNpmToolsError = await captureRejection(
        installNpmTools(buildToolInstall(session, owner) as NpmToolInstall),
    );
    const message = installNpmToolsError.message;
    expect(message).toStartWith(
        'The command mise exec node@24 bun@1.4.2 -- bun install --frozen-lockfile --linker hoisted --config=',
    );
    expect(message).toEndWith(
        `bunfig.toml ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
    );
});

test.each([false, true])('credentials in a lockfile are refused (frozen install: %p)', async (frozen) => {
    await using sandbox = await testdir();
    const token = 'synthetic-generated-lockfile-token';
    const source = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${token}\n`;
    const packageJson = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.1' } });
    const credentialLockfile = JSON.stringify({
        workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
        packages: { prettier: ['prettier@3.8.1', `https://registry.example.com/${token}`, {}, 'integrity'] },
    });
    const original = frozen
        ? packageJson
        : JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.0' } });
    const lockfile = frozen
        ? credentialLockfile
        : JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.0' } } } });
    await createFileTree(sandbox.path, {
        '.npmrc': source,
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: original,
        [`${DOT_GSPOT}/bun.lock`]: lockfile,
        [`${GSPOT_PATHS.nodeModules}/authored.txt`]: 'keep installed files',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    using boundary = fakeCommand('mise', async (command, options) => {
        if (!frozen && command.at(-1) !== '--version')
            await writeFile(join(options.cwd, 'bun.lock'), credentialLockfile);
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '1.4.2\n' : '' });
    });
    const prepareNpmLockfileError = await captureRejection(
        prepareNpmLockfile(
            buildToolInstall(session, owner) as NpmToolInstall,
            { path: GSPOT_PATHS.npmProject, content: packageJson },
            undefined,
        ),
    );
    const message = prepareNpmLockfileError.message;
    expect(message).toBe(
        frozen
            ? 'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.'
            : 'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.',
    );
    expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(original);
    expect(await readFile(join(sandbox.path, `${DOT_GSPOT}/bun.lock`), 'utf8')).toBe(lockfile);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.nodeModules}/authored.txt`), 'utf8')).toBe(
        'keep installed files',
    );
    if (frozen) expect(boundary).not.toHaveBeenCalled();
    else expect(boundary).toHaveBeenCalled();
});

test('a missing Node stops npm before it writes a lockfile and keeps a cached lockfile', async () => {
    const packageJson = JSON.stringify({
        ...NPM_TOOL_PROJECT,
        devDependencies: { prettier: '3.8.1' },
    });
    const lockfile = JSON.stringify({
        workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
        packages: { prettier: ['prettier@3.8.1', '', {}, 'sha512-YQ=='] },
    });
    await using sandbox = await testdir({ 'package.json': '{"private":true,"packageManager":"bun@1.4.2"}' });
    await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using _path = overrideEnvironment({
        PATH: join(sandbox.path, 'missing-bin'),
        MISE_DATA_DIR: join(sandbox.path, 'missing-mise'),
    });
    using owner = openWriter(sandbox.path);
    const lockfileError = await captureRejection(
        prepareNpmLockfile(
            buildToolInstall(session, owner) as NpmToolInstall,
            { path: GSPOT_PATHS.npmProject, content: packageJson },
            undefined,
        ),
    );
    const message = lockfileError.message;
    expect(message).toBe('The npm tool project needs Node.js to create its lockfile. Install Node.js.');
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.npmProject))).toBe(false);
    await createFileTree(sandbox.path, { [GSPOT_PATHS.npmProject]: packageJson, [`${DOT_GSPOT}/bun.lock`]: lockfile });
    const cached = await prepareNpmLockfile(
        buildToolInstall(session, owner) as NpmToolInstall,
        { path: GSPOT_PATHS.npmProject, content: packageJson },
        undefined,
    );
    expect(cached.content).toBe(lockfile);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(packageJson);
    expect(await readFile(join(sandbox.path, `${DOT_GSPOT}/bun.lock`), 'utf8')).toBe(lockfile);
});
test('a Yarn Classic repository resolves its tool lockfile with npm and the release hold', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
    });
    const run = processes.spawnProcessBlocking;
    using _version = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[0] === 'npm' ? buildProcessResult({ stdout: '11.19.0\n' }) : run(command, options),
    );
    using _npm = fakeCommand('npm', async (command, options) => {
        if (command[1] !== '--version')
            await writeFile(
                join(options.cwd, 'package-lock.json'),
                JSON.stringify({ lockfileVersion: 3, packages: { '': { devDependencies: {} } } }),
            );
        return buildProcessResult({ stdout: command[1] === '--version' ? '11.19.0\n' : '' });
    });
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const install = buildToolInstall(session, writer) as NpmToolInstall;
    const lockfile = await prepareNpmLockfile(
        install,
        { path: GSPOT_PATHS.npmProject, content: JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: {} }) },
        undefined,
    );
    expect(JSON.parse(lockfile.content)).toStrictEqual({
        lockfileVersion: 3,
        packages: { '': { devDependencies: {} } },
    });
    expect(install.steps).toStrictEqual([
        [
            ...PACKAGE_MANAGER_ARGUMENTS.npm.lockfile,
            '--min-release-age=7',
            '--min-release-age-exclude=@gspothq/cli',
            '--min-release-age-exclude=@gspothq/eslint-plugin',
        ],
    ]);
});
