// Absolute paths of CLI source modules, for child processes that import them beside mocked dependencies.
import { fileURLToPath } from 'node:url';

/**
 * The absolute path of a module under packages/cli/src.
 * @param path the module path below packages/cli/src
 * @returns the absolute path
 */
export function cliSource(path: string): string {
    return fileURLToPath(new URL(`../../../packages/cli/src/${path}`, import.meta.url));
}
