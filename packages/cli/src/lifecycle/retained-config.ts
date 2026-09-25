import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { declaredConfigurations } from '#cli/repository/existing-tooling.ts';

/**
 * Identify authored tool configuration using recorded bytes and permissions.
 * @param root
 * @param sourcePaths
 * @param tools
 * @param takeover
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
    const shared = new Set(declarations.filter((entry) => entry.shared).map((entry) => entry.path));
    const files = openConfinedRoot(root);
    try {
        return [...candidates].flatMap((path) => {
            if (shared.has(path)) return [path];
            const current = files.read(path);
            if (current === undefined) return [];
            if (takeover?.has(path) && isDeepStrictEqual(current, takeover.get(path))) return [];
            const installed = ownership.get(path)?.installed;
            return installed !== undefined &&
                current.mode === installed.mode &&
                createHash('sha256').update(current.bytes).digest('hex') === installed.hash
                ? []
                : [path];
        });
    } finally {
        files.close();
    }
}
