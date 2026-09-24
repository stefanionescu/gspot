// Scopes: from [[scope]] in gspot.toml, or from workspace declarations at init.
import { globbySync } from 'globby';
import { readdirSync, type Dirent } from 'node:fs';
import { relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import JSON5 from 'json5';
import { packageManifestSchema } from '#cli/repository/manifests.ts';
import { z } from 'zod';
import { mutationPath, openConfinedRoot } from '#cli/filesystem/confined.ts';
import type { Package } from '@manypkg/tools';
import { toPosix } from '#cli/platform/paths.ts';
import { LINT_TOOL_PACKAGE_PREFIXES } from '#cli/repository/patterns.ts';
import type { ManifestFacts, ScopeEntry } from '#cli/types/repository.ts';
import { LernaTool, PnpmTool, RushTool, YarnTool } from '@manypkg/tools';

function lastSegment(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

function workspaceEntry(path: string): ScopeEntry {
    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
    return { name: lastSegment(trimmed), path: trimmed, configurations: [], source: 'workspace' };
}

// Validate filesystem access before the workspace resolver reads package manifests.
function inspectWorkspacePaths(root: string, patterns: string[]): void {
    const files = openConfinedRoot(root);
    try {
        const normalized = patterns.map((pattern) => {
            const negate = pattern.startsWith('!') ? '!' : '';
            const path = pattern.slice(negate.length).replace(/^\.\//u, '').replace(/\/$/u, '');
            mutationPath(path.replace(/[!*?\[\]{}()|+@]/gu, 'x'));
            return `${negate}${path}`;
        });
        const ancestors = normalized.flatMap((pattern) => {
            if (pattern.startsWith('!')) return [pattern];
            const parts = pattern.split('/');
            return parts.map((_part, index) => parts.slice(0, index + 1).join('/'));
        });
        function readDirectory(path: string): string[];
        function readDirectory(path: string, options: { withFileTypes: true }): Dirent[];
        function readDirectory(path: string, options?: { withFileTypes: true }): string[] | Dirent[] {
            const local = toPosix(relative(root, path));
            if (local !== '') files.stat(local);
            return options === undefined ? readdirSync(path) : readdirSync(path, options);
        }
        const paths = globbySync(ancestors, {
            cwd: root,
            onlyFiles: false,
            followSymbolicLinks: false,
            expandDirectories: false,
            dot: true,
            ignore: ['**/node_modules/**', '**/.git/**'],
            fs: { readdirSync: readDirectory },
        });
        for (const path of paths) {
            if (files.stat(path)?.isDirectory()) files.read(`${path}/package.json`);
        }
    } finally {
        files.close();
    }
}

function workspacePackages(root: string): Package[] {
    const files = openConfinedRoot(root);
    try {
        const rootSource = files.read('package.json');
        for (const { tool, path } of [
            { tool: PnpmTool, path: 'pnpm-workspace.yaml' },
            { tool: LernaTool, path: 'lerna.json' },
            { tool: RushTool, path: 'rush.json' },
        ]) {
            const source = files.read(path);
            if (source === undefined || !tool.isMonorepoRootSync(root)) continue;
            const text = source.bytes.toString('utf8');
            const data: unknown = path.endsWith('.yaml')
                ? parseYaml(text)
                : tool === RushTool
                  ? JSON5.parse(text)
                  : JSON.parse(text);
            const patterns =
                tool === RushTool
                    ? z
                          .object({ projects: z.array(z.object({ projectFolder: z.string() })) })
                          .parse(data)
                          .projects.map((project) => project.projectFolder)
                    : (z.object({ packages: z.array(z.string()).optional() }).parse(data).packages ?? ['packages/*']);
            inspectWorkspacePaths(root, patterns);
            return tool.getPackagesSync(root).packages;
        }
        if (rootSource === undefined) return [];
        const manifest = packageManifestSchema.parse(JSON.parse(rootSource.bytes.toString('utf8')));
        const workspaces = Array.isArray(manifest.workspaces)
            ? manifest.workspaces
            : (manifest.workspaces?.packages ?? []);
        if (workspaces.length === 0) return [];
        inspectWorkspacePaths(root, workspaces);
        return YarnTool.getPackagesSync(root).packages;
    } finally {
        files.close();
    }
}

function npmScopes(root: string, byPath: Map<string, ManifestFacts>, lintOnly: string[]): ScopeEntry[] {
    const packages = workspacePackages(root);
    const scopes: ScopeEntry[] = [];
    for (const found of packages) {
        const rel = toPosix(found.relativeDir);
        if (rel === '' || rel === '.') continue;
        const fact = byPath.get(`${rel}/package.json`);
        if (fact && isLintOnlyManifest(fact)) lintOnly.push(`${rel}/package.json`);
        else scopes.push(workspaceEntry(rel));
    }
    return scopes;
}

function memberScopes(root: string, members: string[]): ScopeEntry[] {
    const files = openConfinedRoot(root);
    try {
        return members
            .filter((member) => !member.includes('*') && files.stat(member)?.isDirectory())
            .map((member) => workspaceEntry(member));
    } finally {
        files.close();
    }
}

/**
 * True when every dependency of a manifest is a lint tool gspot pins, so the manifest exists only to hold tooling.
 * @param facts the manifest
 * @returns whether it holds tooling only
 */
export function isLintOnlyManifest(facts: ManifestFacts): boolean {
    const names = Object.keys(facts.installed);
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
 * @param facts the manifests read from the tree
 * @returns the scopes in path order, and the lint-only manifests left out
 */
export function workspaceScopes(root: string, facts: ManifestFacts[]): { scopes: ScopeEntry[]; lintOnly: string[] } {
    const lintOnly: string[] = [];
    const byPath = new Map(facts.map((fact) => [fact.path, fact]));
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
 * The scopes a policy declares, root first.
 * @param entries the [[scope]] entries
 * @returns the scope entries
 */
export function policyScopes(entries: { path: string; configurations: string[] }[]): ScopeEntry[] {
    return [
        { name: 'root', path: '', configurations: [], source: 'root' },
        ...entries.map(
            (entry): ScopeEntry => ({
                name: lastSegment(entry.path),
                path: entry.path,
                configurations: entry.configurations,
                source: 'gspot.toml',
            }),
        ),
    ];
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
        configurations: [],
        source: 'root',
    };
    return scopes
        .filter((scope) => scope.path !== '' && (path === scope.path || path.startsWith(`${scope.path}/`)))
        .reduce((best, scope) => (scope.path.length > best.path.length ? scope : best), root);
}

/** Declared ancestors of a scope, ordered from the outermost to the exact scope. */
export function scopeAncestors(
    entries: Pick<ScopeEntry, 'path' | 'configurations'>[],
    path: string,
): Pick<ScopeEntry, 'path' | 'configurations'>[] {
    return entries
        .filter((entry) => entry.path === path || path.startsWith(`${entry.path}/`))
        .toSorted((left, right) => left.path.length - right.path.length);
}
