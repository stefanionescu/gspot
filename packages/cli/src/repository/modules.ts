import ts from 'typescript';
import { join, dirname, relative } from 'node:path';
import { toPosix } from '#cli/platform/contracts.ts';
import { getTsconfig } from '#cli/parsers/packages/public.ts';
import type { ModuleContext } from '#cli/types/repository/inventory.ts';

/** Resolve a module with the importing project's TypeScript settings.
 * @param input the repository and run cache.
 * @param path the importing source path.
 * @param specifier the module written in the import.
 * @returns the resolved path relative to the repository, or undefined when unavailable.
 */
export function modulePath(input: ModuleContext, path: string, specifier: string): string | undefined {
    const file = join(input.root, path);
    const configuration = ts.findConfigFile(dirname(file), (path) => ts.sys.fileExists(path));
    const options = {
        ...(configuration === undefined ? undefined : getTsconfig(input.root, configuration, input.reads)?.options),
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowJs: true,
        resolveJsonModule: true,
    };
    const module = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    if (module === undefined) return undefined;
    return toPosix(relative(input.root, module.resolvedFileName));
}
