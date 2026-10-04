import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { npmPackSchema } from '#automation/parsers/npm.ts';
import { PACKAGE_REGISTRY_TOKEN, REGISTRY_PACK_TIMEOUT_MS } from '#automation/config/registry.ts';

import type {
    PackageRegistry,
    RegistryCommand,
    RegistryPackage,
    PackedRegistryPackage,
} from '#automation/types/registry.ts';

/**
 * Pack npm packages and serve their bytes from an authenticated registry.
 * @param work the temporary folder receiving archives
 * @param declarations the declared packages to archive
 * @param execute the caller's bounded command runner
 * @returns an authenticated registry serving the archives
 */
export async function createPackageRegistry(
    work: string,
    declarations: RegistryPackage[],
    execute: RegistryCommand,
): Promise<PackageRegistry> {
    const packages = new Map<string, PackedRegistryPackage>();
    for (const declaration of declarations) {
        const packed = await execute(
            ['npm', 'pack', declaration.source, '--ignore-scripts', '--json', '--pack-destination', work],
            { cwd: work, timeoutMs: REGISTRY_PACK_TIMEOUT_MS },
        );
        if (packed.code !== 0) throw new Error(`Package fixture packing failed: ${packed.stdout}${packed.stderr}`);
        const [{ filename }] = npmPackSchema.parse(JSON.parse(packed.stdout));
        const archive = readFileSync(join(work, filename));
        packages.set(declaration.name, {
            ...declaration,
            archive,
            integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
        });
    }
    const token = PACKAGE_REGISTRY_TOKEN;
    let requests = 0;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            requests++;
            if (request.headers.get('authorization') !== `Bearer ${token}`)
                return Response.json({ error: 'Authentication required' }, { status: 401 });
            const url = new URL(request.url);
            const name = url.pathname.slice(1).replace(/\.tgz$/u, '');
            const entry = packages.get(name);
            if (entry === undefined) return Response.json({ error: 'Package not found' }, { status: 404 });
            if (url.pathname.endsWith('.tgz')) return new Response(new Uint8Array(entry.archive));
            return Response.json({
                name,
                'dist-tags': { latest: entry.version },
                versions: {
                    [entry.version]: {
                        name,
                        version: entry.version,
                        bin: entry.bin,
                        dist: { tarball: `${url.origin}/${name}.tgz`, integrity: entry.integrity },
                    },
                },
            });
        },
    });
    return {
        token,
        url: `http://127.0.0.1:${String(server.port)}`,
        get requests() {
            return requests;
        },
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}
