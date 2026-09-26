import { indexedPaths } from '#cli/repository/tracked.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { DEPENDENCY_FOLDERS } from '#cli/constants/repository/repository.ts';

function dependencyFolder(path: string): string | undefined {
    const segments = path.split('/').slice(0, -1);
    const at = segments.findIndex((segment) => DEPENDENCY_FOLDERS.includes(segment));
    return at === -1 ? undefined : segments.slice(0, at + 1).join('/');
}

/**
 * One finding for each dependency folder that holds tracked files, with how many it holds.
 * @param input the engine input
 * @returns the findings
 */
export function trackedDependencies(input: EngineInput): Finding[] {
    const tracked = indexedPaths(input.root);
    const counts = new Map<string, number>();
    for (const path of tracked) {
        const folder = dependencyFolder(path);
        if (folder !== undefined) counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
    return [...counts].map(([folder, count]) => ({
        check: input.spec.name,
        file: folder,
        line: 1,
        rule: 'tracked-folder',
        message: `git tracks ${String(count)} file(s) under ${folder}/; a package manager fills that folder.`,
        fixable: false,
    }));
}
