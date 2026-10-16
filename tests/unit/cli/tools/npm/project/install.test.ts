import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/commands/session.ts';
import { INSTALL_FAILURES } from '#tests/config/npm.ts';
import { fakeCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { registryEnvironment } from '#cli/tools/npm/registry.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/parsers/dependency-files.ts';
import { installNpmTools, prepareNpmLockfile } from '#cli/tools/npm/project.ts';

// Own the authenticated registry's requests and lifetime for its real npm client.
function authenticatedRegistry(token: string) {
    const requests = { rejected: 0, authenticated: 0 };
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== `Bearer ${token}`) {
                requests.rejected++;
                return Response.json({ error: 'Authentication required' }, { status: 401 });
            }
            requests.authenticated++;
            return Response.json({
                name: 'private-check-tool',
                'dist-tags': { latest: '1.0.0' },
                versions: { '1.0.0': { name: 'private-check-tool', version: '1.0.0' } },
            });
        },
    });
    return {
        url: `http://127.0.0.1:${String(server.port)}/`,
        requests,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}

test('registry settings from the repository .npmrc authenticate an isolated project and leave the .npmrc unchanged', async () => {
    await using repository = await testdir();
    await using isolated = await testdir();
    const token = 'synthetic-registry-credential';
    await using registry = authenticatedRegistry(token);
    const requests = registry.requests;
    const url = registry.url;
    await createFileTree(repository.path, {
        'package.json': '{"private":true}\n',
        '.npmrc': `registry=${url}\n`,
    });
    await createFileTree(isolated.path, { 'package.json': '{"private":true}\n' });
    const command = ['npm', 'view', 'private-check-tool', 'version', '--json', '--cache', join(isolated.path, 'cache')];
    const missing = await runTool(command, {
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        cwd: isolated.path,
        env: await registryEnvironment(repository.path),
    });
    expect(missing.code).not.toBe(0);
    expect(requests.rejected).toBeGreaterThan(0);
    const source = `registry=${url}\n//${new URL(url).host}/:_authToken=${token}\n`;
    await writeFile(join(repository.path, '.npmrc'), source, { mode: 0o600 });
    const { mode } = await stat(join(repository.path, '.npmrc'));
    const corrected = await runTool(command, {
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        cwd: isolated.path,
        env: await registryEnvironment(repository.path),
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toBe('1.0.0');
    expect(requests.authenticated).toBeGreaterThan(0);
    expect(corrected.stdout + corrected.stderr).not.toContain(token);
    expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await stat(join(repository.path, '.npmrc'))).toMatchObject({ mode });
});

test.each([...INSTALL_FAILURES])(
    'a failed package install keeps the files and hides credentials, frozen=$frozen',
    async ({ frozen, refusal }) => {
        await using repository = await testdir();
        const token = 'synthetic-registry-failure-token';
        const password = 'synthetic-registry-password/with spaces';
        const registry = `https://alex:${encodeURIComponent(password)}@registry.example.com/`;
        const source = `registry=${registry}\n//registry.example.com/:_authToken=${token}\n`;
        const manifest = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
        const original = frozen ? manifest : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
        const lockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: frozen ? '3.8.1' : '3.8.0' } } },
        });
        await createFileTree(repository.path, {
            '.npmrc': source,
            'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
            '.gspot/package.json': original,
            '.gspot/bun.lock': lockfile,
        });
        await createFileTree(repository.path, { 'gspot.toml': settingsText([]) });
        const session = await openSession(repository.path);
        using owner = openFiles(repository.path);
        using resources = new DisposableStack();
        resources.use(
            fakeCommand('bun', (command) =>
                Promise.resolve({
                    code: command[1] === '--version' ? 0 : 1,
                    missing: false,
                    duration: 0,
                    stdout:
                        command[1] === '--version'
                            ? '1.4.2\n'
                            : `Downloading ${registry}private-check-tool\n${password}\n${token}`,
                    stderr: command[1] === '--version' ? '' : `${refusal} from ${registry}private-check-tool`,
                }),
            ),
        );
        const diagnosticError = await (
            frozen
                ? installNpmTools(session, owner, [], [])
                : prepareNpmLockfile(
                      { path: '.gspot/package.json', content: manifest, kind: 'tool_file' },
                      owner,
                      session,
                      undefined,
                      [],
                  )
        ).catch((error: unknown) => error);
        expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
        const diagnostic = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
        expect(diagnostic).toContain(`bun ${frozen ? 'installation' : 'lockfile resolution'} failed (exit 1)`);
        expect(diagnostic).toContain(refusal);
        expect(diagnostic).toContain('Run: gspot apply, then gspot install');
        for (const credential of [token, password, encodeURIComponent(password)])
            expect(diagnostic).not.toContain(credential);
        expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(repository.path, '.gspot/package.json'), 'utf8')).toBe(original);
        expect(await readFile(join(repository.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
    },
);

test.each([false, true])(
    'credentials in a lockfile are refused before installation or after resolution, frozen=%s',
    async (frozen) => {
        await using repository = await testdir();
        const token = 'synthetic-generated-lockfile-token';
        const source = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${token}\n`;
        const manifest = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
        const credentialLockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
            packages: { prettier: ['prettier@3.8.1', `https://registry.example.com/${token}`, {}, 'integrity'] },
        });
        const original = frozen ? manifest : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
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
        await createFileTree(repository.path, { 'gspot.toml': settingsText([]) });
        const session = await openSession(repository.path);
        using owner = openFiles(repository.path);
        using boundary = fakeCommand('bun', async (command, options) => {
            if (!frozen && command[1] !== '--version')
                await writeFile(join(options.cwd, 'bun.lock'), credentialLockfile);
            return {
                code: 0,
                missing: false,
                duration: 0,
                stdout: command[1] === '--version' ? '1.4.2\n' : '',
                stderr: '',
            };
        });
        const diagnostic = await rejection(
            prepareNpmLockfile(
                { path: '.gspot/package.json', content: manifest, kind: 'tool_file' },
                owner,
                session,
                undefined,
                [],
            ),
        );
        expect(diagnostic).toBe(
            frozen
                ? 'The npm lockfile includes repository registry credentials. Existing files were preserved. Remove credentials from the registry URL and run: gspot install'
                : 'The package manager included registry credentials in its lockfile. Existing files were preserved.',
        );
        expect(diagnostic).not.toContain(token);
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
    const manifest = JSON.stringify({
        ...NPM_TOOL_PROJECT,
        devDependencies: { prettier: '3.8.1' },
    });
    const lockfile = JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.1' } } } });
    await using sandbox = await testdir({
        'source.txt': 'kept\n',
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': settingsText([]) });
    const session = await openSession(sandbox.path);
    using _path = useEnvironment({
        PATH: join(sandbox.path, 'missing-bin'),
        MISE_DATA_DIR: join(sandbox.path, 'missing-mise'),
    });
    using owner = openFiles(sandbox.path);
    const diagnostic = await rejection(
        prepareNpmLockfile(
            { path: '.gspot/package.json', content: manifest, kind: 'tool_file' },
            owner,
            session,
            undefined,
            [],
        ),
    );
    expect(diagnostic).toBe('node is required by the npm tool project. Install it before it creates its lockfile.');
    expect(await pathExists(join(sandbox.path, '.gspot/package.json'))).toBe(false);
    await createFileTree(sandbox.path, { ['.gspot/package.json']: manifest, '.gspot/bun.lock': lockfile });
    const cached = await prepareNpmLockfile(
        { path: '.gspot/package.json', content: manifest, kind: 'tool_file' },
        owner,
        session,
        undefined,
        [],
    );
    expect(cached.content).toBe(lockfile);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('kept\n');
    expect(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe(manifest);
    expect(await readFile(join(sandbox.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
});

test.each([
    { source: 'registry=not-a-valid-url\n', message: 'Invalid registry URL in package manager configuration.' },
    { source: 'maxsockets=not-a-number\n', message: 'Invalid package manager configuration.' },
])('invalid .npmrc settings keep their error for $source', async ({ source, message: diagnostic }) => {
    await using repository = await testdir();
    await createFileTree(repository.path, { '.npmrc': source, 'package.json': '{"private":true}\n' });
    expect(await rejection(registryEnvironment(repository.path))).toBe(diagnostic);
    expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
});
