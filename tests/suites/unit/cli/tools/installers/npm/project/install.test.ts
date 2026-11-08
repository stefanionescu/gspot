import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { NPM_TOOL_PROJECT } from '#cli/config/generation.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { LOCKFILE_CREDENTIAL_MESSAGE, NPM_LOCKFILE_CREDENTIAL_MESSAGE } from '#cli/config/tools/installers.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { installNpmTools, installUnlockedNpmTools, planNpmLockfile } from '#cli/tools/installers/npm/project.ts';
import {
    CREDENTIAL_LOCKFILE,
    CREDENTIAL_PACKAGE_JSON,
    CREDENTIAL_TOKEN,
    FAILED_INSTALL_CASES,
} from '#tests/config/tools/npm.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildNpmToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

async function captureLockfileRefusal(root: string, packageJson: string, lockfile: string) {
    await createFileTree(root, {
        '.npmrc': `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${CREDENTIAL_TOKEN}\n`,
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: packageJson,
        [`${GSPOT_FOLDER}/bun.lock`]: lockfile,
        'gspot.toml': buildSandboxSettings([]),
    });
    const owner = openFiles(root);
    const session = await openSession(root);
    const install = await buildNpmToolInstall(session, owner);
    return captureRejection(
        planNpmLockfile(install, { path: GSPOT_PATHS.npmProject, content: CREDENTIAL_PACKAGE_JSON }),
    );
}

test.each([...FAILED_INSTALL_CASES])('a failed $operation hides credentials', async () => {
    const refusal = 'HTTP 403 Forbidden';
    await using sandbox = await createGitSandbox({});
    const token = 'synthetic-registry-failure-token';
    const password = 'synthetic-registry-password/with spaces';
    const registry = `https://alex:${encodeURIComponent(password)}@registry.example.com/`;
    const source = `registry=${registry}\n//registry.example.com/:_authToken=${token}\n`;
    const packageJson = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.1' } });
    const previous = packageJson;
    const lockfile = JSON.stringify({
        workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
    });
    await createFileTree(sandbox.path, {
        '.npmrc': source,
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: previous,
        [`${GSPOT_FOLDER}/bun.lock`]: lockfile,
        'gspot.toml': buildSandboxSettings([]),
    });
    const session = await openSession(sandbox.path);
    const owner = openFiles(sandbox.path);
    const failure = {
        stdout: `Downloading ${registry}private-check-tool\n${password}\n${token}`,
        stderr: `${refusal} from ${registry}private-check-tool`,
    };
    using _bun = fakeCommands('mise', (command) =>
        Promise.resolve(
            buildProcessResult(command.at(-1) === '--version' ? { stdout: '1.4.2\n' } : { code: 1, ...failure }),
        ),
    );
    const install = await buildNpmToolInstall(session, owner);
    const installationError = await captureRejection(installNpmTools(install));
    expect(installationError).toMatchObject({ name: 'GspotError', code: 'install' });
    for (const secret of [password, encodeURIComponent(password), token])
        expect(installationError.message).not.toContain(secret);
    expect(installationError.message).toContain(`${refusal} from https://[redacted]@registry.example.com/`);
});

test('a cached lockfile that holds registry credentials is refused', async () => {
    await using sandbox = await createGitSandbox({});
    const error = await captureLockfileRefusal(sandbox.path, CREDENTIAL_PACKAGE_JSON, CREDENTIAL_LOCKFILE);
    expect(error).toMatchObject({ code: 'install', message: NPM_LOCKFILE_CREDENTIAL_MESSAGE });
});

test('a lockfile that the package manager writes with registry credentials is refused and the saved one stays', async () => {
    await using sandbox = await createGitSandbox({});
    using _bun = fakeCommands('mise', async (command, options) => {
        if (command.at(-1) !== '--version') await writeFile(join(options.cwd, 'bun.lock'), CREDENTIAL_LOCKFILE);
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '1.4.2\n' : '' });
    });
    const saved = JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.0' } } } });
    const error = await captureLockfileRefusal(
        sandbox.path,
        JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.0' } }),
        saved,
    );
    expect(error).toMatchObject({ code: 'install', message: LOCKFILE_CREDENTIAL_MESSAGE });
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/bun.lock`), 'utf8')).toBe(saved);
});

test('npm resolves and installs a stale tool project in one run that starts from no lockfile', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"packageManager":"npm@11.19.0"}',
        'gspot.toml': buildSandboxSettings([]),
        [GSPOT_PATHS.npmProject]: CREDENTIAL_PACKAGE_JSON,
        [`${GSPOT_FOLDER}/package-lock.json`]: '{"stale":true}\n',
        [`${GSPOT_PATHS.nodeModules}/stale/package.json`]: '{}\n',
    });
    const runs: Array<{ command: string[]; hasLockfile: boolean; hasModules: boolean }> = [];
    using _npm = fakeCommands('mise', async (command, options) => {
        if (command.at(-1) === '--version') return buildProcessResult({ stdout: '11.19.0\n' });
        runs.push({
            command: command.slice(command.indexOf('--') + 1),
            hasLockfile: existsSync(join(options.cwd, 'package-lock.json')),
            hasModules: existsSync(join(options.cwd, 'node_modules')),
        });
        await writeFile(join(options.cwd, 'package-lock.json'), '{"lockfileVersion":3}\n');
        return buildProcessResult();
    });
    const install = await buildNpmToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    await installUnlockedNpmTools(install);
    expect(runs.map(({ hasLockfile, hasModules }) => ({ hasLockfile, hasModules }))).toStrictEqual([
        { hasLockfile: false, hasModules: false },
    ]);
    const [command] = runs.map((run) => run.command);
    expect(command?.slice(0, 2)).toStrictEqual(['npm', 'install']);
    expect(command?.some((argument) => argument.startsWith('--min-release-age='))).toBe(true);
    expect(command?.filter((argument) => ['--package-lock-only', '--no-save'].includes(argument))).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, GSPOT_FOLDER, 'package-lock.json'), 'utf8')).toBe(
        '{"lockfileVersion":3}\n',
    );
});

test('a lockfile that npm writes with registry credentials in its one run is deleted, and the install fails', async () => {
    await using sandbox = await createGitSandbox({
        '.npmrc': `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${CREDENTIAL_TOKEN}\n`,
        'package.json': '{"private":true,"packageManager":"npm@11.19.0"}',
        'gspot.toml': buildSandboxSettings([]),
        [GSPOT_PATHS.npmProject]: CREDENTIAL_PACKAGE_JSON,
    });
    using _npm = fakeCommands('mise', async (command, options) => {
        if (command.at(-1) !== '--version')
            await writeFile(join(options.cwd, 'package-lock.json'), CREDENTIAL_LOCKFILE);
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '11.19.0\n' : '' });
    });
    const install = await buildNpmToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    const error = await captureRejection(installUnlockedNpmTools(install));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(existsSync(join(sandbox.path, GSPOT_FOLDER, 'package-lock.json'))).toBe(false);
});
