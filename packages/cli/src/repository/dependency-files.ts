// Reads repository dependency files and installed package versions.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { isToolingPath } from '#cli/repository/selectors.ts';
import { FOLDER_CONTENTS } from '#cli/config/system/paths.ts';
import { join, dirname, basename, relative } from 'node:path';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { readText, readCachedText } from '#cli/system/files/reads.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { type Files, type ReadCache } from '#cli/types/system/files.ts';
import { packageJsonSchema, selectDependencyFileParser } from '#cli/parsers/dependency-files.ts';
import type { PackageJson, DependencyFile, InstalledDependency } from '#cli/types/parsers/dependency-files.ts';

/**
 * Read supported project manifests for dependency and runtime detection.
 * @param reads the run's cached source reads.
 * @param files the tracked files.
 * @returns one project manifest per supported source file.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- reason: Package declarations accept strings and package-manager records; this reader validates both forms together.
export async function readDependencyFiles(reads: ReadCache, files: TrackedFile[]): Promise<DependencyFile[]> {
    const manifests: DependencyFile[] = [];
    for (const file of files.filter((file) => file.kind === 'source' && !isToolingPath(file.path))) {
        try {
            const parse = selectDependencyFileParser(file.path);
            if (parse === undefined) continue;
            const text = readCachedText(reads, file.path);
            if (text === undefined) throw new Error(`Manifest is missing: ${file.path}`);
            manifests.push(await parse(file.path, text));
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
        }
    }
    return manifests;
}

/**
 * Read and validate the package fields used by repository and check consumers.
 * @param root the repository root.
 * @param path the repository-relative package.json path.
 * @returns the validated package fields, or undefined when the file does not exist.
 */
export function readPackageJson(root: string, path: string): PackageJson | undefined {
    const text = readText(root, path);
    if (text === undefined) return undefined;
    return parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Select existing files that package manifests declare for publication.
 * @param root the repository root.
 * @param manifests the package.json paths.
 * @returns the repository-relative package files.
 */
export function packageFiles(root: string, manifests: string[]): string[] {
    return manifests.flatMap((path) => {
        const folder = dirname(path);
        const patterns = (readPackageJson(root, path)?.files ?? []).flatMap((pattern) => [
            pattern,
            pattern + FOLDER_CONTENTS,
        ]);
        return listMatchingPaths(join(root, folder), patterns).map((file) => convertToPosixPath(join(folder, file)));
    });
}

/**
 * Read package metadata from a tool project installation or a host installation.
 * @param files the tool project installation boundary, or undefined for a host installation.
 * @param root the repository root owning the tool-project boundary.
 * @param manifest the absolute package.json path.
 * @returns the validated package fields, or undefined when the file does not exist.
 */
export function installedPackage(files: Files | undefined, root: string, manifest: string): PackageJson | undefined {
    try {
        let text: string | undefined;
        if (files === undefined) text = readFileSync(manifest, 'utf8');
        else {
            const directory = files.realPath(convertToPosixPath(relative(root, dirname(manifest))));
            const path = convertToPosixPath(relative(root, join(directory, basename(manifest))));
            text = readText(root, path);
        }
        return text === undefined ? undefined : parseJsonFile(manifest, text, packageJsonSchema);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Read the path and version of a dependency resolved from its actual project manifest, including hoisted installations.
 * @param root the repository root.
 * @param manifest the repository-relative source project manifest.
 * @param name the installed dependency name.
 * @returns the resolved manifest and its version, or undefined when the dependency does not exist.
 */
export function installedDependency(root: string, manifest: string, name: string): InstalledDependency | undefined {
    const require = createRequire(join(root, manifest));
    let path: string;
    try {
        path = require.resolve(`${name}/package.json`);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return undefined;
        throw error;
    }
    return { path, version: installedPackage(undefined, root, path)?.version };
}
