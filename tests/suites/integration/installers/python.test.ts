import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { strToU8, zipSync } from 'fflate';
import { testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import {
    AUTHENTICATION_REQUIRED_MESSAGE,
    PYTHON_PROJECT_IGNORES,
    REGISTRY_HOST,
} from '#tests/config/setup/sandboxes.ts';
import { runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readToolProjectFiles } from '#tests/setup/cli/tools.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createPythonProject } from '#tests/setup/sandboxes/projects/python.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildVenvExecutablePath } from '#tests/setup/system/programs.ts';
import type { IndexedPythonProject } from '#tests/types/integration.ts';

const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;

const UV_RELEASE_CUTOFF_LINE = /^exclude-newer = .*$/mu;

const ZIP_FILE_OPTIONS = {
    regular: { os: 3, attrs: 0o10_0644 * 0x1_00_00 },
    executable: { os: 3, attrs: 0o10_0755 * 0x1_00_00 },
} as const;

const resources = new AsyncDisposableStack();

const UV_CONFIGURATION = 'uv.toml';

const pythonIndex = Promise.withResolvers<{ url: string }>();

beforeAll(async () => {
    const work = resources.use(await testdir());
    pythonIndex.resolve(resources.use(await createPythonIndex(work.path)));
});

afterAll(() => resources.disposeAsync());

async function createPythonIndex(workFolder: string): Promise<Disposable & { url: string }> {
    await using _source = await createPythonProject(workFolder, { indexFile: UV_CONFIGURATION });
    await runGspotStep({ root: workFolder, run: spawnGspot }, ['install']);
    const binary = buildVenvExecutablePath(join(workFolder, GSPOT_PATHS.pythonEnvironment), 'ruff');
    const inspected = await runCommand([binary, '--version'], { cwd: workFolder });
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
    const server = Bun.serve({
        hostname: REGISTRY_HOST,
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== authentication)
                return new Response(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401 });
            if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
            const file = {
                filename: wheel,
                url: `/${wheel}`,
                hashes: { sha256: digest },
                'upload-time': '2020-01-01T00:00:00Z',
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

async function createIndexedPythonProject(root: string): Promise<IndexedPythonProject> {
    await using resources = new AsyncDisposableStack();
    const index = await pythonIndex.promise;
    const project = resources.use(
        await createPythonProject(root, { indexFile: UV_CONFIGURATION, indexUrl: index.url }),
    );
    await runGspotStep({ root, run: spawnGspot }, ['install']);
    const projectFiles = await readToolProjectFiles(root, 'uv');
    const owned = resources.move();
    return {
        rootProject: project.rootProject,
        rootConfiguration: project.rootConfiguration,
        files: projectFiles,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}

test('install from an authenticated uv.toml index keeps the authored project files', async () => {
    await using sandbox = await createGitSandbox({});
    await using project = await createIndexedPythonProject(sandbox.path);
    const { rootProject } = project;
    expect(await readFile(join(sandbox.path, 'pyproject.toml'))).toStrictEqual(rootProject);
    expect(await readFile(join(sandbox.path, '.venv/authored.txt'), 'utf8')).toBe('keep the project environment');
});

test('a fresh Python clone with uv.toml installs the locked tools twice without changing tracked files, and its Python runs from .gspot/.venv', async () => {
    await using sandbox = await createGitSandbox({});
    await using artifacts = await createGitSandbox({});
    await using project = await createPythonProject(sandbox.path, { indexFile: UV_CONFIGURATION });
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const { projectFile, lockfile } = await readToolProjectFiles(sandbox.path, 'uv');
    const { rootConfiguration } = project;
    const clone = join(artifacts.path, 'clone');
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['clone', '--quiet', '--no-local', sandbox.path, clone]);
    expect(existsSync(join(clone, GSPOT_PATHS.pythonEnvironment))).toBe(false);
    for (let round = 0; round < 2; round++) {
        const installed = await spawnGspot(clone, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(runGitStep(clone, ['status', '--porcelain'])).toBe('');
        expect({
            projectFile: await readFile(join(clone, GSPOT_PATHS.pythonProject)),
            lockfile: await readFile(join(clone, GSPOT_PATHS.uvLockfile)),
            configuration: await readFile(join(clone, UV_CONFIGURATION)),
        }).toStrictEqual({ projectFile, lockfile, configuration: rootConfiguration });
    }
    expect(existsSync(join(clone, GSPOT_PATHS.pythonEnvironment, 'pyvenv.cfg'))).toBe(true);
    const python = await runCommand(
        [buildVenvExecutablePath(join(clone, GSPOT_PATHS.pythonEnvironment), 'python'), '--version'],
        { cwd: clone },
    );
    expect(python.code, python.stdout + python.stderr).toBe(0);
});

test('gspot install keeps a package that the project installed from an extra', async () => {
    const metadata = 'local_extra-1.0.0.dist-info';
    const wheel = zipSync({
        'local_extra.py': strToU8('VALUE = 1\n'),
        [`${metadata}/METADATA`]: strToU8('Metadata-Version: 2.1\nName: local-extra\nVersion: 1.0.0\n'),
        [`${metadata}/WHEEL`]: strToU8(
            'Wheel-Version: 1.0\nGenerator: gspot\nRoot-Is-Purelib: true\nTag: py3-none-any\n',
        ),
        [`${metadata}/RECORD`]: strToU8(''),
    });
    await using sandbox = await createGitSandbox({
        '.gitignore': '.venv/\n',
        'gspot.toml': buildSandboxSettings(['python'], {
            ignore: { checks: PYTHON_PROJECT_IGNORES, reason: 'This test exercises the project environment only.' },
            level: 'basic',
        }),
        'pyproject.toml': `[project]
name = "authored"
version = "1.0.0"
requires-python = ">=3.10"
dependencies = []

[project.optional-dependencies]
local = ["local-extra"]

[tool.uv]
package = false

[tool.uv.sources]
local-extra = { path = "wheels/local_extra-1.0.0-py3-none-any.whl" }
`,
        'wheels/local_extra-1.0.0-py3-none-any.whl': wheel,
    });
    const root = sandbox.path;
    for (const command of [['lock'], ['sync', '--locked', '--extra', 'local']]) {
        const step = await runCommand(['uv', ...command], { cwd: root });
        expect(step.code, step.stdout + step.stderr).toBe(0);
    }
    commitAll(root);
    await applyGeneratedFiles(root);
    await runGspotStep({ root, run: spawnGspot }, ['install']);
    const python = buildVenvExecutablePath(join(root, '.venv'), 'python');
    const imported = await runCommand([python, '-c', 'import local_extra'], { cwd: root });
    expect(imported.code, imported.stdout + imported.stderr).toBe(0);
});

test('apply keeps a conflicted Python lockfile and install repairs it', async () => {
    await using sandbox = await createGitSandbox({});
    await using project = await createIndexedPythonProject(sandbox.path);
    const { lockfilePath, lockfile } = project.files;
    const { rootConfiguration } = project;
    const conflict = '<<<<<<< interrupted lockfile\n';
    await chmod(lockfilePath, 0o644);
    await writeFile(lockfilePath, conflict);
    await applyGeneratedFiles(sandbox.path);
    expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const repaired = await readFile(lockfilePath, 'utf8');
    expect(repaired.replace(UV_RELEASE_CUTOFF_LINE, '')).toBe(
        lockfile.toString('utf8').replace(UV_RELEASE_CUTOFF_LINE, ''),
    );
    expect(await readFile(join(sandbox.path, UV_CONFIGURATION))).toStrictEqual(rootConfiguration);
});

test('install after a changed release age relocks the Python tools', async () => {
    await using sandbox = await createGitSandbox({});
    await using _project = await createIndexedPythonProject(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['set', 'dependencies.min_release_age_days', '14']);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.uvLockfile), 'utf8')).toContain('exclude-newer-span = "P14D"');
});

test('a repeated install reports No change while a uv-locked project matches its lockfile', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml':
            '[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.10"\ndependencies = []\n',
        'main.py': 'VALUE = 1\n',
    });
    const locked = await runCommand(['uv', 'lock'], { cwd: sandbox.path });
    expect(locked.code, locked.stdout + locked.stderr).toBe(0);
    commitAll(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const repeated = await spawnGspot(sandbox.path, ['install', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(JSON.parse(repeated.stdout)).toMatchObject({ installed: [], written: [], deleted: [], updated: [] });
});
