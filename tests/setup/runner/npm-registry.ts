import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { REGISTRY_HOST } from '#tests/config/setup/sandboxes.ts';
import { TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { type NpmRegistry, type PackedPackage, type RegistryPackage } from '#tests/types/packages.ts';

import {
    NPM_PACK_FLAGS,
    UPSTREAM_REGISTRY,
    PACKED_PUBLISH_TIME,
    GSPOT_PACKAGE_SCOPE,
    PACKED_PACKAGES_FILE,
    AUTHENTICATION_REQUIRED_MESSAGE,
} from '#tests/config/setup/runner.ts';

/**
Pack these npm packages into the folder and write the list the registry serves.
*/
export async function runNpmPack(workFolder: string, declarations: readonly RegistryPackage[]): Promise<string> {
    const packages: PackedPackage[] = [];
    for (const { source, ...declaration } of declarations) {
        const result = await runCommand(['npm', 'pack', source, ...NPM_PACK_FLAGS, '--pack-destination', workFolder], {
            cwd: workFolder,
        });
        if (result.code !== 0) throw new Error(`Package packing failed: ${result.stdout}${result.stderr}`);
        const { filename } = (JSON.parse(result.stdout) as [{ filename: string }])[0];
        const archive = await readFile(join(workFolder, filename));
        packages.push({
            ...declaration,
            filename: join(workFolder, filename),
            integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
        });
    }
    const packagesFile = join(workFolder, PACKED_PACKAGES_FILE);
    await writeFile(packagesFile, JSON.stringify(packages));
    return packagesFile;
}

async function answerRegistryRequest(
    request: Request,
    registry: { packages: Map<string, PackedPackage>; token: string | undefined },
): Promise<Response> {
    if (registry.token !== undefined && request.headers.get('authorization') !== `Bearer ${registry.token}`)
        return Response.json({ error: AUTHENTICATION_REQUIRED_MESSAGE }, { status: 401 });
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname.slice(1));
    const [name = ''] = pathname.split('/-/', 1);
    const packed = registry.packages.get(name);
    if (packed === undefined)
        return name.startsWith(GSPOT_PACKAGE_SCOPE)
            ? Response.json({ error: 'Package not found' }, { status: 404 })
            : Response.redirect(new URL(url.pathname, UPSTREAM_REGISTRY));
    const tarball = `${name}/-/${name.slice(name.lastIndexOf('/') + 1)}-${packed.version}.tgz`;
    if (pathname.includes('/-/'))
        return pathname === tarball
            ? new Response(await readFile(packed.filename))
            : Response.json({ error: 'Package not found' }, { status: 404 });
    return Response.json(buildPackageDocument(packed, `${url.origin}/${tarball}`));
}

function buildPackageDocument(packed: PackedPackage, tarball: string): Record<string, unknown> {
    const { filename: _filename, integrity, ...packageFields } = packed;
    const publishedAt = packed.name.startsWith(GSPOT_PACKAGE_SCOPE) ? new Date().toISOString() : PACKED_PUBLISH_TIME;
    return {
        name: packed.name,
        'dist-tags': { latest: packed.version },
        time: { [packed.version]: publishedAt },
        versions: { [packed.version]: { ...packageFields, dist: { tarball, integrity } } },
    };
}

/**
Serve the packed npm packages and any extra packages that a credential test asks for.
*/
export async function startNpmRegistry(
    workFolder: string,
    options: { packages?: readonly RegistryPackage[]; token?: string } = {},
): Promise<NpmRegistry> {
    const files = [join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE)];
    if (options.packages !== undefined && options.packages.length > 0)
        files.push(await runNpmPack(workFolder, options.packages));

    const packages = new Map<string, PackedPackage>();
    for (const file of files) {
        const packedPackages = JSON.parse(await readFile(file, 'utf8')) as PackedPackage[];
        for (const packed of packedPackages) packages.set(packed.name, packed);
    }
    const server = Bun.serve({
        hostname: REGISTRY_HOST,
        port: 0,
        fetch: (request) => {
            registry.requests++;
            return answerRegistryRequest(request, { packages, token: options.token });
        },
    });
    const url = `http://${REGISTRY_HOST}:${String(server.port)}`;
    const npmrc = join(workFolder, '.npmrc');
    await writeFile(npmrc, `${GSPOT_PACKAGE_SCOPE.slice(0, -1)}:registry=${url}/\n`, { mode: 0o600 });
    const registry: NpmRegistry = {
        url,
        npmrc,
        requests: 0,
        [Symbol.dispose]: server[Symbol.dispose].bind(server),
    };
    return registry;
}
