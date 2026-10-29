import { zipSync } from 'fflate';
import { testdir } from 'testdirs';
import { createHash } from 'node:crypto';
import { openSession } from '#cli/session.ts';
import { join, basename, delimiter } from 'node:path';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { runCommand } from '#tests/setup/system/processes.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { PYTHON_VERSION } from '#cli/config/installers/pypi.ts';
import { REGISTRY_HOST } from '#tests/config/setup/sandboxes.ts';
import { readToolProjectFiles } from '#tests/setup/cli/tools.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import type { IndexedPythonProject } from '#tests/types/packages.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { createPythonProject } from '#tests/setup/sandboxes/projects/python.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { spawnGspot, runGspotStep, applyThenInstall } from '#tests/setup/cli/commands.ts';

import {
    PYTHON_PROJECTS,
    ZIP_FILE_OPTIONS,
    UV_RELEASE_CUTOFF_LINE,
    PYTHON_INDEX_CREDENTIALS,
} from '#tests/config/integration/installers/pypi.ts';

const resources = new AsyncDisposableStack();
const pythonIndex = Promise.withResolvers<{ url: string }>();
beforeAll(async () => {
    const work = resources.use(await testdir());
    pythonIndex.resolve(resources.use(await createPythonIndex(work.path)));
});
afterAll(() => resources.disposeAsync());

test.each([...PYTHON_PROJECTS])(
    'Python tool project install keeps the authored and generated files with %s',
    async (configuration) => {
        await using sandbox = await createGitSandbox({});
        await using artifacts = await createGitSandbox({});
        await using project = await createIndexedPythonProject(sandbox.path, configuration);
        const { projectFile, lockfilePath, lockfile } = project.projectFiles;
        const { rootProject, rootConfiguration } = project;
        expect(lockfile.toString('utf8')).not.toContain(PYTHON_INDEX_CREDENTIALS.password);
        const brokenUv = await writeProgramCommand(artifacts.path, 'bin/uv', 'fakes/tool', '--exit', '87');
        const installed = await spawnGspot(sandbox.path, ['install', '--json'], {
            PATH: [brokenUv, readEnvironmentVariable('PATH') ?? ''].join(delimiter),
            MISE_TRUSTED_CONFIG_PATHS: sandbox.path,
        });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const steps = (JSON.parse(installed.stdout) as { steps: string[][] }).steps.filter(
            (step) => step[0] === 'mise' || step.includes('--project'),
        );
        const session = await openSession(sandbox.path);
        const miseTools = listMisePins(session.toolConfigurations).map(({ name }) => name);
        expect(
            steps.map((step) => (step[0] === 'mise' ? step : ['uv', ...step.slice(1, step.indexOf('--project'))])),
        ).toStrictEqual([
            ['mise', 'trust', GSPOT_PATHS.miseProject],
            ['mise', 'install', ...miseTools],
            ['mise', 'bin-paths', ...miseTools],
            ['uv', 'venv', '--python', PYTHON_VERSION, '--allow-existing', '.venv'],
            ['uv', 'sync', '--locked', '--no-install-project', '--python', PYTHON_VERSION],
        ]);
        for (const step of steps) {
            if (step[0] === 'mise') continue;
            expect(step[step.indexOf('--project') + 1]).toBe(join(sandbox.path, GSPOT_FOLDER));
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
        await using sandbox = await createGitSandbox({});
        await using artifacts = await createGitSandbox({});
        await using project = await createPythonProject(sandbox.path, { indexFile: configuration });
        await applyThenInstall(sandbox.path);
        const { projectFile, lockfile } = await readToolProjectFiles(sandbox.path, 'uv');
        const { rootConfiguration } = project;
        const clone = join(artifacts.path, 'clone');
        commitAll(sandbox.path);
        runGitStep(sandbox.path, ['clone', '--quiet', '--no-local', sandbox.path, clone]);
        expect(await isOnDisk(join(clone, GSPOT_PATHS.pythonEnvironment))).toBe(false);
        for (let round = 0; round < 2; round++) {
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
        expect(await isOnDisk(join(clone, GSPOT_PATHS.pythonEnvironment, 'pyvenv.cfg'))).toBe(true);
        const python = await runCommand(
            [buildVenvExecutablePath(join(clone, GSPOT_PATHS.pythonEnvironment), 'python'), '--version'],
            { cwd: clone },
        );
        expect(python.code, python.stdout + python.stderr).toBe(0);
    },
);

test('apply keeps a conflicted Python lockfile and install repairs it', async () => {
    const configuration = 'uv.toml';
    await using sandbox = await createGitSandbox({});
    await using project = await createIndexedPythonProject(sandbox.path, configuration);
    const { lockfilePath, lockfile } = project.projectFiles;
    const { rootConfiguration } = project;
    const conflict = '<<<<<<< interrupted lockfile\n';
    await chmod(lockfilePath, 0o644);
    await writeFile(lockfilePath, conflict);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const repaired = await readFile(lockfilePath, 'utf8');
    expect(repaired.replace(UV_RELEASE_CUTOFF_LINE, '')).toBe(
        lockfile.toString('utf8').replace(UV_RELEASE_CUTOFF_LINE, ''),
    );
    expect(await readFile(join(sandbox.path, configuration))).toStrictEqual(rootConfiguration);
});

async function createPythonIndex(work: string): Promise<Disposable & { url: string }> {
    await using _source = await createPythonProject(work, { indexFile: 'uv.toml' });
    await applyThenInstall(work);
    const binary = buildVenvExecutablePath(join(work, GSPOT_PATHS.pythonEnvironment), 'ruff');
    const inspected = await runCommand([binary, '--version'], { cwd: work });
    if (inspected.code !== 0) throw new Error(`Ruff version failed: ${inspected.stderr}`);
    const version = /^ruff (?<version>\d+\.\d+\.\d[-+\w.]*)$/u.exec(inspected.stdout.trim())?.groups?.['version'];
    if (version === undefined) throw new Error('Ruff version output is invalid.');
    const wheel = `ruff-${version}-py3-none-any.whl`;
    const wheelFiles = await buildWheelFiles(binary, version);
    const archive = zipSync(
        Object.fromEntries(
            wheelFiles.map(([name, bytes]) => [
                name,
                [bytes, name.endsWith(`/${basename(binary)}`) ? ZIP_FILE_OPTIONS.executable : ZIP_FILE_OPTIONS.regular],
            ]),
        ),
    );
    const digest = createHash('sha256').update(archive).digest('hex');
    const { user, password } = PYTHON_INDEX_CREDENTIALS;
    const credentials = `${user}:${password}`;
    const authentication = `Basic ${Buffer.from(credentials).toString('base64')}`;
    const uploadedAt = new Date().toISOString();
    const server = Bun.serve({
        hostname: REGISTRY_HOST,
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== authentication)
                return new Response('Authentication required', { status: 401 });
            if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
            const file = {
                filename: wheel,
                url: `/${wheel}`,
                hashes: { sha256: digest },
                'upload-time': uploadedAt,
            };
            return Response.json(
                { meta: { 'api-version': '1.1' }, name: 'ruff', files: [file] },
                { headers: { 'content-type': 'application/vnd.pypi.simple.v1+json' } },
            );
        },
    });
    return {
        url: `http://${user}:${password}@${REGISTRY_HOST}:${String(server.port)}/simple`,
        [Symbol.dispose]: server[Symbol.dispose].bind(server),
    };
}

async function buildWheelFiles(binary: string, version: string): Promise<Array<[string, Buffer]>> {
    const metadata = `ruff-${version}.dist-info`;
    const files: Array<[string, Buffer]> = [
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
    const record = files
        .map(
            ([name, bytes]) =>
                `${name},sha256=${createHash('sha256').update(bytes).digest('base64url')},${String(bytes.length)}\r\n`,
        )
        .join('');
    files.push([`${metadata}/RECORD`, Buffer.from(`${record}${metadata}/RECORD,,\r\n`)]);
    return files;
}

async function createIndexedPythonProject(
    root: string,
    indexFile: 'pyproject.toml' | 'uv.toml',
): Promise<IndexedPythonProject> {
    await using resources = new AsyncDisposableStack();
    const index = await pythonIndex.promise;
    const project = resources.use(await createPythonProject(root, { indexFile, indexUrl: index.url }));
    await applyThenInstall(root);
    const projectFiles = await readToolProjectFiles(root, 'uv');
    const owned = resources.move();
    return {
        rootProject: project.rootProject,
        rootConfiguration: project.rootConfiguration,
        projectFiles,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
