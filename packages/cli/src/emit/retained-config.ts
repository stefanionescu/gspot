import { packageConfigurations } from '#cli/repository/existing-tooling.ts';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { CONVENTIONAL_CONFIG_PATHS } from '#cli/lifecycle/patterns-definitions.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import type { FileSnapshot } from '#cli/lifecycle/types.ts';
import type { Session } from '#cli/run/types.ts';

/** Identify authored tool configuration using recorded bytes and permissions. */
export function retainedConfigurationPaths(
    session: Session,
    tools: string[],
    takeover?: ReadonlyMap<string, FileSnapshot>,
): string[] {
    const names = tools.flatMap((tool) => CONVENTIONAL_CONFIG_PATHS[tool] ?? []);
    const ownership = new Map(readOwnership(session.root).files.map((entry) => [entry.path, entry]));
    const paths = session.repository.files.map((file) => file.path);
    const packages = new Set(
        packageConfigurations(session.root, paths)
            .filter(({ tool }) => tools.includes(tool))
            .map(({ path }) => path),
    );
    const candidates = new Set([...names, ...packages, ...paths]);
    const files = openConfinedRoot(session.root);
    try {
        return [...candidates].flatMap((path) => {
            if (packages.has(path)) return [path];
            if (!names.some((name) => path === name || path.endsWith(`/${name}`))) return [];
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
