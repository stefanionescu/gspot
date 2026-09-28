import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { FileObservation } from '#cli/types/platform.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { declaredKits } from '#cli/repository/existing-tooling.ts';

/**
 * Identify authored tool configuration using recorded bytes and permissions.
 * @param root the repository root
 * @param sourcePaths the tracked file paths
 * @param tools the tools whose configuration counts
 * @param replace the reviewed originals a replace replaces, when one was authorized
 * @returns the authored configuration files that stay
 */
export function retainedConfigurationPaths(
    root: string,
    sourcePaths: string[],
    tools: string[],
    replace?: ReadonlyMap<string, FileObservation>,
): string[] {
    const ownership = new Map(readOwnership(root).files.map((entry) => [entry.path, entry]));
    const declarations = declaredKits(root, sourcePaths, tools);
    const candidates = new Set(declarations.map((entry) => entry.path));
    const shared = new Set(declarations.filter((entry) => entry.shared === true).map((entry) => entry.path));
    const files = openRoot(root);
    try {
        return [...candidates].filter((path) => {
            if (shared.has(path)) return true;
            const current = files.read(path);
            if (current === undefined) return false;
            if (isDeepStrictEqual(current, replace?.get(path))) return false;
            const installed = ownership.get(path)?.installed;
            return !(
                current.mode === installed?.mode &&
                createHash('sha256').update(current.bytes).digest('hex') === installed.hash
            );
        });
    } finally {
        files.close();
    }
}
