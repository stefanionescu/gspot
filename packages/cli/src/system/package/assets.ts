import { createRequire } from 'node:module';
import { statSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { compareText } from '#cli/system/text/order.ts';
import { CLI_PACKAGE_JSON } from '#cli/config/system.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';

const packageFolder = dirname(createRequire(import.meta.url).resolve(CLI_PACKAGE_JSON));

export function buildAssetPath(path: string): string {
    return join(packageFolder, path);
}

export function listAssets(prefix: string): string[] {
    const folder = join(packageFolder, prefix);
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    return readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter((file) => file.isFile())
        .map((file) => convertToPosixPath(relative(packageFolder, join(file.parentPath, file.name))))
        .toSorted((a, b) => compareText(a, b));
}
