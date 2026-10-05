// Scopes come from gspot.toml or, during initialization, from tracked project files.
import picomatch from 'picomatch';
import { posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Package } from '@manypkg/tools';
import { parseJsonc } from '#cli/parsers/jsonc.ts';
import { readText } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { toPosix, globPaths } from '#cli/platform/paths.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { portableSegments } from '#cli/platform/root/rules.ts';
import { HOOK_PACKAGES } from '#cli/config/repository/hooks.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';
import type { ProjectManifest } from '#cli/types/parsers/packages.ts';
import { PnpmTool, RushTool, YarnTool, LernaTool } from '@manypkg/tools';
import { isGlob, isInScope, isToolingPath } from '#cli/repository/selectors.ts';
import type { ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';
import { ROOT_SCOPE, DEPENDENCY_FOLDERS } from '#cli/config/repository/inventory.ts';
import { rushProjectsSchema, workspacePatternsSchema } from '#cli/parsers/schema/repository.ts';

// Validate filesystem access before the workspace resolver reads package manifests.
function assertWorkspaceInsideRoot(root: string, patterns: string[]): void {
    using files = openRoot(root);
    const normalized = patterns.map((pattern) => {
        const negate = pattern.startsWith('!') ? '!' : '';
        const path = pattern.slice(negate.length).replace(/^\.\//u, '').replace(/\/$/u, '');
        // Glob characters are not path characters; replace them so the segment rules check the rest.
        portableSegments(path.replaceAll(/[!*?[\]{}()|+@]/gu, 'x'));
        return `${negate}${path}`;
    });
    const ancestors = normalized.flatMap((pattern) => {
        if (pattern.startsWith('!')) return [pattern];
        const parts = pattern.split('/');
        return parts.map((_part, index) => parts.slice(0, index + 1).join('/'));
    });
    // Private tools and installed dependencies are never authored workspace projects.
    const excluded = [DOT_GSPOT, '.git', ...DEPENDENCY_FOLDERS].map((folder) => `!**/${folder}/**`);
    const paths = globPaths(root, [...ancestors, ...excluded], {
        dot: true,
        onlyFiles: false,
    });
    // Every visited path is read through the root boundary, which refuses a link that leaves the repository.
    for (const path of paths) {
        if (files.stat(path)?.isDirectory() === true) readText(root, `${path}/package.json`);
    }
}

function workspacePackages(root: string): Package[] {
    const manifest = readPackageManifest(root, 'package.json');
    const declarations = [
        {
            tool: PnpmTool,
            path: 'pnpm-workspace.yaml',
            parse: parseYaml,
            schema: workspacePatternsSchema,
        },
        {
            tool: LernaTool,
            path: 'lerna.json',
            parse: JSON.parse,
            schema: workspacePatternsSchema,
        },
        {
            tool: RushTool,
            path: 'rush.json',
            parse: parseJsonc,
            schema: rushProjectsSchema,
        },
    ];
    for (const { tool, path, parse, schema } of declarations) {
        const source = readText(root, path);
        if (source === undefined || !tool.isMonorepoRootSync(root)) continue;
        const patterns = schema.parse(parse(source));
        assertWorkspaceInsideRoot(root, patterns);
        return tool.getPackagesSync(root).packages;
    }
    if (manifest === undefined) return [];
    const { workspaces: declaration = [] } = manifest;
    const workspaces = Array.isArray(declaration) ? declaration : declaration.packages;
    if (workspaces.length === 0) return [];
    assertWorkspaceInsideRoot(root, workspaces);
    return YarnTool.getPackagesSync(root).packages;
}

/**
 * Name a project, policy, or flag scope from its repository-relative folder.
 * @param scope the path, configuration selection, and source
 * @returns the named scope entry
 */
export function buildScope(scope: Omit<ScopeEntry, 'name'>): ScopeEntry {
    return { name: posix.basename(scope.path), ...scope };
}

/**
 * The scopes initialization proposes from tracked project files, excluding root and lint-only packages.
 * @param files the repository inventory
 * @param projectManifests the parsed project manifests
 * @param patterns project-file patterns declared by configurations
 * @param npmNames declared npm installer packages
 * @returns project scopes in path order
 */
export function proposedScopes(
    files: TrackedFile[],
    projectManifests: ProjectManifest[],
    patterns: string[],
    npmNames: ReadonlySet<string>,
): ScopeEntry[] {
    const lintOnly = new Set(
        projectManifests.filter((fact) => isLintOnlyManifest(fact, npmNames)).map((fact) => fact.path),
    );
    const folders = new Set<string>();
    const sources = files.filter(
        (file) => file.kind === 'source' && !lintOnly.has(file.path) && !isToolingPath(file.path),
    );
    for (const file of sources) {
        for (const pattern of patterns) {
            const folder = projectFolder(file.path, pattern);
            if (folder !== undefined && folder !== '') folders.add(folder);
        }
    }
    return [...folders]
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) => buildScope({ path, configurations: [], source: 'project' }));
}

/**
 * The folders of the npm package workspaces the repository declares, the root left out.
 * @param root the repository root
 * @returns the root-relative folders
 */
export function packageWorkspaces(root: string): string[] {
    return workspacePackages(root)
        .map((found) => toPosix(found.relativeDir))
        .filter((path) => path !== '' && path !== '.');
}

/**
 * The folder a project file marks: the path before the segments the pattern names, when the file carries them.
 * @param path the tracked file, root-relative.
 * @param pattern a project file name, a folder name such as `*.xcodeproj`, or a short path such as `supabase/config.toml`.
 * @returns the project folder, '' for the root, or undefined when the file is no such project file.
 */
export function projectFolder(path: string, pattern: string): string | undefined {
    const segments = path.split('/');
    const wanted = pattern.split('/');
    for (let start = 0; start + wanted.length <= segments.length; start += 1) {
        const window = segments.slice(start, start + wanted.length);
        if (
            wanted.every((part, index) => {
                const segment = window[index];
                return (
                    segment !== undefined &&
                    (isGlob(part) ? picomatch.isMatch(segment, part, { dot: true }) : part === segment)
                );
            })
        )
            return segments.slice(0, start).join('/');
    }
    return undefined;
}

/**
 * True when an npm manifest holds only declared npm tools or recognized Git hook managers.
 * @param projectManifest the parsed project manifest
 * @param npmNames declared npm installer packages
 * @returns whether it holds tooling only
 */
export function isLintOnlyManifest(projectManifest: ProjectManifest, npmNames: ReadonlySet<string>): boolean {
    if (projectManifest.kind !== 'package.json') return false;
    const names = Object.keys(projectManifest.installed);
    if (names.length === 0) return false;
    return names.every((name) => npmNames.has(name) || HOOK_PACKAGES.includes(name));
}

/**
 * The scope a file belongs to: the deepest scope whose path contains it, else the root.
 * @param path the file path
 * @param scopes the scopes
 * @returns the scope
 */
export function scopeOf(path: string, scopes: ScopeEntry[]): ScopeEntry {
    const root: ScopeEntry = scopes.find((scope) => scope.path === '') ?? { ...ROOT_SCOPE, configurations: [] };
    return (
        scopes
            .filter((scope) => scope.path !== '' && isInScope(path, scope.path))
            .toSorted((left, right) => right.path.length - left.path.length)[0] ?? root
    );
}

/**
 * Declared ancestors of a scope, ordered from the outermost to the exact scope.
 * @param entries the declared scopes
 * @param path the scope path
 * @returns the scopes on the way down to the path, the path itself last
 */
export function scopeAncestors(
    entries: Pick<ScopeEntry, 'path' | 'configurations'>[],
    path: string,
): Pick<ScopeEntry, 'path' | 'configurations'>[] {
    return entries
        .filter((entry) => isInScope(path, entry.path))
        .toSorted((left, right) => left.path.length - right.path.length);
}
