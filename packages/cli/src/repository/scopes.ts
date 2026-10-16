// Discovers project scopes and resolves paths within them.
import picomatch from 'picomatch';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { ROOT_SCOPE } from '#cli/config/repository/scopes.ts';
import { listNpmToolNames } from '#cli/configurations/tools.ts';
import { isInstalledToolPath } from '#cli/repository/classify.ts';
import { isToolOnlyPackage } from '#cli/repository/dependency-files.ts';
import type { ToolFileGeneration } from '#cli/types/generation/files.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { Scope, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { GLOB_EXCLUDE, FOLDER_CONTENTS, WHOLE_TREE_GLOBS } from '#cli/config/system/paths.ts';

/**
 * Test scope containment. The empty root path matches every file.
 * @param path the file path.
 * @param scope the scope path.
 * @returns whether the scope contains the file.
 */
export function isInScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

/**
 * Lists the scopes inside another scope, excluding that scope itself.
 * @param paths every scope path.
 * @param scope the parent scope, empty for the repository root.
 * @returns the nested paths in their original order.
 */
export function listNestedScopes(paths: readonly string[], scope: string): string[] {
    return paths.filter((path) => path !== scope && isInScope(path, scope));
}

/**
 * Orders scope paths from outermost to innermost, then by name.
 * @param left the first scope path.
 * @param right the second scope path.
 * @returns the comparison result.
 */
export function compareScopeDepth(left: string, right: string): number {
    const leftDepth = left === '' ? 0 : left.split('/').length;
    const rightDepth = right === '' ? 0 : right.split('/').length;
    return leftDepth - rightDepth || left.localeCompare(right);
}

/**
 * Determine whether positive literal selectors cover a complete project scope.
 * @param paths the root-relative inclusion and exclusion selectors.
 * @param scope the project scope, empty for the root.
 * @returns true only when no exclusion or partial selector leaves scope content active.
 */
export function isScopeCovered(paths: string[], scope: string): boolean {
    if (paths.some((path) => path.startsWith(GLOB_EXCLUDE))) return false;
    if (WHOLE_TREE_GLOBS.some((pattern) => paths.includes(pattern))) return true;
    if (scope === '') return false;
    const segments = scope.split('/');
    return segments.some((_, index) => {
        const literal = escapeGlob(segments.slice(0, index + 1).join('/'));
        return paths.includes(literal) || paths.includes(`${literal}${FOLDER_CONTENTS}`);
    });
}

/**
 * Determine whether a path belongs to none of the nested project scopes.
 * @param path the repository-relative source or deleted trigger path.
 * @param children the nested project scope paths.
 * @returns whether the parent scope owns this path.
 */
export function isOutsideChildren(path: string, children: string[]): boolean {
    return children.every((child) => !isInScope(path, child));
}

/**
 * Resolve a scope-relative path within its repository.
 * @param scope the repository-relative scope.
 * @param path the scope-relative path.
 * @returns the repository-relative path.
 */
export function joinScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

/**
 * The repository-relative path of a tool file generated for a scope.
 * @param scope the scope path, empty for the root.
 * @param toolFile the tool-file declaration.
 * @param targets the emitted tool-file paths indexed by scope and file stem.
 * @returns the scopePath file or its emitted root fallback.
 */
export function buildScopeTarget(
    scope: string,
    toolFile: ToolFileDeclaration,
    targets: ToolFileGeneration['targets'],
): string {
    return toolFile.per_scope ? (targets.get(scope)?.get(toolFile.target) ?? toolFile.target) : toolFile.target;
}

/**
 * Find project scopes for initialization and execution. Omit the root and lint-only packages.
 * @param files the repository inventory.
 * @param dependencyFiles the parsed package manifests.
 * @param manifests the configuration manifests declaring project files and npm tools.
 * @returns project scopes in path order.
 */
export function findScopes(
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
    manifests: Iterable<Manifest>,
): Scope[] {
    const configurations = [...manifests];
    const patterns = configurations.flatMap((manifest) => manifest.detect.project_files);
    const npmNames = listNpmToolNames(configurations);
    const toolOnlyPackages = new Set(
        dependencyFiles
            .filter((dependencyFile) => isToolOnlyPackage(dependencyFile, npmNames))
            .map((dependencyFile) => dependencyFile.path),
    );
    const folders = new Set<string>();
    const sources = files.filter(
        (file) => file.kind === 'source' && !toolOnlyPackages.has(file.path) && !isInstalledToolPath(file.path),
    );
    for (const file of sources) {
        for (const pattern of patterns) {
            const folder = findProjectFolder(file.path, pattern);
            if (folder !== undefined && folder !== '') folders.add(folder);
        }
    }
    return [...folders]
        .toSorted((left, right) => left.localeCompare(right))
        .map((path): Scope => ({ path, configurations: [], origin: 'project' }));
}

/**
 * The folder a project file marks: the path before the segments the pattern names, when the file carries them.
 * @param path the tracked file, root-relative.
 * @param pattern a project file name, a folder name such as `*.xcodeproj`, or a short path such as `supabase/config.toml`.
 * @returns the project folder, '' for the root, or undefined for other files.
 */
export function findProjectFolder(path: string, pattern: string): string | undefined {
    const segments = path.split('/');
    const wanted = pattern.split('/');
    for (let start = 0; start + wanted.length <= segments.length; start += 1) {
        const window = segments.slice(start, start + wanted.length);
        if (
            wanted.every((part, index) => {
                const segment = window[index];
                return (
                    segment !== undefined &&
                    (picomatch.scan(part).isGlob ? picomatch.isMatch(segment, part, { dot: true }) : part === segment)
                );
            })
        )
            return segments.slice(0, start).join('/');
    }
    return undefined;
}

/**
 * The scope a file belongs to: the deepest scope whose path contains it, else the root.
 * @param path the file path.
 * @param scopes the configured ownership boundaries to search.
 * @returns the deepest matching owner, or the repository-wide fallback.
 */
export function findScope(path: string, scopes: Scope[]): Scope {
    const root: Scope = scopes.find((scope) => scope.path === '') ?? { ...ROOT_SCOPE, configurations: [] };
    return (
        scopes
            .filter((scope) => scope.path !== '' && isInScope(path, scope.path))
            .toSorted((left, right) => right.path.length - left.path.length)[0] ?? root
    );
}
