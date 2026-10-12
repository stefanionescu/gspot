// Packs packages, serves their registry, and installs sandbox tool projects.
import { z } from 'zod';
import { expect } from 'bun:test';
import { testdir } from 'testdirs';
import { createHash } from 'node:crypto';
import { join, delimiter } from 'node:path';
import { emitAll } from '#cli/generation/files.ts';
import { rejection } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { prepareLockfiles } from '#cli/tools/lockfiles.ts';
import { installNpmTools } from '#cli/tools/npm/project.ts';
import type { OwnershipLog } from '#cli/types/ownership.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { SandboxSettings } from '#tests/types/sandbox.ts';
import { environmentVariables } from '#cli/system/environment.ts';
import { installPythonTools } from '#cli/tools/python/project.ts';
import { toolProjectLockfile } from '#cli/parsers/tool-project.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';
import { testModules, installedModules } from '#tests/setup/modules.ts';
import type { LockedInputs, ToolProjectFiles } from '#tests/types/npm.ts';
import type { NpmRegistry, PackedPackage, RegistryPackage } from '#tests/types/e2e.ts';
import { open, mkdir, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

import {
    HTTP_REDIRECT,
    REGISTRY_HOST,
    NPM_PACK_FLAGS,
    UPSTREAM_REGISTRY,
    GSPOT_PACKAGE_SCOPE,
    PACKED_PACKAGES_FILE,
} from '#tests/config/integration.ts';

const npmPackSchema = z
    .tuple([z.object({ filename: z.string() } satisfies SchemaShape<{ filename: string }>)])
    .rest(z.unknown()) satisfies z.ZodType<[{ filename: string }, ...unknown[]]>;
const packedPackagesSchema = z.array(
    z.object({
        name: z.string(),
        version: z.string(),
        filename: z.string(),
        integrity: z.string(),
        bin: z.record(z.string(), z.string()).optional(),
        dependencies: z.record(z.string(), z.string()).optional(),
        peerDependencies: z.record(z.string(), z.string()).optional(),
    } satisfies SchemaShape<PackedPackage>),
);

/** Resolve the installed test package executables before system tools. */
export function toolsPath(): string {
    return [join(testModules, '.bin'), join(installedModules, '.bin'), environmentVariables()['PATH'] ?? ''].join(
        delimiter,
    );
}

/** Resolve the integration preload command before installed tools. */
export function sandboxPath(): string {
    const folder = environmentVariables()['GSPOT_TEST_RUN_FOLDER'];
    if (folder === undefined) throw new Error('The test run folder is not configured.');
    return [join(folder, 'bin'), toolsPath()].join(delimiter);
}

/** Initialize a sandbox and install the tools selected for its integration tests. */
export async function initRepository(
    root: string,
    argv: string[],
    environment: Record<string, string>,
    settings: SandboxSettings = {},
): Promise<void> {
    const initialized = await spawnGspot(root, argv, environment);
    expect(initialized.code, `Sandbox init failed: ${initialized.stdout}${initialized.stderr}`).toBe(0);

    if (settings.level !== undefined) {
        const level = await spawnGspot(root, ['set', 'level', settings.level], environment);
        if (level.code !== 0) throw new Error(`Sandbox level failed: ${level.stdout}${level.stderr}`);
    }
    for (const configuration of settings.without ?? []) {
        const removed = await spawnGspot(root, ['remove', configuration], environment);
        if (removed.code !== 0) throw new Error(`Sandbox remove failed: ${removed.stdout}${removed.stderr}`);
    }

    await using registry = await createInstallationRegistry(root, runCommand);
    Object.assign(environment, registry.environment);
    const installed = await spawnGspot(root, ['install'], environment);
    if (installed.code !== 0) throw new Error(`Sandbox install failed: ${installed.stdout}${installed.stderr}`);
}

/** Generate the sandbox's tool files and install its tools through the public CLI commands. */
export async function installToolProjects(root: string): Promise<void> {
    const applied = await spawnGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`Sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    await using registry = await createInstallationRegistry(root, runCommand);
    const installed = await spawnGspot(root, ['install'], registry.environment);
    if (installed.code !== 0) throw new Error(`Sandbox install failed: ${installed.stdout}${installed.stderr}`);
}

/** Pack the local npm packages once for the current integration run. */
export async function packPackages(
    work: string,
    declarations: readonly RegistryPackage[],
    execute: typeof runCommand,
): Promise<string> {
    const packages: PackedPackage[] = [];
    for (const { source, ...declaration } of declarations) {
        const result = await execute(['npm', 'pack', source, ...NPM_PACK_FLAGS, '--pack-destination', work], {
            cwd: work,
        });
        if (result.code !== 0) throw new Error(`Package packing failed: ${result.stdout}${result.stderr}`);
        const { filename } = npmPackSchema.parse(JSON.parse(result.stdout))[0];
        const archive = await readFile(join(work, filename));
        packages.push({
            ...declaration,
            filename: join(work, filename),
            integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
        });
    }
    const manifest = join(work, PACKED_PACKAGES_FILE);
    await writeFile(manifest, JSON.stringify(packages));
    return manifest;
}

/** Serve packed npm packages and the additional packages selected by a credential test. */
export async function createNpmRegistry(
    work: string,
    options: { declarations: readonly RegistryPackage[]; execute: typeof runCommand; token?: string },
): Promise<NpmRegistry> {
    const folder = environmentVariables()['GSPOT_TEST_RUN_FOLDER'];
    if (folder === undefined) throw new Error('The test run folder is not configured.');
    const files = [join(folder, PACKED_PACKAGES_FILE)];
    if (options.declarations.length > 0) files.push(await packPackages(work, options.declarations, options.execute));

    const packages = new Map<string, PackedPackage>();
    for (const file of files)
        for (const entry of packedPackagesSchema.parse(JSON.parse(await readFile(file, 'utf8'))))
            packages.set(entry.name, entry);
    let requests = 0;
    const server = Bun.serve({
        hostname: REGISTRY_HOST,
        port: 0,
        fetch(request) {
            requests++;
            if (options.token !== undefined && request.headers.get('authorization') !== `Bearer ${options.token}`)
                return Response.json({ error: 'Authentication required' }, { status: 401 });
            const url = new URL(request.url);
            const pathname = decodeURIComponent(url.pathname.slice(1));
            const name = pathname.split('/-/', 1).join('');
            const entry = packages.get(name);
            if (entry === undefined)
                return name.startsWith(GSPOT_PACKAGE_SCOPE)
                    ? Response.json({ error: 'Package not found' }, { status: 404 })
                    : Response.redirect(new URL(url.pathname, UPSTREAM_REGISTRY), HTTP_REDIRECT);
            const tarball = `${name}/-/${name.slice(name.lastIndexOf('/') + 1)}-${entry.version}.tgz`;
            if (pathname.includes('/-/'))
                return pathname === tarball
                    ? new Response(Bun.file(entry.filename))
                    : Response.json({ error: 'Package not found' }, { status: 404 });
            const { filename: _filename, integrity, ...manifest } = entry;
            return Response.json({
                name,
                'dist-tags': { latest: entry.version },
                versions: {
                    [entry.version]: { ...manifest, dist: { tarball: `${url.origin}/${tarball}`, integrity } },
                },
            });
        },
    });
    const url = `http://${REGISTRY_HOST}:${String(server.port)}`;
    const npmrc = join(work, '.npmrc');
    await writeFile(npmrc, `@gspothq:registry=${url}/\n`, { mode: 0o600 });
    return {
        url,
        npmrc,
        get requests() {
            return requests;
        },
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}

/** Give one installation its private npm settings while local packages remain unpublished. */
export async function createInstallationRegistry(
    root: string,
    execute: typeof runCommand,
): Promise<AsyncDisposable & { environment: Record<string, string> }> {
    const resources = new AsyncDisposableStack();
    try {
        const environment: Record<string, string> = {};
        if (await Bun.file(join(root, '.gspot/package.json')).exists()) {
            const work = resources.use(await testdir());
            const registry = resources.use(await createNpmRegistry(work.path, { declarations: [], execute }));
            environment['NPM_CONFIG_USERCONFIG'] = registry.npmrc;
        }
        return {
            environment,
            async [Symbol.asyncDispose]() {
                await resources.disposeAsync();
            },
        };
    } catch (error) {
        await resources.disposeAsync();
        throw error;
    }
}

/** Check that a refused install reports its reason before making another registry request. */
export async function expectRefusedInstall(
    root: string,
    tools: Iterable<ToolDeclaration>,
    diagnostic: string,
    registry: { readonly requests: number },
): Promise<void> {
    using owner = openOwnershipLog(root);
    const session = await openSession(root);
    const requests = registry.requests;
    const installation =
        owner.files.read('.gspot/package.json') === undefined
            ? installPythonTools(root, owner.files, 'uv', session.cancelSignal, session.timeoutSeconds, [])
            : installNpmTools(session, owner.files, tools, []);
    expect(await rejection(installation)).toContain(diagnostic);
    expect(registry.requests).toBe(requests);
}

/** Resolve and write the selected project inputs before exercising locked installation. */
export async function writeLockedInputs(root: string, suppliedLog?: OwnershipLog): Promise<LockedInputs> {
    using resources = new DisposableStack();
    const log = suppliedLog ?? resources.use(openOwnershipLog(root));
    const session = await openSession(root);
    const generated = emitAll(session);
    writeGeneratedFiles(session, generated, log);
    if (log.files.read('.gspot/mise.toml') !== undefined) {
        const trusted = await runCommand(['mise', 'trust', '.gspot/mise.toml'], { cwd: root });
        if (trusted.code !== 0) throw new Error(`Sandbox tool trust failed: ${trusted.stdout}${trusted.stderr}`);
    }
    await prepareLockfiles(session, generated.files, log.files, []);
    writeGeneratedFiles(session, generated, log);
    const client = session.npmClient();
    const inputs = client === undefined ? undefined : await readToolProjectFiles(root, client.name);
    const lockfilePath = join(root, '.gspot/uv.lock');
    return {
        session,
        ...(inputs === undefined ? {} : { inputs }),
        ...(log.files.read('.gspot/pyproject.toml') === undefined
            ? {}
            : {
                  manifest: await readFile(join(root, '.gspot/pyproject.toml')),
                  lockfilePath,
                  lockfile: await readFile(lockfilePath),
              }),
    };
}

/** Link the installed TypeScript package and its executable launchers. */
export async function installCompiler(root: string, folder = join(root, 'node_modules')): Promise<string> {
    await mkdir(folder, { recursive: true });
    const kind = isWindows ? 'junction' : 'dir';
    await symlink(await realpath(join(installedModules, 'typescript')), join(folder, 'typescript'), kind);
    await symlink(await realpath(join(installedModules, '.bin')), join(folder, '.bin'), kind);
    return [join(folder, '.bin'), environmentVariables()['PATH'] ?? ''].join(delimiter);
}

/** Captures the generated manifest, lockfile, and ownership bytes before an installation journey. */
export async function readToolProjectFiles(root: string, installer: NpmClient['name']): Promise<ToolProjectFiles> {
    const lockfilePath = join(root, '.gspot', toolProjectLockfile(installer));
    const ownershipPath = join(root, '.gspot/state/ownership.json');
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        manifest: await readFile(join(root, '.gspot/package.json')),
        lockfilePath,
        lockfile: await lockfile.readFile(),
        mode: attributes.mode,
        ownershipPath,
        ownership: await readFile(ownershipPath),
    };
}
