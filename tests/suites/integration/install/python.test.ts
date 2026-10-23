import { zipSync } from 'fflate';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { openSession } from '#cli/session.ts';
import { join, basename, delimiter } from 'node:path';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { DIGEST_ALGORITHM } from '#cli/config/files/hashes.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { readToolProjectFiles } from '#tests/setup/cli/tools.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import type { IndexedPythonProject } from '#tests/types/packages.ts';
import { PYTHON_VERSION } from '#cli/config/install/python/project.ts';
import { chmod, readFile, realpath, writeFile } from 'node:fs/promises';
import { createPythonProject } from '#tests/setup/sandboxes/python-project.ts';
import { spawnGspot, installGeneratedTools } from '#tests/setup/cli/commands.ts';
import { REGISTRY_HOST, ZIP_FILE_OPTIONS } from '#tests/config/setup/sandboxes.ts';

import {
    PYTHON_PROJECTS,
    RUFF_VERSION_OUTPUT,
    PYTHON_INSTALL_STEPS,
    PYTHON_INDEX_CREDENTIALS,
} from '#tests/config/integration/install/python.ts';

test.each([...PYTHON_PROJECTS])(
    'Python tool project install keeps your own and generated files with %s',
    async (configuration) => {
        await using sandbox = await testdir();
        await using artifacts = await testdir();
        await using prepared = await createIndexedPythonProject(sandbox.path, artifacts.path, configuration);
        const { projectFile, lockfilePath, lockfile } = prepared.projectFiles;
        const { rootProject, rootConfiguration } = prepared;
        expect(lockfile.toString('utf8')).not.toContain(PYTHON_INDEX_CREDENTIALS.password);
        const brokenUv = await writeScriptCommand(artifacts.path, 'bin/uv', 'process.exitCode = 87;');
        const command = await spawnGspot(sandbox.path, ['install', '--json'], {
            PATH: [brokenUv, readEnvironmentVariable('PATH') ?? ''].join(delimiter),
            MISE_TRUSTED_CONFIG_PATHS: sandbox.path,
        });
        expect(command.code, command.stdout + command.stderr).toBe(0);
        const steps = (JSON.parse(command.stdout) as { steps: string[][] }).steps;
        const session = await openSession(sandbox.path);
        const miseTools = listMisePins(session.neededToolConfigurations).map(({ name }) => name);
        expect(
            steps.map((step) => (step[0] === 'mise' ? step : ['uv', ...step.slice(1, step.indexOf('--project'))])),
        ).toStrictEqual([
            ['mise', 'trust', GSPOT_PATHS.miseProject],
            ['mise', 'install', ...miseTools],
            ['mise', 'bin-paths', ...miseTools],
            ...PYTHON_INSTALL_STEPS.map((step) =>
                step.map((argument) => argument.replaceAll('{python-version}', PYTHON_VERSION)),
            ),
        ]);
        for (const step of steps.filter((entry) => entry[0] !== 'mise')) {
            expect(step[step.indexOf('--project') + 1]).toBe(join(sandbox.path, DOT_GSPOT));
        }
        expect(await readFile(join(sandbox.path, 'pyproject.toml'))).toStrictEqual(rootProject);
        expect(await readFile(join(sandbox.path, '.venv/authored.txt'), 'utf8')).toBe('keep the project environment');
        expect(await readFile(join(sandbox.path, GSPOT_PATHS.pythonProject))).toStrictEqual(projectFile);
        expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
        expect(await readFile(join(sandbox.path, configuration))).toStrictEqual(rootConfiguration);
    },
);

test.each([...PYTHON_PROJECTS])(
    'a fresh Python clone with %s installs the locked tools twice without changing tracked files, and its Python runs from .gspot/.venv',
    async (configuration) => {
        await using sandbox = await testdir();
        await using artifacts = await testdir();
        await using prepared = await createPythonProject(sandbox.path, { indexFile: configuration });
        await installGeneratedTools(sandbox.path);
        const { projectFile, lockfile } = await readToolProjectFiles(sandbox.path, 'uv');
        const { rootConfiguration } = prepared;
        const clone = join(artifacts.path, 'clone');
        commitAll(sandbox.path);
        runGitStep(sandbox.path, ['clone', '--quiet', '--no-local', sandbox.path, clone]);
        expect(await isOnDisk(join(clone, GSPOT_PATHS.pythonEnvironment))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            const installed = await spawnGspot(clone, ['install']);
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            expect(installed.stdout.split('\n')).toContain(
                `installed 1 Python tool in ${GSPOT_PATHS.pythonEnvironment}`,
            );
            expect(runGitStep(clone, ['status', '--porcelain'])).toBe('');
            expect({
                projectFile: await readFile(join(clone, GSPOT_PATHS.pythonProject)),
                lockfile: await readFile(join(clone, GSPOT_PATHS.uvLockfile)),
                configuration: await readFile(join(clone, configuration)),
            }).toStrictEqual({ projectFile, lockfile, configuration: rootConfiguration });
        }
        const prefix = await runCommand(
            [
                buildVenvExecutablePath(join(clone, GSPOT_PATHS.pythonEnvironment), 'python'),
                '-c',
                'import sys; print(sys.prefix)',
            ],
            { cwd: clone },
        );
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(await realpath(prefix.stdout.trim())).toBe(await realpath(join(clone, GSPOT_PATHS.pythonEnvironment)));
    },
);

test('apply keeps a conflicted Python lockfile and install repairs it', async () => {
    const configuration = 'uv.toml';
    await using sandbox = await testdir();
    await using artifacts = await testdir();
    await using prepared = await createIndexedPythonProject(sandbox.path, artifacts.path, configuration);
    const { lockfilePath, lockfile } = prepared.projectFiles;
    const { rootConfiguration } = prepared;
    const conflict = '<<<<<<< interrupted lockfile\n';
    await chmod(lockfilePath, 0o644);
    await writeFile(lockfilePath, conflict);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
    expect(await readFile(join(sandbox.path, configuration))).toStrictEqual(rootConfiguration);
});

/**
 * Serve a wheel with the installed Ruff executable.
 *
 * @param work the temporary folder receiving the wheel.
 * @returns an authenticated registry serving the wheel.
 */
async function createPythonIndex(work: string): Promise<AsyncDisposable & { url: string }> {
    await using source = await createPythonProject(work, { indexFile: 'uv.toml' });
    await installGeneratedTools(source.root);
    const binary = buildVenvExecutablePath(join(work, GSPOT_PATHS.pythonEnvironment), 'ruff');
    const inspected = await runCommand([binary, '--version'], { cwd: work });
    if (inspected.code !== 0) throw new Error(`Ruff version failed: ${inspected.stderr}`);
    const version = RUFF_VERSION_OUTPUT.exec(inspected.stdout.trim())?.groups?.['version'];
    if (version === undefined) throw new Error('Ruff version output is invalid.');
    const wheel = `ruff-${version}-py3-none-any.whl`;
    const entries = await buildWheelEntries(binary, version);
    const archive = zipSync(
        Object.fromEntries(
            entries.map(([name, data]) => [
                name,
                [data, name.endsWith(`/${basename(binary)}`) ? ZIP_FILE_OPTIONS.executable : ZIP_FILE_OPTIONS.regular],
            ]),
        ),
    );
    const digest = createHash(DIGEST_ALGORITHM).update(archive).digest('hex');
    const { user, password } = PYTHON_INDEX_CREDENTIALS;
    const credentials = `${user}:${password}`;
    const authentication = `Basic ${Buffer.from(credentials).toString('base64')}`;
    const server = Bun.serve({
        hostname: REGISTRY_HOST,
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== authentication)
                return new Response('Authentication required', { status: 401 });
            if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
            return new Response(`<a href="/${wheel}#sha256=${digest}">${wheel}</a>`, {
                headers: { 'content-type': 'text/html' },
            });
        },
    });
    return {
        url: `http://${user}:${password}@${REGISTRY_HOST}:${String(server.port)}/simple`,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}

/** Build the wheel metadata and executable entries, including their integrity record. */
async function buildWheelEntries(binary: string, version: string): Promise<Array<[string, Buffer]>> {
    const metadata = `ruff-${version}.dist-info`;
    const entries: Array<[string, Buffer]> = [
        [`ruff-${version}.data/scripts/${basename(binary)}`, Buffer.from(await readFile(binary))],
        [
            `${metadata}/METADATA`,
            Buffer.from(`Metadata-Version: 2.1
Name: ruff
Version: ${version}
`),
        ],
        [
            `${metadata}/WHEEL`,
            Buffer.from(`Wheel-Version: 1.0
Generator: gspot
Root-Is-Purelib: false
Tag: py3-none-any
`),
        ],
    ];
    const record = entries
        .map(
            ([name, data]) =>
                `${name},sha256=${createHash('sha256').update(data).digest('base64url')},${String(data.length)}\r\n`,
        )
        .join('');
    entries.push([`${metadata}/RECORD`, Buffer.from(`${record}${metadata}/RECORD,,\r\n`)]);
    return entries;
}

/** Create a local package index and a Python project, then install its tools and read the tool project files. */
async function createIndexedPythonProject(
    root: string,
    work: string,
    indexFile: 'pyproject.toml' | 'uv.toml',
): Promise<IndexedPythonProject> {
    await using resources = new AsyncDisposableStack();
    const registry = resources.use(await createPythonIndex(work));
    const project = resources.use(await createPythonProject(root, { indexFile, indexUrl: registry.url }));
    await installGeneratedTools(root);
    const projectFiles = await readToolProjectFiles(root, 'uv');
    const owned = resources.move();
    return {
        rootProject: project.rootProject,
        rootConfiguration: project.rootConfiguration,
        projectFiles,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
