import type { EngineInput } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import { DEPENDENCY_FOLDERS } from '#cli/repository/file-classification.ts';
// No tracked file sits inside a folder a package manager fills.
import { indexedPaths } from '#cli/repository/tracked.ts';

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
    const findings = [...counts].map(([folder, count]) => ({
        check: input.spec.name,
        file: folder,
        line: 1,
        rule: 'tracked-folder',
        message: `git tracks ${String(count)} file(s) under ${folder}/; a package manager fills that folder.`,
        fixable: false,
    }));
    return findings;
}
