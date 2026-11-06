import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { NODE_TOOL } from '#cli/config/tools/installers.ts';
import { BIN_FOLDER_NAME } from '#cli/config/tools/programs.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { findProgram } from '#cli/system/programs.ts';
import type { Tool } from '#cli/types/manifests.ts';
import type { PackageJson } from '#cli/types/parsers.ts';
import type { Files } from '#cli/types/system.ts';
import type { InstalledDependency } from '#cli/types/tools.ts';

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
*/
export function readToolCommandPrefix(root: string, tool: Tool, path: string): string[] {
    const npm = tool.installers['npm'];
    const binFolder = join(root, GSPOT_PATHS.nodeModules, BIN_FOLDER_NAME);
    if (npm === undefined || dirname(path) !== binFolder) return [path];
    const packagePath = join(root, GSPOT_PATHS.nodeModules, npm.name, PACKAGE_JSON);
    const bin = readToolProjectPackage(openFiles(root), root, packagePath)?.bin;
    const script = typeof bin === 'object' ? bin[tool.name] : bin;
    if (script === undefined) return [path];
    const node =
        process.versions['bun'] === undefined ? process.execPath : (findProgram(NODE_TOOL) ?? process.execPath);
    return [node, join(dirname(packagePath), script)];
}

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
