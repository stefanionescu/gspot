// Scopes: from [[scope]] in gspot.toml, or from workspace declarations at init.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getPackagesSync } from '@manypkg/get-packages';
import { parse as parseToml } from 'smol-toml';

import { LINT_TOOL_PACKAGE_PREFIXES } from '#config/patterns.ts';
import { toPosix } from '#cli/platform/paths.ts';
import type { ManifestFacts, ScopeInfo } from '#types/repository.ts';

/** True when every dependency of a manifest is a lint tool gspot pins, so the manifest exists only to hold tooling. */
export function isLintOnlyManifest(facts: ManifestFacts): boolean {
    const names = Object.keys(facts.installed);
    if (names.length === 0) return false;
    return names.every((name) =>
        LINT_TOOL_PACKAGE_PREFIXES.some(
            (prefix) => name === prefix || name.startsWith(`${prefix}-`) || name.startsWith(`${prefix}/`),
        ),
    );
}

/** Workspace packages as scopes, from every workspace format @manypkg knows plus uv and Cargo. Lint-only packages are left out. */
export function workspaceScopes(root: string, facts: ManifestFacts[]): { scopes: ScopeInfo[]; lintOnly: string[] } {
    const scopes: ScopeInfo[] = [];
    const lintOnly: string[] = [];
    const byPath = new Map(facts.map((fact) => [fact.path, fact]));
    try {
        const { packages } = getPackagesSync(root);
        for (const pkg of packages) {
            const rel = toPosix(pkg.relativeDir);
            if (rel === '' || rel === '.') continue;
            const fact = byPath.get(`${rel}/package.json`);
            if (fact && isLintOnlyManifest(fact)) {
                lintOnly.push(`${rel}/package.json`);
                continue;
            }
            scopes.push({ name: rel.split('/').pop()!, path: rel, presets: [], source: 'workspace' });
        }
    } catch {
        // no npm-style workspace; fall through
    }
    const pyproject = join(root, 'pyproject.toml');
    if (existsSync(pyproject)) {
        try {
            const data = parseToml(readFileSync(pyproject, 'utf8')) as {
                tool?: { uv?: { workspace?: { members?: string[] } } };
            };
            for (const member of data.tool?.uv?.workspace?.members ?? [])
                if (!member.includes('*') && existsSync(join(root, member)))
                    scopes.push({
                        name: member.split('/').pop()!,
                        path: member.replace(/\/$/, ''),
                        presets: [],
                        source: 'workspace',
                    });
        } catch {
            // an unreadable pyproject is reported elsewhere
        }
    }
    const cargo = join(root, 'Cargo.toml');
    if (existsSync(cargo)) {
        try {
            const data = parseToml(readFileSync(cargo, 'utf8')) as { workspace?: { members?: string[] } };
            for (const member of data.workspace?.members ?? [])
                if (!member.includes('*') && existsSync(join(root, member)))
                    scopes.push({
                        name: member.split('/').pop()!,
                        path: member.replace(/\/$/, ''),
                        presets: [],
                        source: 'workspace',
                    });
        } catch {
            // same
        }
    }
    const unique = new Map<string, ScopeInfo>();
    for (const scope of scopes) if (!unique.has(scope.path)) unique.set(scope.path, scope);
    return { scopes: [...unique.values()].sort((a, b) => a.path.localeCompare(b.path)), lintOnly };
}

/** The scopes a policy declares, root first. */
export function policyScopes(entries: { path: string; presets: string[] }[]): ScopeInfo[] {
    return [
        { name: 'root', path: '', presets: [], source: 'root' },
        ...entries.map((entry) => ({
            name: entry.path.split('/').pop()!,
            path: entry.path,
            presets: entry.presets,
            source: 'gspot.toml' as const,
        })),
    ];
}

/** The scope a file belongs to: the deepest scope whose path contains it, else the root. */
export function scopeOf(path: string, scopes: ScopeInfo[]): ScopeInfo {
    let best = scopes.find((scope) => scope.path === '') ?? scopes[0]!;
    for (const scope of scopes) {
        if (
            scope.path !== '' &&
            (path === scope.path || path.startsWith(`${scope.path}/`)) &&
            scope.path.length > best.path.length
        )
            best = scope;
    }
    return best;
}
