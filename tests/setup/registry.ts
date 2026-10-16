import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runCommand } from '#tests/setup/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { testRunFolder } from '#tests/setup/install.ts';
import type { NpmRegistry, PackedPackage, RegistryPackage } from '#tests/types/packages.ts';

import {
    HTTP_REDIRECT,
    REGISTRY_HOST,
    NPM_PACK_FLAGS,
    UPSTREAM_REGISTRY,
    GSPOT_PACKAGE_SCOPE,
    PACKED_PUBLISH_TIME,
    PACKED_PACKAGES_FILE,
} from '#tests/data/test-setup.ts';

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
    const manifest = join(work, PACKED_PACKAGES_FILE);
    await writeFile(manifest, JSON.stringify(packages));
    return manifest;
}

/** Serve packed npm packages and the additional packages selected by a credential test. */
export async function createNpmRegistry(
    work: string,
    options: { declarations: readonly RegistryPackage[]; token?: string },
): Promise<NpmRegistry> {
    const folder = testRunFolder();
    const files = [join(folder, PACKED_PACKAGES_FILE)];
    if (options.declarations.length > 0) files.push(await runNpmPack(work, options.declarations));

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
                time: { [entry.version]: PACKED_PUBLISH_TIME },
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
