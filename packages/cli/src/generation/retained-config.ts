import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { FileSnapshot } from '#cli/types/platform.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { declaredConfigurations } from '#cli/repository/existing-tooling.ts';

/**
 * Identify authored tool configuration using recorded bytes and permissions.
 * @param root the repository root
 * @param sourcePaths the tracked file paths
 * @param tools the tools whose configuration counts
 * @param takeover the reviewed originals a takeover replaces, when one was authorized
 * @returns the authored configuration files that stay
 */
export function retainedConfigurationPaths(
    root: string,
    sourcePaths: string[],
    tools: string[],
    takeover?: ReadonlyMap<string, FileSnapshot>,
): string[] {
    const ownership = new Map(readOwnership(root).files.map((entry) => [entry.path, entry]));
    const declarations = declaredConfigurations(root, sourcePaths, tools);
    const candidates = new Set(declarations.map((entry) => entry.path));
    const shared = new Set(declarations.filter((entry) => entry.shared === true).map((entry) => entry.path));
    const files = openConfinedRoot(root);
    try {
        return [...candidates].flatMap((path) => {
            if (shared.has(path)) return [path];
            const current = files.read(path);
            if (current === undefined) return [];
            if (takeover?.has(path) === true && isDeepStrictEqual(current, takeover.get(path))) return [];
            const installed = ownership.get(path)?.installed;
            return current.mode === installed?.mode &&
                createHash('sha256').update(current.bytes).digest('hex') === installed.hash
                ? []
                : [path];
        });
    } finally {
        files.close();
    }
}
