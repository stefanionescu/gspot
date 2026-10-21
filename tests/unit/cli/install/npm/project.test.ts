import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeCommand } from '#tests/setup/fakes.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildToolInstall } from '#tests/setup/install.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/projects.ts';
import { readRegistryEnvironment } from '#cli/install/npm/registry.ts';
import { parseToolPackageJson } from '#cli/install/npm/tool-project.ts';
import { TOOL_REQUIREMENTS } from '#tests/data/install/npm-tool-project.ts';
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
function buildNpmToolFile(content: string): GeneratedFile {
    return { path: '.gspot/package.json', content };
}

test.each([...TOOL_REQUIREMENTS])(
    'tool project validates the $dependency requirement $version: $name',
    ({ dependency, version, accepted }) => {
        const source = JSON.stringify({
            ...NPM_TOOL_PROJECT,
            devDependencies: { [dependency]: version },
        });
        if (accepted)
            expect(parseToolPackageJson(source, 'bun').dependencies).toStrictEqual({
                [dependency]: version,
            });
        else expect(() => parseToolPackageJson(source, 'bun')).toThrow(dependency);
    },
);

test.each([
    { operation: 'installation', frozen: true },
    { operation: 'lockfile resolution', frozen: false },
])('a failed $operation keeps the files and hides credentials', async ({ frozen, operation }) => {
    const refusal = 'HTTP 403 Forbidden';
    await using repository = await testdir();
    const token = 'synthetic-registry-failure-token';
    const password = 'synthetic-registry-password/with spaces';
    const registry = `https://alex:${encodeURIComponent(password)}@registry.example.com/`;
    const source = `registry=${registry}\n//registry.example.com/:_authToken=${token}\n`;
    const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
    const original = frozen ? packageJson : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
    const lockfile = JSON.stringify({
        workspaces: { '': { devDependencies: { prettier: frozen ? '3.8.1' : '3.8.0' } } },
    });
    await createFileTree(repository.path, {
        '.npmrc': source,
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        '.gspot/package.json': original,
        '.gspot/bun.lock': lockfile,
    });
    await createFileTree(repository.path, { 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(repository.path);
    using owner = openWriter(repository.path);
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
            : prepareNpmLockfile(buildToolInstall(session, owner), buildNpmToolFile(packageJson), undefined)
    ).catch((error: unknown) => error);
    expect(installationError).toBeInstanceOf(Error);
    expect(installationError).toMatchObject({
        name: 'GspotError',
        code: 'installation',
        message: `bun ${operation} failed (exit 1). Run: gspot apply, then gspot install.\nDownloading https://[redacted]@registry.example.com/private-check-tool\n[redacted]\n[redacted]\n${refusal} from https://[redacted]@registry.example.com/private-check-tool`,
    });
    expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await readFile(join(repository.path, '.gspot/package.json'), 'utf8')).toBe(original);
    expect(await readFile(join(repository.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
});

test('an npm install that runs past the time limit names the limit', async () => {
    await using repository = await testdir();
    const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
    await createFileTree(repository.path, {
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        '.gspot/package.json': packageJson,
        '.gspot/bun.lock': JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.1' } } } }),
    });
    const session = await openSession(repository.path);
    using owner = openWriter(repository.path);
    using _bun = fakeFailingBun({ timedOut: true });
    expect(await captureRejection(installNpmTools(buildToolInstall(session, owner)))).toBe(
        `The command bun install --frozen-lockfile --linker hoisted ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>, then run: gspot install.`,
    );
});

test.each([false, true])(
    'credentials in a lockfile are refused before installation or after resolution, frozen=%s',
    async (frozen) => {
        await using repository = await testdir();
        const token = 'synthetic-generated-lockfile-token';
        const source = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${token}\n`;
        const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
        const credentialLockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
            packages: { prettier: ['prettier@3.8.1', `https://registry.example.com/${token}`, {}, 'integrity'] },
        });
        const original = frozen
            ? packageJson
            : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
        const lockfile = frozen
            ? credentialLockfile
            : JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.0' } } } });
        await createFileTree(repository.path, {
            '.npmrc': source,
            'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
            '.gspot/package.json': original,
            '.gspot/bun.lock': lockfile,
            '.gspot/node_modules/authored.txt': 'keep installed files',
        });
        await createFileTree(repository.path, { 'gspot.toml': buildSandboxSettings([]) });
        const session = await openSession(repository.path);
        using owner = openWriter(repository.path);
        using boundary = fakeCommand('bun', async (command, options) => {
            if (!frozen && command[1] !== '--version')
                await writeFile(join(options.cwd, 'bun.lock'), credentialLockfile);
            return buildProcessResult({
                code: 0,
                missing: false,
                duration: 0,
                stdout: command[1] === '--version' ? '1.4.2\n' : '',
                stderr: '',
            });
        });
        const message = await captureRejection(
            prepareNpmLockfile(buildToolInstall(session, owner), buildNpmToolFile(packageJson), undefined),
        );
        expect(message).toBe(
            frozen
                ? 'The npm lockfile includes repository registry credentials. Existing files were preserved. Remove credentials from the registry URL and run: gspot install'
                : 'The package manager included registry credentials in its lockfile. Existing files were preserved.',
        );
        expect(message).not.toContain(token);
        expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(repository.path, '.gspot/package.json'), 'utf8')).toBe(original);
        expect(await readFile(join(repository.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
        expect(await readFile(join(repository.path, '.gspot/node_modules/authored.txt'), 'utf8')).toBe(
            'keep installed files',
        );
        if (frozen) expect(boundary).not.toHaveBeenCalled();
        else expect(boundary).toHaveBeenCalled();
    },
);

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
        prepareNpmLockfile(buildToolInstall(session, owner), buildNpmToolFile(packageJson), undefined),
    );
    expect(message).toBe('node is required by the npm tool project. Install it before it creates its lockfile.');
    expect(await isOnDisk(join(sandbox.path, '.gspot/package.json'))).toBe(false);
    await createFileTree(sandbox.path, { ['.gspot/package.json']: packageJson, '.gspot/bun.lock': lockfile });
    const cached = await prepareNpmLockfile(buildToolInstall(session, owner), buildNpmToolFile(packageJson), undefined);
    expect(cached.content).toBe(lockfile);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('kept\n');
    expect(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe(packageJson);
    expect(await readFile(join(sandbox.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
});

test.each([
    { source: 'registry=not-a-valid-url\n', message: 'Invalid registry URL in package manager configuration.' },
    { source: 'maxsockets=not-a-number\n', message: 'Invalid package manager configuration.' },
])('invalid .npmrc settings keep their error for $source', async ({ source, message }) => {
    await using repository = await testdir({ '.npmrc': source, 'package.json': '{"private":true}\n' });

    expect(await captureRejection(readRegistryEnvironment(repository.path))).toBe(message);
    expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
});

test('a package manager version timeout names the install command and configured limit', async () => {
    await using repository = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(repository.path);
    using owner = openWriter(repository.path);
    const context = buildToolInstall(session, owner);
    using _bun = fakeCommand('bun', () =>
        Promise.resolve(
            buildProcessResult({
                code: 1,
                missing: false,
                duration: 0,
                stdout: '',
                stderr: '',
                timedOut: true,
            }),
        ),
    );
    expect(await captureRejection(assertPackageManagerVersion(context))).toBe(
        `The command bun --version ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>, then run: gspot install.`,
    );
    expect(context.steps).toStrictEqual([['bun', '--version']]);
});
