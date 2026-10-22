// Packs the npm packages of this checkout and serves them from a local npm registry.
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { TEST_RUN_FOLDER } from '#tests/setup/runner/checkout.ts';
import { PACKED_PACKAGES_FILE } from '#tests/config/setup/environment.ts';
import type { NpmRegistry, PackedPackage, RegistryPackage } from '#tests/types/packages.ts';

import {
    REGISTRY_HOST,
    NPM_PACK_FLAGS,
    UPSTREAM_REGISTRY,
    PACKED_PUBLISH_TIME,
    GSPOT_PACKAGE_SCOPE,
} from '#tests/config/setup/sandboxes.ts';

/** Pack the local npm packages once for the current integration run. */
export async function runNpmPack(work: string, declarations: readonly RegistryPackage[]): Promise<string> {
    const packages: PackedPackage[] = [];
    for (const { source, ...declaration } of declarations) {
        const result = await runCommand(['npm', 'pack', source, ...NPM_PACK_FLAGS, '--pack-destination', work], {
            cwd: work,
        });
        if (result.code !== 0) throw new Error(`Package packing failed: ${result.stdout}${result.stderr}`);
        const { filename } = (JSON.parse(result.stdout) as [{ filename: string }])[0];
        const archive = await readFile(join(work, filename));
        packages.push({
            ...declaration,
            filename: join(work, filename),
            integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
        });
    }
    const packagesFile = join(work, PACKED_PACKAGES_FILE);
    await writeFile(packagesFile, JSON.stringify(packages));
    return packagesFile;
}

/**
 * Answer one request of the test registry: a packed package, its tarball, or a redirect to the upstream registry.
 *
 * @param request what npm or the package manager asked for.
 * @param registry the packages that the registry serves, and who may read them.
 * @param registry.packages the packed packages by name.
 * @param registry.token the token that each request must carry; without one, every request passes.
 * @returns the package document, the tarball, an error, or the redirect.
 */
async function answerRegistryRequest(
    request: Request,
    registry: { packages: Map<string, PackedPackage>; token: string | undefined },
): Promise<Response> {
    if (registry.token !== undefined && request.headers.get('authorization') !== `Bearer ${registry.token}`)
        return Response.json({ error: 'Authentication required' }, { status: 401 });
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname.slice(1));
    const name = pathname.split('/-/', 1).join('');
    const entry = registry.packages.get(name);
    if (entry === undefined)
        return name.startsWith(GSPOT_PACKAGE_SCOPE)
            ? Response.json({ error: 'Package not found' }, { status: 404 })
            : Response.redirect(new URL(url.pathname, UPSTREAM_REGISTRY));
    const tarball = `${name}/-/${name.slice(name.lastIndexOf('/') + 1)}-${entry.version}.tgz`;
    if (pathname.includes('/-/'))
        return pathname === tarball
            ? new Response(await readFile(entry.filename))
            : Response.json({ error: 'Package not found' }, { status: 404 });
    return Response.json(buildPackageDocument(entry, `${url.origin}/${tarball}`));
}

// The registry document of one packed package. The registry dates a gspot package now, as on release day, so the
// release hold must let it through.
function buildPackageDocument(entry: PackedPackage, tarball: string): Record<string, unknown> {
    const { filename: _filename, integrity, ...packageFields } = entry;
    const publishedAt = entry.name.startsWith(GSPOT_PACKAGE_SCOPE) ? new Date().toISOString() : PACKED_PUBLISH_TIME;
    return {
        name: entry.name,
        'dist-tags': { latest: entry.version },
        time: { [entry.version]: publishedAt },
        versions: { [entry.version]: { ...packageFields, dist: { tarball, integrity } } },
    };
}

/** Serve the packed npm packages and any extra packages that a credential test asks for. */
export async function createNpmRegistry(
    work: string,
    options: { packages: readonly RegistryPackage[]; token?: string },
): Promise<NpmRegistry> {
    const folder = TEST_RUN_FOLDER;
    const files = [join(folder, PACKED_PACKAGES_FILE)];
    if (options.packages.length > 0) files.push(await runNpmPack(work, options.packages));

    const packages = new Map<string, PackedPackage>();
    for (const file of files)
        for (const entry of JSON.parse(await readFile(file, 'utf8')) as PackedPackage[])
            packages.set(entry.name, entry);
    let requests = 0;
    const server = Bun.serve({
        hostname: REGISTRY_HOST,
        port: 0,
        fetch(request) {
            requests++;
            return answerRegistryRequest(request, { packages, token: options.token });
        },
    });
    const url = `http://${REGISTRY_HOST}:${String(server.port)}`;
    const npmrc = join(work, '.npmrc');
    await writeFile(npmrc, `${GSPOT_PACKAGE_SCOPE.slice(0, -1)}:registry=${url}/\n`, { mode: 0o600 });
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
