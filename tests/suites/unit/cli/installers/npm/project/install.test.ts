import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { openWriter } from '#cli/repository/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildNpmToolInstall } from '#tests/setup/cli/tools.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';
import { PACKAGE_MANAGER_ARGUMENTS } from '#cli/config/installers/npm/project.ts';
import { installNpmTools, prepareNpmLockfile } from '#cli/installers/npm/project.ts';

import {
    CREDENTIAL_TOKEN,
    CREDENTIAL_LOCKFILE,
    FAILED_INSTALL_CASES,
    CREDENTIAL_PACKAGE_JSON,
} from '#tests/config/installers/npm/project.ts';

async function prepareCredentialProject(root: string, packageJson: string, lockfile: string) {
    const files = {
        '.npmrc': `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${CREDENTIAL_TOKEN}\n`,
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: packageJson,
        [`${GSPOT_FOLDER}/bun.lock`]: lockfile,
        [`${GSPOT_PATHS.nodeModules}/authored.txt`]: 'keep installed files',
        'gspot.toml': buildSandboxSettings([]),
    };
    await createFileTree(root, files);
    using owner = openWriter(root);
    const session = await openSession(root);
    const install = await buildNpmToolInstall(session, owner);
    const error = await captureRejection(
        prepareNpmLockfile(install, { path: GSPOT_PATHS.npmProject, content: CREDENTIAL_PACKAGE_JSON }),
    );
    return { files, error };
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
        const previous = frozen
            ? packageJson
            : JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.0' } });
        const lockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: frozen ? '3.8.1' : '3.8.0' } } },
        });
        await createFileTree(sandbox.path, {
            '.npmrc': source,
            'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
            [GSPOT_PATHS.npmProject]: previous,
            [`${GSPOT_FOLDER}/bun.lock`]: lockfile,
            'gspot.toml': buildSandboxSettings([]),
        });
        const session = await openSession(sandbox.path);
        using owner = openWriter(sandbox.path);
        const failure = {
            stdout: `Downloading ${registry}private-check-tool\n${password}\n${token}`,
            stderr: `${refusal} from ${registry}private-check-tool`,
        };
        using _bun = fakeCommand('mise', (command) =>
            Promise.resolve(
                buildProcessResult(command.at(-1) === '--version' ? { stdout: '1.4.2\n' } : { code: 1, ...failure }),
            ),
        );
        const install = await buildNpmToolInstall(session, owner);
        const installationError = await captureRejection(
            frozen
                ? installNpmTools(install)
                : prepareNpmLockfile(install, { path: GSPOT_PATHS.npmProject, content: packageJson }),
        );
        expect(installationError).toMatchObject({
            name: 'GspotError',
            code: 'install',
            message: `bun ${operation} failed (exit 1).\nDownloading https://[redacted]@registry.example.com/private-check-tool\n[redacted]\n[redacted]\n${refusal} from https://[redacted]@registry.example.com/private-check-tool`,
        });
        expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(previous);
        expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/bun.lock`), 'utf8')).toBe(lockfile);
    },
);

test('an npm install that runs past the time limit names the limit', async () => {
    await using sandbox = await testdir();
    const packageJson = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.1' } });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: packageJson,
        [`${GSPOT_FOLDER}/bun.lock`]: JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
        }),
    });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    using _bun = fakeCommand('mise', (command) =>
        Promise.resolve(
            buildProcessResult(command.at(-1) === '--version' ? { stdout: '1.4.2\n' } : { code: 1, timedOut: true }),
        ),
    );
    const error = await captureRejection(installNpmTools(await buildNpmToolInstall(session, owner)));
    const message = error.message;
    expect(message).toStartWith(
        'The command mise exec node@24 bun@1.4.2 -- bun install --frozen-lockfile --linker hoisted --config=',
    );
    expect(message).toEndWith(
        `bunfig.toml ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
    );
});

test('a cached lockfile that holds registry credentials is refused and the files stay', async () => {
    await using sandbox = await testdir();
    const { files, error } = await prepareCredentialProject(sandbox.path, CREDENTIAL_PACKAGE_JSON, CREDENTIAL_LOCKFILE);
    expect(error.message).toBe(
        'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.',
    );
    for (const [path, text] of Object.entries(files))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(text);
});

test('a lockfile that the package manager writes with registry credentials is refused and the files stay', async () => {
    await using sandbox = await testdir();
    using _bun = fakeCommand('mise', async (command, options) => {
        if (command.at(-1) !== '--version') await writeFile(join(options.cwd, 'bun.lock'), CREDENTIAL_LOCKFILE);
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '1.4.2\n' : '' });
    });
    const { files, error } = await prepareCredentialProject(
        sandbox.path,
        JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.0' } }),
        JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.0' } } } }),
    );
    expect(error.message).toBe(
        'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.',
    );
    for (const [path, text] of Object.entries(files))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(text);
});

test('a missing Node stops npm before it writes a lockfile and keeps a cached lockfile', async () => {
    await using sandbox = await testdir({
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
        'gspot.toml': buildSandboxSettings([]),
    });
    const session = await openSession(sandbox.path);
    const pins = listToolProjectPins(session.toolConfigurations).npm;
    const packageJson = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: pins });
    const lockfile = JSON.stringify({
        workspaces: { '': { devDependencies: pins } },
        packages: Object.fromEntries(
            Object.entries(pins).map(([name, version]) => [name, [`${name}@${version}`, '', {}, 'sha512-YQ==']]),
        ),
    });
    using _path = overrideEnvironment({
        PATH: join(sandbox.path, 'missing-bin'),
        MISE_DATA_DIR: join(sandbox.path, 'missing-mise'),
    });
    using owner = openWriter(sandbox.path);
    const install = await buildNpmToolInstall(session, owner);
    const projectFile = { path: GSPOT_PATHS.npmProject, content: packageJson };
    const lockfileError = await captureRejection(prepareNpmLockfile(install, projectFile));
    const message = lockfileError.message;
    expect(message).toBe('The npm tool project needs Node.js to create its lockfile. Install Node.js.');
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.npmProject))).toBe(false);
    await createFileTree(sandbox.path, {
        [GSPOT_PATHS.npmProject]: packageJson,
        [`${GSPOT_FOLDER}/bun.lock`]: lockfile,
    });
    const cached = await prepareNpmLockfile(install, projectFile);
    expect(cached.next.bytes.toString('utf8')).toBe(lockfile);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(packageJson);
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/bun.lock`), 'utf8')).toBe(lockfile);
});

test('a Yarn Classic repository resolves its tool lockfile with npm and the minimum release age', async () => {
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
    const install = await buildNpmToolInstall(session, writer);
    const lockfile = await prepareNpmLockfile(install, {
        path: GSPOT_PATHS.npmProject,
        content: JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: {} }),
    });
    expect(JSON.parse(lockfile.next.bytes.toString('utf8'))).toStrictEqual({
        lockfileVersion: 3,
        packages: { '': { devDependencies: {} } },
    });
    expect(install.steps).toStrictEqual([
        [
            'npm',
            ...PACKAGE_MANAGER_ARGUMENTS.npm.lockfile,
            '--min-release-age=7',
            '--min-release-age-exclude=ajv',
            '--min-release-age-exclude=prettier',
            '--min-release-age-exclude=v8r',
        ],
    ]);
});
