// No tracked file sits inside a folder a package manager fills.
import { git } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { DEPENDENCY_FOLDERS } from '#config/integrity.ts';

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
export function trackedDependencies(input: EngineInput): Promise<Finding[]> {
    const tracked = (git(input.root, ['ls-files', '--cached', '-z']) ?? '').split('\0').filter((path) => path !== '');
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
    return Promise.resolve(findings);
}
