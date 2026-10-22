import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { hasErrorCode } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import type { Files } from '#cli/types/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { PackageJson } from '#cli/types/parsers/projects/dependencies.ts';
import type { InstalledDependency } from '#cli/types/repository/npm/installed-packages.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/projects/dependencies/package-json.ts';

/**
 * Read and validate a package.json outside the tool project, without its boundary.
 *
 * @param path the absolute package.json file.
 * @returns the package fields, or undefined when the file does not exist.
 */
export function readHostPackage(path: string): PackageJson | undefined {
    let text: string;
    try {
        text = readFileSync(path, 'utf8');
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
    return parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read and validate an installed package.json through the tool-project boundary.
 *
 * @param files the confined file handle of the tool project.
 * @param repositoryRoot the boundary for resolving and validating installed package.json paths.
 * @param path the absolute package.json file.
 * @returns the package fields, or undefined when the file does not exist.
 */
export function readToolProjectPackage(files: Files, repositoryRoot: string, path: string): PackageJson | undefined {
    let target: string;
    try {
        target = files.readRealPath(convertToPosixPath(relative(repositoryRoot, path)));
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
    const local = convertToPosixPath(relative(repositoryRoot, target));
    const text = findText(repositoryRoot, local);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read the path and version of an installed package, hoisted or not, as its dependency file resolves it.
 *
 * @param repositoryRoot the base folder for resolving the dependency file.
 * @param packageJsonPath the repository-relative package.json used as the module-resolution base.
 * @param name the package to resolve through the dependency file.
 * @returns the resolved package.json and its version, or undefined when the dependency does not exist.
 */
export function findInstalledDependency(
    repositoryRoot: string,
    packageJsonPath: string,
    name: string,
): InstalledDependency | undefined {
    const require = createRequire(join(repositoryRoot, packageJsonPath));
    let path: string;
    try {
        path = require.resolve(`${name}/package.json`);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return undefined;
        throw error;
    }
    return { path, version: readHostPackage(path)?.version };
}
