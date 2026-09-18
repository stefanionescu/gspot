// Readers for the manifests detection and takeover need: package.json, pyproject.toml, Package.swift and the rest.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import type { DependencyMap, ManifestFacts, TrackedFile } from '#types/repository.ts';

const REQUIREMENT_NAME_END = /[\s<>=!~;[]/u;
const SWIFT_PACKAGE_URL = /url:\s*"([^"]+)"/gu;
const BARE_KINDS = new Set<ManifestFacts['kind']>(['Cargo.toml', 'go.mod', 'Gemfile']);

function isBareKind(base: string): base is ManifestFacts['kind'] {
    return BARE_KINDS.has(base as ManifestFacts['kind']);
}

function readJson(root: string, path: string): Record<string, unknown> | undefined {
    try {
        return JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

function readText(root: string, path: string): string | undefined {
    try {
        return readFileSync(join(root, path), 'utf8');
    } catch {
        return undefined;
    }
}

function asTable(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function record(value: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    const entries = Object.entries(asTable(value));
    for (const [key, entry] of entries) out[key] = String(entry);
    return out;
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function workspacesOf(value: unknown): string[] {
    if (Array.isArray(value)) return strings(value);
    return strings(asTable(value)['packages']);
}

function bareFacts(path: string, kind: ManifestFacts['kind']): ManifestFacts {
    return { path, kind, dependencies: {}, installed: {}, scripts: {}, workspaces: [], engines: {} };
}

function packageJsonFacts(root: string, path: string): ManifestFacts | undefined {
    const parsed = readJson(root, path);
    if (!parsed) return undefined;
    const installed: DependencyMap = { ...record(parsed['dependencies']), ...record(parsed['devDependencies']) };
    const dependencies: DependencyMap = {
        ...installed,
        ...record(parsed['peerDependencies']),
        ...record(parsed['optionalDependencies']),
    };
    const facts: ManifestFacts = {
        ...bareFacts(path, 'package.json'),
        dependencies,
        installed,
        scripts: record(parsed['scripts']),
        workspaces: workspacesOf(parsed['workspaces']),
        engines: record(parsed['engines']),
    };
    const installer = parsed['packageManager'];
    if (typeof installer === 'string') facts.installer = installer;
    if (typeof parsed['type'] === 'string') facts.type = parsed['type'];
    return facts;
}

function requirementName(spec: string): string {
    const end = spec.search(REQUIREMENT_NAME_END);
    return (end === -1 ? spec : spec.slice(0, end)).toLowerCase();
}

function pythonDependencies(parsed: Record<string, unknown>): DependencyMap {
    const project = asTable(parsed['project']);
    const groups = [
        ...strings(project['dependencies']),
        ...Object.values(asTable(project['optional-dependencies'])).flatMap((group) => strings(group)),
        ...Object.values(asTable(parsed['dependency-groups'])).flatMap((group) => strings(group)),
    ];
    const dependencies: DependencyMap = {};
    for (const spec of groups) dependencies[requirementName(spec)] = spec;
    if (asTable(parsed['tool'])['pytest'] !== undefined) dependencies['pytest'] ??= 'tool.pytest';
    return dependencies;
}

function pyprojectFacts(root: string, path: string): ManifestFacts | undefined {
    const text = readText(root, path);
    let parsed: Record<string, unknown>;
    try {
        parsed = text === undefined ? {} : parseToml(text);
    } catch {
        return undefined;
    }
    if (text === undefined) return undefined;
    const project = asTable(parsed['project']);
    const dependencies = pythonDependencies(parsed);
    const requiresPython = project['requires-python'];
    const engines: Record<string, string> = typeof requiresPython === 'string' ? { python: requiresPython } : {};
    return {
        ...bareFacts(path, 'pyproject.toml'),
        dependencies,
        installed: dependencies,
        scripts: record(project['scripts']),
        workspaces: uvMembers(parsed),
        engines,
    };
}

function uvMembers(parsed: Record<string, unknown>): string[] {
    const uv = asTable(asTable(parsed['tool'])['uv']);
    return strings(asTable(uv['workspace'])['members']);
}

function swiftFacts(root: string, path: string): ManifestFacts | undefined {
    const text = readText(root, path);
    if (text === undefined) return undefined;
    const dependencies: DependencyMap = {};
    for (const match of text.matchAll(SWIFT_PACKAGE_URL)) {
        const url = match[1] ?? '';
        const last = url.slice(url.lastIndexOf('/') + 1);
        dependencies[last.endsWith('.git') ? last.slice(0, -'.git'.length) : last] = url;
    }
    return { ...bareFacts(path, 'Package.swift'), dependencies, installed: dependencies };
}

const READERS: Record<string, (root: string, path: string) => ManifestFacts | undefined> = {
    'package.json': packageJsonFacts,
    'pyproject.toml': pyprojectFacts,
    'Package.swift': swiftFacts,
};

/**
 * Facts from every manifest in the tree.
 * @param root the repository root
 * @param files the tracked files
 * @returns one facts entry per readable manifest
 */
export function readManifests(root: string, files: TrackedFile[]): ManifestFacts[] {
    return files
        .filter((file) => !file.path.includes('node_modules/'))
        .flatMap((file) => {
            const base = file.path.slice(file.path.lastIndexOf('/') + 1);
            if (isBareKind(base)) return [bareFacts(file.path, base)];
            const found = READERS[base]?.(root, file.path);
            return found ? [found] : [];
        });
}
