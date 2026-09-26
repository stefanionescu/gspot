// Which grammar Vale reads each file with: by path where Vale has one, through stdin under a look-alike where it does not.
import { extensionOf } from '#cli/platform/paths.ts';
import { PROSE_GRAMMARS, SCRIPT_GRAMMAR, SCRIPT_TAG } from '#cli/configurations/vale.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';

/**
 * The route for a tracked file, or undefined when Vale has nothing to read in it.
 * @param file the tracked file
 * @returns the route
 */
export function routeFor(file: TrackedFile): ProseRoute | undefined {
    const extension = extensionOf(file.path);
    const grammar =
        PROSE_GRAMMARS[extension] ?? (extension === '' && file.tags.includes(SCRIPT_TAG) ? SCRIPT_GRAMMAR : undefined);
    return grammar === undefined ? undefined : { path: file.path, mode: grammar.mode, extension: grammar.extension };
}

/**
 * The routes grouped by the argument list they share: every path-read file of one extension together, every stdin file alone.
 * @param files the tracked files
 * @returns the groups, path-read first
 */
export function routeGroups(files: TrackedFile[]): ProseRoute[][] {
    const routes = files.map((file) => routeFor(file)).filter((route) => route !== undefined);
    const byPath = new Map<string, ProseRoute[]>();
    const pathRoutes = routes.filter((entry) => entry.mode === 'path');
    for (const route of pathRoutes) {
        const group = byPath.get(route.extension) ?? [];
        group.push(route);
        byPath.set(route.extension, group);
    }
    return [...byPath.values(), ...routes.filter((entry) => entry.mode === 'stdin').map((route) => [route])];
}

export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };
