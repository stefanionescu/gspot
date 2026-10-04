import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { NpmPackageIdentity } from '#automation/types/npm.ts';

// Packing writes one archive into the requested destination; a reported path must remain a local filename.
export const npmPackSchema = z.tuple([z.object({ filename: z.string().regex(/^[^/\\]+\.tgz$/u) })]).rest(z.unknown());

export const npmPackageIdentitySchema = z.object({ name: z.string(), version: z.string() });

/**
 * Locate the owning installed package from its resolved public entry point.
 * @param entry the resolved module file
 * @param packageName the expected package name
 * @returns the validated name and installed version
 */
export function readInstalledNpmPackage(entry: string, packageName: string): NpmPackageIdentity {
    for (let folder = dirname(entry); folder !== dirname(folder); folder = dirname(folder)) {
        let text: string;
        try {
            text = readFileSync(join(folder, 'package.json'), 'utf8');
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
            continue;
        }
        const document = npmPackageIdentitySchema.parse(JSON.parse(text));
        if (document.name === packageName) return document;
    }
    throw new Error(`No installed package named ${packageName} owns ${entry}.`);
}
