import { declaredConfigurations } from '#cli/repository/existing-tooling.ts';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import type { FileSnapshot } from '#cli/types/filesystem.ts';

import type { Session } from '#cli/types/execution.ts';

/** Identify authored tool configuration using recorded bytes and permissions. */
export function retainedConfigurationPaths(
    session: Session,
    tools: string[],
    takeover?: ReadonlyMap<string, FileSnapshot>,
): string[] {
    const ownership = new Map(readOwnership(session.root).files.map((entry) => [entry.path, entry]));
    const declarations = declaredConfigurations(
        session.root,
        session.repository.files.filter((file) => file.nature === 'source').map((file) => file.path),
        tools,
    );
    const candidates = new Set(declarations.map((entry) => entry.path));
    const shared = new Set(declarations.filter((entry) => entry.shared).map((entry) => entry.path));
    const files = openConfinedRoot(session.root);
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
