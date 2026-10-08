import semver from 'semver';
import { posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

import {
    RUNTIME_COMMAND,
    YARN_BERRY_MAJOR,
    SWIFT_PACKAGE_URL,
    JAVASCRIPT_RUNTIMES,
    REQUIREMENT_NAME_END,
} from '#cli/config/parsers/packages.ts';
import {
    pipfileSchema,
    bunInstallSchema,
    toolProjectSchema,
    pythonManifestSchema,
    packageManifestSchema,
    packageInstallerSchema,
    packageInstallerDeclarationSchema,
} from '#cli/parsers/schema/packages.ts';
import type {
    PackageJson,
    DependencyMap,
    ManifestParser,
    PoetrySettings,
    PythonManifest,
    PackageManifest,
    PackageInstaller,
    PackageToolProject,
    PackageInstallerDeclaration,
} from '#cli/types/parsers/packages.ts';

function packageInstallerDeclaration(value: string): PackageInstallerDeclaration {
    const [name, declared, ...verbatim] = value.split('@');
    if (verbatim.length > 0) throw new Error('Invalid packageManager declaration.');
    const version = (declared ?? '').split('+sha', 1)[0];
    return packageInstallerDeclarationSchema.parse({ name, version });
}

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

/**
 * Identify the Yarn major version that uses Berry configuration and installation arguments.
 * @param installer the validated package manager and version requirement
 * @returns whether the manager is Yarn Berry
 */
export function isYarnBerry(installer: PackageInstaller): boolean {
    if (installer.name !== 'yarn') return false;
    return getPackageInstallerMajor(installer) >= YARN_BERRY_MAJOR;
}

/**
 * Get the major version from a validated package-manager version or major requirement.
 * @param installer the validated package manager
 * @returns the required major version
 */
export function getPackageInstallerMajor(installer: PackageInstaller): number {
    return semver.major(installer.version.replace('.x', '.0.0'));
}

/**
 * Validate a package-manager version requirement at the manifest boundary.
 * @param value the packageManager declaration
 * @returns the manager name and version requirement
 */
export function parsePackageInstaller(value: string): PackageInstaller {
    return packageInstallerSchema.parse(packageInstallerDeclaration(value));
}

/**
 * Read an authored manager declaration before validating its installation version.
 * @param manifest the validated package manifest
 * @returns packageManager first, then the first devEngines declaration, or no declaration
 */
export function declaredPackageInstaller(manifest: PackageJson): PackageInstallerDeclaration | undefined {
    if (manifest.packageManager !== undefined) return packageInstallerDeclaration(manifest.packageManager);
    const engines = manifest.devEngines?.packageManager;
    const entry = Array.isArray(engines) ? engines[0] : engines;
    return entry?.name === undefined ? undefined : packageInstallerDeclarationSchema.parse(entry);
}

/**
 * Validate an npm tool project and identify its package manager and lockfile.
 * @param text the generated or recorded package.json contents
 * @returns the declared manager, dependencies, and repository-relative lockfile path
 */
export function parseToolProject(text: string): PackageToolProject {
    const parsed = toolProjectSchema.parse(JSON.parse(text));
    const installer = parsePackageInstaller(parsed.packageManager);
    const lockfile = packageLockfile(installer.name);
    return { installer, dependencies: parsed.devDependencies, lockfile, lockfilePath: `${DOT_GSPOT}/${lockfile}` };
}

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
 * Select the native lockfile of a npm tool project's manager.
 * @param installer the validated package manager
 * @returns the lockfile basename declared by its registry entry
 */
export function packageLockfile(installer: PackageInstaller['name']): ToolProjectLockfileName {
    for (const entry of LOCKFILES) if ('toolProject' in entry && entry.client === installer) return entry.file;
    throw new Error(`The lockfile registry declares no tool project lockfile for ${installer}.`);
}
