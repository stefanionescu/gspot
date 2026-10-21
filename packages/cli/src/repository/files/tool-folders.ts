import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';

/**
 * Check whether a path sits in a gspot tool project.
 *
 * @param path the repository-relative file.
 * @returns whether a .gspot folder contains the file.
 */
export function isInGspotFolder(path: string): boolean {
    return path.startsWith(`${DOT_GSPOT}/`);
}

/**
 * Check whether a path sits in a tool project or in installed npm dependencies.
 *
 * @param path the repository-relative file.
 * @returns whether project discovery must leave out the path.
 */
export function isInToolFolder(path: string): boolean {
    return isInGspotFolder(path) || isInDependencyFolder(path);
}

/**
 * Check whether a path lies inside an installed dependency folder, such as node_modules.
 *
 * @param path the repository-relative path.
 * @returns whether a dependency folder holds it.
 */
export function isInDependencyFolder(path: string): boolean {
    return path.split('/').some((part) => INSTALLED_DEPENDENCY_FOLDERS.has(part));
}
