// Creates isolated Python sandboxes and serves their authenticated package index.
import { createHash } from 'node:crypto';
import { createFileTree } from 'testdirs';
import { join, basename } from 'node:path';
import { commitAll } from '#tests/setup/git.ts';
import { DIGEST_ALGORITHM } from '#cli/config/text.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { encodeZipArchive } from '#tests/setup/files.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import type { IndexedPythonSandbox } from '#tests/types/packages.ts';
import { runSandboxStep, installToolProjects, readToolProjectFiles } from '#tests/setup/install.ts';

import {
    ZIP_LAYOUT,
    REGISTRY_HOST,
    PYTHON_INDEX_NAME,
    RUFF_VERSION_OUTPUT,
    PYTHON_SANDBOX_FILES,
    UV_PROJECT_VARIABLES,
    PYTHON_SANDBOX_IGNORES,
    PYTHON_INDEX_CREDENTIALS,
} from '#tests/data/test-setup.ts';

/** Creates a Python project with a lockfile and points the uv variables at the sandbox. */
export async function createPythonSandbox(
    root: string,
    options: { indexFile: 'pyproject.toml' | 'uv.toml'; indexUrl?: string },
): Promise<{
    root: string;
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
    [Symbol.asyncDispose](): Promise<void>;
}> {
    const { indexFile, indexUrl } = options;
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'gspot.toml': buildSandboxSettings(['python'], {
            ignore: { checks: PYTHON_SANDBOX_IGNORES, reason: 'This test exercises the pinned Ruff installation.' },
            level: 'recommended',
        }),
        ...PYTHON_SANDBOX_FILES,
    });
    const resources = new AsyncDisposableStack();
    resources.use(
        overrideEnvironment(
            Object.fromEntries<string | undefined>([
                ['UV_DEFAULT_INDEX', undefined],
                ...UV_PROJECT_VARIABLES.map(
                    (name) => [name, name === 'UV_PROJECT_ENVIRONMENT' ? join(root, '.venv') : root] as const,
                ),
            ]),
        ),
    );
    try {
        const indexPrefix = indexFile === 'pyproject.toml' ? 'tool.uv.' : '';
        const index =
            indexUrl === undefined
                ? ''
                : `[[${indexPrefix}index]]\nname = "${PYTHON_INDEX_NAME}"\nurl = "${indexUrl}"\ndefault = true\n`;
        const authored = indexFile === 'pyproject.toml' ? await readFile(join(root, indexFile), 'utf8') : '';
        await writeFile(join(root, indexFile), authored + index);
        const rootProject = await readFile(join(root, 'pyproject.toml'));
        const rootConfiguration = await readFile(join(root, indexFile));
        commitAll(root);
        await runSandboxStep({ root, environment: {}, run: spawnGspot }, ['apply']);
        return {
            root,
            rootProject,
            rootConfiguration,
            async [Symbol.asyncDispose]() {
                await resources.disposeAsync();
            },
        };
    } catch (error) {
        await resources.disposeAsync();
        throw error;
    }
}

/**
 * Serve a wheel with the installed Ruff executable.
 *
 * @param work the temporary folder receiving the wheel.
 * @returns an authenticated registry serving the wheel.
 */
async function createPythonIndex(work: string): Promise<AsyncDisposable & { url: string }> {
    await using source = await createPythonSandbox(work, { indexFile: 'uv.toml' });
    await installToolProjects(source.root);
    const binary = buildVenvExecutablePath(join(work, '.gspot/.venv'), 'ruff');
    const inspected = await runCommand([binary, '--version'], { cwd: work });
    if (inspected.code !== 0) throw new Error(`Ruff version failed: ${inspected.stderr}`);
    const version = RUFF_VERSION_OUTPUT.exec(inspected.stdout.trim())?.groups?.['version'];
    if (version === undefined) throw new Error('Ruff version output is invalid.');
    const wheel = `ruff-${version}-py3-none-any.whl`;
    const entries = await buildWheelEntries(binary, version);
    const archive = encodeZipArchive(
        entries.map(
            ([name, data]) =>
                [
                    name,
                    data,
                    name.endsWith(`/${basename(binary)}`) ? ZIP_LAYOUT.unix.executable : ZIP_LAYOUT.unix.regular,
                ] as const,
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
export async function createIndexedPythonSandbox(
    root: string,
    work: string,
    indexFile: 'pyproject.toml' | 'uv.toml',
): Promise<IndexedPythonSandbox> {
    await using resources = new AsyncDisposableStack();
    const registry = resources.use(await createPythonIndex(work));
    const project = resources.use(await createPythonSandbox(root, { indexFile, indexUrl: registry.url }));
    await installToolProjects(root);
    const inputs = await readToolProjectFiles(root, 'uv');
    const owned = resources.move();
    return {
        rootProject: project.rootProject,
        rootConfiguration: project.rootConfiguration,
        inputs,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
