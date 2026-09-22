// Scopes: from [[scope]] in gspot.toml, or from workspace declarations at init.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Package } from '@manypkg/tools';
import { toPosix } from '#cli/platform/paths.ts';
import { LINT_TOOL_PACKAGE_PREFIXES } from '#cli/lifecycle/patterns-definitions.ts';
import type { ManifestFacts, ScopeEntry } from '#cli/repository/types.ts';
import { LernaTool, PnpmTool, RushTool, YarnTool } from '@manypkg/tools';

function lastSegment(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

function workspaceEntry(path: string): ScopeEntry {
    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
    return { name: lastSegment(trimmed), path: trimmed, presets: [], source: 'workspace' };
}

function workspacePackages(root: string, workspaces: string[]): Package[] {
    const declared = [PnpmTool, LernaTool, RushTool].find((tool) => tool.isMonorepoRootSync(root));
    const resolver = declared ?? (workspaces.length > 0 ? YarnTool : undefined);
    return resolver?.getPackagesSync(root).packages ?? [];
}

function npmScopes(root: string, byPath: Map<string, ManifestFacts>, lintOnly: string[]): ScopeEntry[] {
    const packages = workspacePackages(root, byPath.get('package.json')?.workspaces ?? []);
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
    return members
        .filter((member) => !member.includes('*') && existsSync(join(root, member)))
        .map((member) => workspaceEntry(member));
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
export function policyScopes(entries: { path: string; presets: string[] }[]): ScopeEntry[] {
    return [
        { name: 'root', path: '', presets: [], source: 'root' },
        ...entries.map(
            (entry): ScopeEntry => ({
                name: lastSegment(entry.path),
                path: entry.path,
                presets: entry.presets,
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
        presets: [],
        source: 'root',
    };
    return scopes
        .filter((scope) => scope.path !== '' && (path === scope.path || path.startsWith(`${scope.path}/`)))
        .reduce((best, scope) => (scope.path.length > best.path.length ? scope : best), root);
}

/** Declared ancestors of a scope, ordered from the outermost to the exact scope. */
export function scopeAncestors(
    entries: Pick<ScopeEntry, 'path' | 'presets'>[],
    path: string,
): Pick<ScopeEntry, 'path' | 'presets'>[] {
    return entries
        .filter((entry) => entry.path === path || path.startsWith(`${entry.path}/`))
        .toSorted((left, right) => left.path.length - right.path.length);
}
