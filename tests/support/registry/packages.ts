import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import type { RegistryPackage } from '#tests/types/registry.ts';

/** Packs actual npm packages and serves their bytes from an authenticated, isolated registry. */
export async function createPackageRegistry(work: string, declarations: RegistryPackage[]) {
    const packages = new Map<string, RegistryPackage & { archive: Buffer; integrity: string }>();
    for (const declaration of declarations) {
        const packed = await run(
            ['npm', 'pack', declaration.source, '--ignore-scripts', '--json', '--pack-destination', work],
            { cwd: work, timeoutMs: 30_000 },
        );
        if (packed.code !== 0) throw new Error(`Package fixture packing failed: ${packed.stdout}${packed.stderr}`);
        const archive = readFileSync(join(work, (JSON.parse(packed.stdout) as { filename: string }[])[0]!.filename));
        packages.set(declaration.name, {
            ...declaration,
            archive,
            integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
        });
    }
    const token = 'synthetic-package-install-token';
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
