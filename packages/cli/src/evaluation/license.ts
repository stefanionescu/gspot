import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { LicenseChecker } from '#cli/types/evaluation.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { licenseRequest, licenseResponse } from '#cli/evaluation/protocol.ts';

const reportSchema = z.record(
    z.string(),
    z.object({ licenses: z.union([z.string(), z.array(z.string())]).optional() }),
);

// Resolve from an observed project directory only after its manifest passes confined access.
function installedProject(root: string, from: string): string {
    const files = openConfinedRoot(root);
    try {
        const path = dirname(from);
        if (path !== '.') files.stat(path);
        const manifest = path === '.' ? 'package.json' : `${path}/package.json`;
        if (files.read(manifest) === undefined)
            throw new Error('License adoption requires an installed project manifest.');
        return join(root, path);
    } finally {
        files.close();
    }
}

/**
 * Resolve excluded packages through the installed scanner before adopting version-bound exceptions.
 * @param request the source project and package exclusions to resolve
 * @returns the installed package identities and license expressions
 */
export async function evaluateLicenses(
    request: z.infer<typeof licenseRequest>,
): Promise<z.infer<typeof licenseResponse>> {
    const start = installedProject(request.root, request.from);
    const require = createRequire(join(start, 'package.json'));
    const checker = (await import(
        pathToFileURL(require.resolve('license-checker-rseidelsohn')).href
    )) as LicenseChecker;
    const exceptions = new Map<string, string>();
    for (const exclusion of request.exclusions) {
        const report = reportSchema.parse(
            await new Promise<unknown>((resolve, reject) => {
                checker.init({ start, includePackages: exclusion, excludePrivatePackages: true }, (error, report) => {
                    if (error === null) resolve(report);
                    else reject(error);
                });
            }),
        );
        if (Object.keys(report).length === 0)
            throw new Error(
                `Cannot resolve excluded package ${JSON.stringify(exclusion)}. Install its dependencies before adoption.`,
            );
        for (const [name, entry] of Object.entries(report))
            exceptions.set(
                name,
                Array.isArray(entry.licenses) ? entry.licenses.join(' OR ') : (entry.licenses ?? 'UNKNOWN'),
            );
    }
    return [...exceptions].map(([name, license]) => ({ package: name, license }));
}
