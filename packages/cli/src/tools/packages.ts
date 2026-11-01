import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Files } from '#cli/types/system.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { join, dirname, relative } from 'node:path';
import { hasErrorCode } from '#cli/system/errors.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { PackageJson } from '#cli/types/parsers.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { InstalledDependency } from '#cli/types/tools.ts';
import { BIN_FOLDER_NAME } from '#cli/config/tools/programs.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';

/**
Read and validate an installed package.json through the tool-project boundary.

@param files the confined file handle of the tool project.
@param root the boundary for resolving and validating installed package.json paths.
@param path the absolute package.json file.
@returns undefined when the file does not exist.
*/
export function readToolProjectPackage(files: Files, root: string, path: string): PackageJson | undefined {
    let target: string;
    try {
        target = files.readCanonicalPath(convertToPosixPath(relative(root, path)));
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
    return readPackageJson(root, convertToPosixPath(relative(root, target)));
}

/**
List the words that start a tool. An npm tool of the tool project starts through Node at the script that its package
names, so a Windows run skips the .cmd shim and its short command line.

@param root the folder that holds the tool project.
@param tool the tool to start.
@param path the resolved executable.
@returns the program and its first arguments.
*/
export function listToolStart(root: string, tool: Tool, path: string): string[] {
    const npm = tool.installers['npm'];
    const binFolder = join(root, GSPOT_PATHS.nodeModules, BIN_FOLDER_NAME);
    if (npm === undefined || dirname(path) !== binFolder) return [path];
    const packagePath = join(root, GSPOT_PATHS.nodeModules, npm.name, PACKAGE_JSON);
    const bin = readToolProjectPackage(openFiles(root), root, packagePath)?.bin;
    const script = typeof bin === 'object' ? bin[tool.name] : bin;
    return script === undefined ? [path] : [process.execPath, join(dirname(packagePath), script)];
}

/**
Read the path and version of an installed package, hoisted or not, as its dependency file resolves it.

@param root the base folder for resolving the dependency file.
@param packageJsonPath the repository-relative package.json used as the module-resolution base.
@param name the package to resolve through the dependency file.
@returns undefined when the dependency does not exist.
*/
export function findInstalledDependency(
    root: string,
    packageJsonPath: string,
    name: string,
): InstalledDependency | undefined {
    const require = createRequire(join(root, packageJsonPath));
    const path = require.resolve
        .paths(name)
        ?.map((folder) => join(folder, name, PACKAGE_JSON))
        .find((packagePath) => existsSync(packagePath));
    return path === undefined ? undefined : { path, version: readPackageJson(dirname(path), PACKAGE_JSON)?.version };
}
