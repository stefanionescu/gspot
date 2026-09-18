// Readers for the manifests detection and takeover need: package.json, pyproject.toml, Package.swift and the rest.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseToml } from 'smol-toml';

import type { DependencyMap, ManifestFacts, TrackedFile } from '#types/repository.ts';

function readJson(root: string, path: string): Record<string, unknown> | undefined {
    try {
        return JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

function record(value: unknown): Record<string, string> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const out: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = String(entry);
    return out;
}

function packageJsonFacts(root: string, path: string): ManifestFacts | undefined {
    const data = readJson(root, path);
    if (!data) return undefined;
    const installed: DependencyMap = { ...record(data['dependencies']), ...record(data['devDependencies']) };
    const dependencies: DependencyMap = {
        ...installed,
        ...record(data['peerDependencies']),
        ...record(data['optionalDependencies']),
    };
    const workspaces = Array.isArray(data['workspaces'])
        ? (data['workspaces'] as string[])
        : Array.isArray((data['workspaces'] as { packages?: string[] } | undefined)?.packages)
          ? (data['workspaces'] as { packages: string[] }).packages
          : [];
    const facts: ManifestFacts = {
        path,
        kind: 'package.json',
        dependencies,
        installed,
        scripts: record(data['scripts']),
        workspaces,
        engines: record(data['engines']),
    };
    if (typeof data['packageManager'] === 'string') facts.packageManager = data['packageManager'];
    if (typeof data['type'] === 'string') facts.type = data['type'];
    return facts;
}

function pep508Name(spec: string): string {
    return spec.split(/[\s<>=!~;[]/)[0]!.toLowerCase();
}

function pyprojectFacts(root: string, path: string): ManifestFacts | undefined {
    let data: Record<string, unknown>;
    try {
        data = parseToml(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;
    } catch {
        return undefined;
    }
    const project = (data['project'] ?? {}) as Record<string, unknown>;
    const dependencies: DependencyMap = {};
    for (const spec of (project['dependencies'] as string[] | undefined) ?? []) dependencies[pep508Name(spec)] = spec;
    for (const group of Object.values((project['optional-dependencies'] as Record<string, string[]> | undefined) ?? {}))
        for (const spec of group) dependencies[pep508Name(spec)] = spec;
    for (const group of Object.values((data['dependency-groups'] as Record<string, unknown[]> | undefined) ?? {}))
        for (const spec of group) if (typeof spec === 'string') dependencies[pep508Name(spec)] = spec;
    const tool = (data['tool'] ?? {}) as Record<string, unknown>;
    if (tool['pytest'] !== undefined) dependencies['pytest'] ??= 'tool.pytest';
    const workspace =
        ((tool['uv'] as Record<string, unknown> | undefined)?.['workspace'] as { members?: string[] } | undefined)
            ?.members ?? [];
    const engines: Record<string, string> = {};
    if (typeof project['requires-python'] === 'string') engines['python'] = project['requires-python'];
    return {
        path,
        kind: 'pyproject.toml',
        dependencies,
        installed: dependencies,
        scripts: record(project['scripts']),
        workspaces: workspace,
        engines,
    };
}

function swiftFacts(root: string, path: string): ManifestFacts | undefined {
    let text: string;
    try {
        text = readFileSync(join(root, path), 'utf8');
    } catch {
        return undefined;
    }
    const dependencies: DependencyMap = {};
    for (const match of text.matchAll(/\.package\((?:name:\s*"[^"]+",\s*)?url:\s*"([^"]+)"/g)) {
        const name = match[1]!
            .split('/')
            .pop()!
            .replace(/\.git$/, '');
        dependencies[name] = match[1]!;
    }
    return {
        path,
        kind: 'Package.swift',
        dependencies,
        installed: dependencies,
        scripts: {},
        workspaces: [],
        engines: {},
    };
}

/** Facts from every manifest in the tree. */
export function readManifests(root: string, files: TrackedFile[]): ManifestFacts[] {
    const facts: ManifestFacts[] = [];
    for (const file of files) {
        const base = file.path.split('/').pop()!;
        if (file.path.includes('node_modules/')) continue;
        if (base === 'package.json') {
            const found = packageJsonFacts(root, file.path);
            if (found) facts.push(found);
        } else if (base === 'pyproject.toml') {
            const found = pyprojectFacts(root, file.path);
            if (found) facts.push(found);
        } else if (base === 'Package.swift') {
            const found = swiftFacts(root, file.path);
            if (found) facts.push(found);
        } else if (base === 'Cargo.toml' || base === 'go.mod' || base === 'Gemfile') {
            facts.push({
                path: file.path,
                kind: base as ManifestFacts['kind'],
                dependencies: {},
                installed: {},
                scripts: {},
                workspaces: [],
                engines: {},
            });
        }
    }
    return facts;
}

/** The root package.json facts, when one exists. */
export function rootPackage(root: string): ManifestFacts | undefined {
    return existsSync(join(root, 'package.json')) ? packageJsonFacts(root, 'package.json') : undefined;
}
