import { compareText } from '#cli/system/text/order.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { LINT_FOLDERS } from '#cli/config/repository/setup.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository.ts';

import {
    isProjectSource,
    listToolOnlyPackages,
    listUnparsedDependencyFiles,
} from '#cli/repository/projects/dependencies.ts';

export function detectScopeFolders(
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
    configurations: Iterable<Configuration>,
): ScopeFolder[] {
    const selected = [...configurations];
    const toolOnlyPackages = listToolOnlyPackages(dependencyFiles, selected);
    const unparsed = new Set(listUnparsedDependencyFiles(files, dependencyFiles));
    const sources = files.filter(
        (file) =>
            isProjectSource(file) &&
            !toolOnlyPackages.has(file.path) &&
            !unparsed.has(file.path) &&
            LINT_FOLDERS.every((folder) => !file.path.startsWith(`${folder}/`)),
    );
    const folders = listProjectFolders(
        sources.map((file) => file.path),
        selected,
    );
    return [...folders]
        .filter((path) => path !== '')
        .toSorted((left, right) => compareText(left, right))
        .map((path): ScopeFolder => ({ path, configurations: [], origin: 'project' }));
}

export function listProjectFolders(paths: Iterable<string>, configurations: Configuration[]): Set<string> {
    const patterns = configurations.flatMap((configuration) => configuration.detect.project_files);
    const folders = new Set<string>();
    for (const path of paths)
        for (const pattern of patterns) {
            const folder = findProjectFolder(path, pattern);
            if (folder !== undefined) folders.add(folder);
        }
    return folders;
}

export function findProjectFolder(path: string, pattern: string): string | undefined {
    const segments = path.split('/');
    const wanted = pattern.split('/');
    for (let start = 0; start + wanted.length <= segments.length; start += 1) {
        const window = segments.slice(start, start + wanted.length);
        if (
            wanted.every((glob, index) => {
                const segment = window[index];
                return segment !== undefined && buildPathMatcher([glob])(segment);
            })
        )
            return segments.slice(0, start).join('/');
    }
    return undefined;
}
