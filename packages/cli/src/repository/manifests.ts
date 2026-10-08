import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { toPosix } from '#cli/platform/paths.ts';
import { readText } from '#cli/platform/source.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isInScope, isToolingPath } from '#cli/repository/selectors.ts';
import { manifestParser, parsePackageManifest } from '#cli/parsers/packages.ts';
import type { DependencyMap, PackageManifest, ProjectManifest } from '#cli/types/parsers/packages.ts';

/**
 * Get dependencies from the nearest declared npm project that contains a scope.
 * @param manifests validated source project manifests
 * @param scope the repository-relative project scope
 * @returns declared dependencies without borrowing from children or siblings
 */
export function getProjectDependencies(manifests: ProjectManifest[], scope: string): DependencyMap {
    const owner = manifests
        .filter(
            (manifest) =>
                manifest.kind === 'package.json' &&
                isInScope(scope, manifest.path === 'package.json' ? '' : posix.dirname(manifest.path)),
        )
        .toSorted((first, second) => second.path.length - first.path.length)[0];
    if (owner === undefined) return {};
    return owner.dependencies;
}

/**
 * Read supported project manifests for dependency and runtime detection.
 * @param root the repository root
 * @param files the tracked files
 * @returns one project manifest per supported source file
 */
export function readManifests(root: string, files: TrackedFile[]): ProjectManifest[] {
    return files
        .filter((file) => file.kind === 'source' && !isToolingPath(file.path))
        .flatMap((file) => {
            try {
                const parse = manifestParser(file.path);
                if (parse === undefined) return [];
                const text = readText(root, file.path);
                if (text === undefined) throw new Error(`Manifest is missing: ${file.path}`);
                return [parse(text)];
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
            }
        });
}

/**
 * Read and validate the package fields used by repository and check consumers.
 * @param root the repository root
 * @param path the repository-relative package.json path
 * @returns the validated package fields, or undefined when the file is absent
 */
export function readPackageManifest(root: string, path: string): PackageManifest | undefined {
    const text = readText(root, path);
    if (text === undefined) return undefined;
    return parsePackageManifest(text, path);
}

/**
 * Read package metadata from a tool project installation or a native host installation.
 * @param files the tool project installation boundary, or undefined for a host installation.
 * @param root the repository root owning the tool-project boundary.
 * @param manifest the absolute package.json path.
 * @returns the validated package fields, or undefined when the file is absent.
 */
export function installedPackage(files: Root | undefined, root: string, manifest: string): PackageManifest | undefined {
    try {
        let text: string | undefined;
        if (files === undefined) text = readFileSync(manifest, 'utf8');
        else {
            const directory = files.realPath(toPosix(relative(root, dirname(manifest))));
            const path = toPosix(relative(root, join(directory, basename(manifest))));
            text = files.read(path)?.bytes.toString('utf8');
        }
        return text === undefined ? undefined : parsePackageManifest(text, manifest);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Read the version of a dependency resolved from its actual project manifest, including hoisted installations.
 * @param root the repository root.
 * @param manifest the repository-relative source project manifest.
 * @param name the installed dependency name.
 * @returns the installed version, or undefined when the dependency is absent.
 */
export function installedDependencyVersion(root: string, manifest: string, name: string): string | undefined {
    let path: string;
    try {
        path = createRequire(join(root, manifest)).resolve(`${name}/package.json`);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return undefined;
        throw error;
    }
    return installedPackage(undefined, root, path)?.version;
}
