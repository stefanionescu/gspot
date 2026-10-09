import ts from 'typescript';
import { memo } from '#cli/platform/memo.ts';
import { parse as parseToml } from 'smol-toml';
import { toPosix } from '#cli/platform/contracts.ts';
import { join, posix, dirname, resolve } from 'node:path';
import type { ReadCache } from '#cli/types/platform/reads.ts';

import {
    RUNTIME_COMMAND,
    SWIFT_PACKAGE_URL,
    JAVASCRIPT_RUNTIMES,
    REQUIREMENT_NAME_END,
} from '#cli/config/parsers/packages.ts';
import {
    parseTsconfig,
    pipfileSchema,
    bunInstallSchema,
    configurationText,
    pythonManifestSchema,
    packageManifestSchema,
} from '#cli/parsers/packages/contracts.ts';
import type {
    PackageJson,
    DependencyMap,
    ManifestParser,
    PoetrySettings,
    PythonManifest,
    PackageManifest,
    TypeScriptProject,
    TypeScriptConfiguration,
} from '#cli/types/parsers/packages.ts';

// A requirement names a distribution: letters or digits at both ends, dots, dashes, and underscores between.
function requirementName(spec: string): string | undefined {
    const trimmed = spec.trim();
    const end = trimmed.search(REQUIREMENT_NAME_END);
    const name = end === -1 ? trimmed : trimmed.slice(0, end);
    if (!/^[A-Za-z0-9]/u.test(name) || !/[A-Za-z0-9]$/u.test(name) || !/^[A-Za-z0-9._-]*$/u.test(name))
        return undefined;
    return normalizedPythonPackage(name);
}

function poetryDependencies(poetry: PoetrySettings): DependencyMap {
    const poetryGroups = [
        ...(poetry?.dependencies === undefined ? [] : [poetry.dependencies]),
        ...(poetry?.group === undefined ? [] : Object.values(poetry.group)).flatMap((entry) =>
            entry.dependencies === undefined ? [] : [entry.dependencies],
        ),
    ];
    const poetryEntries = poetryGroups
        .flatMap((group) => Object.entries(group))
        .map(
            ([name, value]) =>
                [normalizedPythonPackage(name), typeof value === 'string' ? value : JSON.stringify(value)] as const,
        )
        .filter(([name]) => name !== 'python');
    return Object.fromEntries(poetryEntries);
}

function pythonDependencies(parsed: PythonManifest): DependencyMap {
    const { project = {} } = parsed;
    const groups = [
        ...(project.dependencies ?? []),
        ...(project['optional-dependencies'] === undefined
            ? []
            : Object.values(project['optional-dependencies'])
        ).flat(),
        ...(parsed['dependency-groups'] === undefined ? [] : Object.values(parsed['dependency-groups']))
            .flat()
            .filter((entry) => typeof entry === 'string'),
    ];
    // A tool.pytest table declares pytest use even when another installer supplies the package.
    const dependencies: DependencyMap = parsed.tool?.pytest === undefined ? {} : { pytest: 'tool.pytest' };
    return Object.assign(
        dependencies,
        Object.fromEntries(
            groups.map((spec) => {
                const name = requirementName(spec);
                if (name === undefined) throw new Error(`Invalid Python dependency requirement: ${spec}`);
                return [name, spec];
            }),
        ),
        poetryDependencies(parsed.tool?.poetry),
    );
}

function parseRequirements(path: string, text: string): PackageManifest {
    const dependencies: DependencyMap = {};
    for (const line of text.replaceAll(/\\\r?\n/gu, '').split(/\r?\n/u)) {
        const comment = line.search(/\s#/u);
        const spec = (comment === -1 ? line : line.slice(0, comment)).trim();
        const name = requirementName(spec);
        if (name !== undefined) dependencies[name] = spec;
    }
    return {
        path,
        kind: 'requirements.txt',
        dependencies,
        installed: dependencies,
    };
}

const readers: Record<string, (path: string, text: string) => PackageManifest> = {
    'package.json': parsePackageSummary,
    'pyproject.toml': parsePyproject,
    'Package.swift': parseSwiftPackage,
    Pipfile: parsePipfile,
};

function packageRuntimes(path: string, manifest: PackageJson): Record<string, string> {
    const runtimes: Record<string, string> = {};
    for (const runtime of JAVASCRIPT_RUNTIMES)
        if (manifest.engines?.[runtime] !== undefined) runtimes[runtime] = `${runtime} in ${path} engines`;
    for (const [name, command] of manifest.scripts === undefined ? [] : Object.entries(manifest.scripts)) {
        const runtime = RUNTIME_COMMAND.exec(command)?.[1];
        if (runtime !== undefined) runtimes[runtime] = `${path} script ${name}`;
    }
    return runtimes;
}

function parsePackageSummary(path: string, text: string): PackageManifest {
    const parsed = parsePackageManifest(text);
    const installed: DependencyMap = { ...parsed.dependencies, ...parsed.devDependencies };
    const dependencies: DependencyMap = {
        ...installed,
        ...parsed.peerDependencies,
        ...parsed.optionalDependencies,
    };
    return {
        path,
        kind: 'package.json',
        dependencies,
        installed,
        runtimes: packageRuntimes(path, parsed),
    };
}

function parsePipfile(path: string, text: string): PackageManifest {
    const parsed = pipfileSchema.parse(parseToml(text));
    const dependencies: DependencyMap = {};
    for (const [name, value] of Object.entries({ ...parsed.packages, ...parsed['dev-packages'] })) {
        dependencies[normalizedPythonPackage(name)] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return { path, kind: 'Pipfile', dependencies, installed: dependencies };
}

function parsePyproject(path: string, text: string): PackageManifest {
    const parsed = pythonManifestSchema.parse(parseToml(text));
    const dependencies = pythonDependencies(parsed);
    return {
        path,
        kind: 'pyproject.toml',
        dependencies,
        installed: dependencies,
    };
}

function parseSwiftPackage(path: string, text: string): PackageManifest {
    const dependencies: DependencyMap = {};
    for (const match of text.matchAll(SWIFT_PACKAGE_URL)) {
        const url = match[1] ?? '';
        const last = posix.basename(url);
        dependencies[last.endsWith('.git') ? last.slice(0, -'.git'.length) : last] = url;
    }
    return {
        path,
        kind: 'Package.swift',
        dependencies,
        installed: dependencies,
    };
}

const TSCONFIG_MEMO = { create: () => new Map<string, TypeScriptConfiguration | undefined>() };

/**
 * Normalize a Python distribution name for package identity comparisons.
 * @param name the name as written
 * @returns the name in lower case with one hyphen between words
 */
export function normalizedPythonPackage(name: string): string {
    return name.toLowerCase().replaceAll(/[._-]+/gu, '-');
}

/**
 * Normalize the distribution name in a versioned Python package identity.
 * @param identity the distribution name and its exact version
 * @returns the normalized name with the version unchanged
 */
export function normalizedPythonIdentity(identity: string): string {
    return identity.replace(/^[^@]+(?=@)/u, normalizedPythonPackage);
}

/**
 * Read authored Bun installation settings without reading the repository.
 * @param text the bunfig.toml contents
 * @returns its installation table, empty when the document has none
 */
export function parseBunInstallSettings(text: string): Record<string, unknown> {
    const parsed = parseToml(text);
    return bunInstallSchema.parse(parsed).install;
}

/**
 * Parse a package manifest at the boundary that receives its contents.
 * @param text the package.json contents
 * @param path the source path included in parsing diagnostics, when known
 * @returns fields validated for repository and installed-package consumers
 */
export function parsePackageManifest(text: string, path?: string): PackageJson {
    try {
        const parsed: unknown = JSON.parse(text);
        return packageManifestSchema.parse(parsed);
    } catch (error) {
        if (path === undefined) throw error;
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read package manifest ${path}: ${detail}`, { cause: error });
    }
}

/**
 * Select the parser for a supported package manifest or requirements file.
 * @param path the repository-relative path used in fields and parsing diagnostics
 * @returns the text parser, or undefined for an unsupported file name
 */
export function manifestParser(path: string): ManifestParser | undefined {
    const base = posix.basename(path);
    const reader = base.startsWith('requirements') && base.endsWith('.txt') ? parseRequirements : readers[base];
    return reader === undefined ? undefined : (text) => reader(path, text);
}

/**
 * Resolves compiler options and inherited paths with the TypeScript compiler.
 * @param root the repository boundary for authored configuration
 * @param path the absolute configuration path
 * @param reads the configuration cache owned by this run
 * @returns the parsed configuration, or undefined when the file is absent
 */
export function getTsconfig(root: string, path: string, reads: ReadCache): TypeScriptConfiguration | undefined {
    const configurations = memo(reads, TSCONFIG_MEMO);
    const key = JSON.stringify([root, resolve(path)]);
    if (configurations.has(key)) return configurations.get(key);
    try {
        const text = configurationText(root, path, reads);
        const parsed =
            text === undefined
                ? undefined
                : parseTsconfig(path, text, { ...ts.sys, readFile: (file) => configurationText(root, file, reads) });
        configurations.set(key, parsed);
        return parsed;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read TypeScript configuration ${path}: ${detail}`, { cause: error });
    }
}

/**
 * Resolve a native project and every project it references with the run-owned configuration cache.
 * @param root the authored repository boundary
 * @param path the absolute native project path
 * @param reads the run-owned reads
 * @returns actual parsed projects indexed by their native absolute paths
 */
export function tsconfigProjects(root: string, path: string, reads: ReadCache): Map<string, TypeScriptConfiguration> {
    const projects = new Map<string, TypeScriptConfiguration>();
    const pending = [resolve(path)];
    for (const candidate of pending) {
        if (projects.has(candidate)) continue;
        const parsed = getTsconfig(root, candidate, reads);
        if (parsed === undefined) throw new Error(`Missing TypeScript project: ${candidate}`);
        projects.set(candidate, parsed);
        pending.push(
            ...(parsed.projectReferences ?? []).map((reference) => resolve(ts.resolveProjectReferencePath(reference))),
        );
    }
    return projects;
}

/**
 * Find the nearest authored TypeScript project that includes every source owned by a scope.
 * @param root the repository boundary.
 * @param scope the repository-relative scope.
 * @param files the scope-owned source paths.
 * @param reads the run-owned configuration cache
 * @returns the covering project, or no authored project for a standalone scope
 */
export function getTsconfigProject(
    root: string,
    scope: string,
    files: string[],
    reads: ReadCache,
): TypeScriptProject | undefined {
    const own = join(root, scope);
    let folder = own;
    let path = join(folder, 'tsconfig.json');
    let config = getTsconfig(root, path, reads);
    while (config === undefined && folder !== root) {
        folder = dirname(folder);
        path = join(folder, 'tsconfig.json');
        config = getTsconfig(root, path, reads);
    }
    if (config === undefined) return undefined;
    const projects = tsconfigProjects(root, path, reads);
    const members = new Set(
        [...projects.values()].flatMap((project) => project.fileNames.map((file) => toPosix(file))),
    );
    if (folder !== own && files.some((file) => !members.has(toPosix(join(root, file))))) return undefined;
    return { path, config, projects };
}
