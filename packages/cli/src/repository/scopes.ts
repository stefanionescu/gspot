// Scopes: from [[scope]] in gspot.toml, or from workspace declarations at init.
import { z } from 'zod';
import picomatch from 'picomatch';
import { parse as parseYaml } from 'yaml';
import type { Package } from '@manypkg/tools';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { mutationPath } from '#cli/platform/safe-paths.ts';
import { packageManifestSchema } from '#cli/repository/packages.ts';
import { toPosix, baseName, globPaths } from '#cli/platform/paths.ts';
import { PnpmTool, RushTool, YarnTool, LernaTool } from '@manypkg/tools';
import type { Fields, ScopeEntry, TrackedFile } from '#cli/types/repository/repository.ts';
import { GSPOT_FOLDER, LINT_TOOL_PACKAGE_PREFIXES } from '#cli/config/repository/repository.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three discoverers build a scope entry; one owner trims the path and names it.
function workspaceEntry(path: string, source: ScopeEntry['source'] = 'workspace'): ScopeEntry {
    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
    return {
        name: baseName(trimmed),
        path: trimmed,
        kits: [],
        source,
    };
}

// A folder that holds a project file of a selected language or platform is a scope, the root and lint-only packages aside.
function projectScopes(files: TrackedFile[], fields: Fields[], patterns: string[]): ScopeEntry[] {
    const lintOnly = new Set(fields.filter((fact) => isLintOnlyManifest(fact)).map((fact) => fact.path));
    const folders = new Set<string>();
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            !lintOnly.has(file.path) &&
            !file.path.split('/').some((part) => part.toLowerCase() === GSPOT_FOLDER || part === 'node_modules'),
    );
    for (const file of sources) {
        for (const pattern of patterns) {
            const folder = projectFolder(file.path, pattern);
            if (folder !== undefined && folder !== '') folders.add(folder);
        }
    }
    return [...folders].map((folder) => workspaceEntry(folder, 'project'));
}

// Validate filesystem access before the workspace resolver reads package manifests.
function inspectWorkspacePaths(root: string, patterns: string[]): void {
    using files = openRoot(root);
    const normalized = patterns.map((pattern) => {
        const negate = pattern.startsWith('!') ? '!' : '';
        const path = pattern.slice(negate.length).replace(/^\.\//u, '').replace(/\/$/u, '');
        mutationPath(path.replaceAll(/[!*?[\]{}()|+@]/gu, 'x'));
        return `${negate}${path}`;
    });
    const ancestors = normalized.flatMap((pattern) => {
        if (pattern.startsWith('!')) return [pattern];
        const parts = pattern.split('/');
        return parts.map((_part, index) => parts.slice(0, index + 1).join('/'));
    });
    const paths = globPaths(root, [...ancestors, '!**/node_modules/**', '!**/.git/**'], {
        dot: true,
        onlyFiles: false,
    });
    // Every visited path is read through the root boundary, which refuses a link that leaves the repository.
    for (const path of paths) {
        if (files.stat(path)?.isDirectory() === true) files.read(`${path}/package.json`);
    }
}

function workspacePackages(root: string): Package[] {
    using files = openRoot(root);
    const rootSource = files.read('package.json');
    const packagePatterns = z
        .object({ packages: z.array(z.string()).optional() })
        .transform((value) => value.packages ?? ['packages/*']);
    const declarations = [
        {
            tool: PnpmTool,
            path: 'pnpm-workspace.yaml',
            parse: parseYaml,
            schema: packagePatterns,
        },
        {
            tool: LernaTool,
            path: 'lerna.json',
            parse: JSON.parse,
            schema: packagePatterns,
        },
        {
            tool: RushTool,
            path: 'rush.json',
            parse: parseJsonc,
            schema: z
                .object({ projects: z.array(z.object({ projectFolder: z.string() })) })
                .transform((value) => value.projects.map((project) => project.projectFolder)),
        },
    ];
    for (const { tool, path, parse, schema } of declarations) {
        const source = files.read(path);
        if (source === undefined || !tool.isMonorepoRootSync(root)) continue;
        const patterns = schema.parse(parse(source.bytes.toString('utf8')));
        inspectWorkspacePaths(root, patterns);
        return tool.getPackagesSync(root).packages;
    }
    if (rootSource === undefined) return [];
    const { workspaces: declaration = [] } = packageManifestSchema.parse(JSON.parse(rootSource.bytes.toString('utf8')));
    const workspaces = Array.isArray(declaration) ? declaration : declaration.packages;
    if (workspaces.length === 0) return [];
    inspectWorkspacePaths(root, workspaces);
    return YarnTool.getPackagesSync(root).packages;
}

function npmScopes(root: string, byPath: Map<string, Fields>, lintOnly: string[]): ScopeEntry[] {
    const scopes: ScopeEntry[] = [];
    for (const rel of packageWorkspaces(root)) {
        const fact = byPath.get(`${rel}/package.json`);
        if (fact && isLintOnlyManifest(fact)) lintOnly.push(`${rel}/package.json`);
        else scopes.push(workspaceEntry(rel));
    }
    return scopes;
}

function memberScopes(root: string, members: string[]): ScopeEntry[] {
    using files = openRoot(root);
    return members
        .filter((member) => !member.includes('*') && files.stat(member)?.isDirectory() === true)
        .map((member) => workspaceEntry(member));
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
                    (picomatch.scan(part).isGlob ? picomatch.isMatch(segment, part, { dot: true }) : part === segment)
                );
            })
        )
            return segments.slice(0, start).join('/');
    }
    return undefined;
}

/**
 * True when every dependency of a manifest is a lint tool gspot pins, so the manifest exists only to hold tooling.
 * @param fields the manifest
 * @returns whether it holds tooling only
 */
export function isLintOnlyManifest(fields: Fields): boolean {
    const names = Object.keys(fields.installed);
    if (names.length === 0) return false;
    return names.every((name) =>
        LINT_TOOL_PACKAGE_PREFIXES.some(
            (prefix) => name === prefix || name.startsWith(`${prefix}-`) || name.startsWith(`${prefix}/`),
        ),
    );
}

/**
 * Workspace packages as scopes, from every workspace format @manypkg knows plus uv. Lint-only packages are left out.
 * @param root the repository root
 * @param fields the manifests read from the tree
 * @returns the scopes in path order, and the lint-only manifests left out
 */
export function workspaceScopes(root: string, fields: Fields[]): { scopes: ScopeEntry[]; lintOnly: string[] } {
    const lintOnly: string[] = [];
    const byPath = new Map(fields.map((fact) => [fact.path, fact]));
    const found = [
        ...npmScopes(root, byPath, lintOnly),
        ...memberScopes(root, byPath.get('pyproject.toml')?.workspaces ?? []),
    ];
    const unique = new Map<string, ScopeEntry>();
    for (const scope of found) if (!unique.has(scope.path)) unique.set(scope.path, scope);
    return {
        scopes: unique
            .values()
            .toArray()
            .toSorted((a, b) => a.path.localeCompare(b.path)),
        lintOnly,
    };
}

/**
 * The scopes init proposes: every folder that holds a project file of a configuration, and every workspace member.
 * @param root the repository root
 * @param files the tracked files
 * @param fields the package manifests
 * @param projectFiles the project-file patterns of the kits
 * @returns the scopes in path order, and the lint-only manifests left out
 */
export function proposedScopes(
    root: string,
    files: TrackedFile[],
    fields: Fields[],
    projectFiles: string[],
): { scopes: ScopeEntry[]; lintOnly: string[] } {
    const workspace = workspaceScopes(root, fields);
    const unique = new Map<string, ScopeEntry>();
    for (const scope of [...projectScopes(files, fields, projectFiles), ...workspace.scopes])
        if (!unique.has(scope.path)) unique.set(scope.path, scope);
    return {
        scopes: [...unique.values()].toSorted((a, b) => a.path.localeCompare(b.path)),
        lintOnly: workspace.lintOnly,
    };
}

/**
 * The scope a file belongs to: the deepest scope whose path contains it, else the root.
 * @param path the file path
 * @param scopes the scopes
 * @returns the scope
 */
export function scopeOf(path: string, scopes: ScopeEntry[]): ScopeEntry {
    const root: ScopeEntry = scopes.find((scope) => scope.path === '') ?? {
        name: 'root',
        path: '',
        kits: [],
        source: 'root',
    };
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
    entries: Pick<ScopeEntry, 'path' | 'kits'>[],
    path: string,
): Pick<ScopeEntry, 'path' | 'kits'>[] {
    return entries
        .filter((entry) => entry.path === path || path.startsWith(`${entry.path}/`))
        .toSorted((left, right) => left.path.length - right.path.length);
}
