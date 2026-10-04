import ts from 'typescript';
import { toPosix } from '#cli/platform/paths.ts';
import { join, dirname, relative } from 'node:path';
import type { ModuleContext } from '#cli/types/repository/inventory.ts';

const projects = new WeakMap<object, Map<string, ts.CompilerOptions>>();

/**
 * Read the nearest project's module-resolution options once for an importing file.
 * @param input the repository and run cache.
 * @param path the importing source path relative to the repository.
 * @returns the compiler options shared by import nodes in this file.
 */
export function getCompilerOptions(input: ModuleContext, path: string): ts.CompilerOptions {
    const directory = dirname(join(input.root, path));
    const configuration = ts.findConfigFile(directory, (path) => ts.sys.fileExists(path)) ?? '';
    let held = projects.get(input.reads);
    if (held === undefined) {
        held = new Map();
        projects.set(input.reads, held);
    }
    let options = held.get(configuration);
    if (options === undefined) {
        const parsed =
            configuration === ''
                ? undefined
                : ts.getParsedCommandLineOfConfigFile(
                      configuration,
                      {},
                      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
                  );
        options = {
            ...parsed?.options,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            allowJs: true,
            resolveJsonModule: true,
        };
        held.set(configuration, options);
    }
    return options;
}

/** Resolve a module with the importing project's TypeScript settings.
 * @param input the repository and run cache.
 * @param path the importing source path.
 * @param specifier the module written in the import.
 * @param options the importing file's compiler options.
 * @returns the resolved path relative to the repository, or undefined when unavailable.
 */
export function modulePath(
    input: ModuleContext,
    path: string,
    specifier: string,
    options: ts.CompilerOptions,
): string | undefined {
    const file = join(input.root, path);
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    if (resolved === undefined) return undefined;
    return toPosix(relative(input.root, resolved.resolvedFileName));
}
