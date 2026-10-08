// Bun owns the loopback npm server used by installation tests and automation.
import { z } from 'zod';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { npmPackSchema } from '#automation/parsers/npm.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

import type {
    PackageRegistry,
    RegistryCommand,
    RegistryPackage,
    InstallationRegistry,
    PackedRegistryPackage,
    PackageRegistryOptions,
} from '#tests/types/harness/registry.ts';

/** The runner's artifact metadata retains only npm installation fields. */
export const packedPackagesSchema = z.array(
    z.object({
        name: z.string(),
        version: z.string(),
        filename: z.string(),
        integrity: z.string(),
        bin: z.record(z.string(), z.string()).optional(),
        dependencies: z.record(z.string(), z.string()).optional(),
        peerDependencies: z.record(z.string(), z.string()).optional(),
    }),
);

/**
 * Pack the run's packages once and record their archive paths and npm metadata.
 * @param work the temporary archive folder
 * @param declarations the package sources to pack
 * @param execute the caller's install command runner
 * @returns the metadata file shared with installation tests
 */
export async function packRegistryPackages(
    work: string,
    declarations: RegistryPackage[],
    execute: RegistryCommand,
): Promise<string> {
    const packages: PackedRegistryPackage[] = [];
    for (const { source, ...declaration } of declarations) {
        const packed = await execute(
            ['npm', 'pack', source, '--ignore-scripts', '--json', '--pack-destination', work],
            { cwd: work },
        );
        if (packed.code !== 0) throw new Error(`Package packing failed: ${packed.stdout}${packed.stderr}`);
        const [{ filename }] = npmPackSchema.parse(JSON.parse(packed.stdout));
        const archive = await readFile(join(work, filename));
        packages.push({
            ...declaration,
            filename: join(work, filename),
            integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
        });
    }
    const manifest = join(work, 'packages.json');
    await writeFile(manifest, JSON.stringify(packages));
    return manifest;
}

/**
 * Serve the run's workspace archives and any packages required by a credential test.
 * @param work the temporary folder for additional archives
 * @param options additional packages, installation, and private-registry credentials
 * @returns the local npm registry and ownership of its listen socket
 */
export async function createPackageRegistry(work: string, options: PackageRegistryOptions): Promise<PackageRegistry> {
    const { declarations, execute, token } = options;
    const metadata = environmentVariables()['GSPOT_PACKAGE_ARCHIVES'];
    if (metadata === undefined)
        throw new Error('Run npm installation tests through mise run test:tools or mise run test:package.');
    const packages = new Map<string, PackedRegistryPackage>();
    const manifests = [metadata];
    if (declarations.length > 0) manifests.push(await packRegistryPackages(work, declarations, execute));
    for (const manifest of manifests) {
        const entries = packedPackagesSchema.parse(JSON.parse(await readFile(manifest, 'utf8')));
        for (const entry of entries) packages.set(entry.name, entry);
    }
    let requests = 0;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            requests++;
            if (token !== undefined && request.headers.get('authorization') !== `Bearer ${token}`)
                return Response.json({ error: 'Authentication required' }, { status: 401 });
            const url = new URL(request.url);
            const pathname = decodeURIComponent(url.pathname.slice(1));
            const separator = pathname.indexOf('/-/');
            const name = separator === -1 ? pathname : pathname.slice(0, separator);
            const entry = packages.get(name);
            if (entry === undefined) return Response.json({ error: 'Package not found' }, { status: 404 });
            const tarball = `${name}/-/${name.slice(name.lastIndexOf('/') + 1)}-${entry.version}.tgz`;
            if (separator !== -1) {
                if (pathname !== tarball) return Response.json({ error: 'Package not found' }, { status: 404 });
                return new Response(Bun.file(entry.filename));
            }
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
    return {
        url: `http://127.0.0.1:${String(server.port)}`,
        get requests() {
            return requests;
        },
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}

/**
 * Scope the unpublished plugin to the installation that needs the npm tool project.
 * @param root the generated repository
 * @param execute the caller's command runner
 * @returns temporary npm settings and ownership of the registry and its files
 */
export async function createInstallationRegistry(
    root: string,
    execute: RegistryCommand,
): Promise<InstallationRegistry> {
    const resources = new AsyncDisposableStack();
    try {
        const environment: Record<string, string> = {};
        if (await pathExists(join(root, '.gspot/package.json'))) {
            const work = resources.use(await testdir());
            const registry = resources.use(await createPackageRegistry(work.path, { declarations: [], execute }));
            const npmrc = join(work.path, '.npmrc');
            await writeFile(npmrc, `@gspothq:registry=${registry.url}/\n`, { mode: 0o600 });
            environment['NPM_CONFIG_USERCONFIG'] = npmrc;
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
