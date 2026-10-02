import { z } from 'zod';
import { parse as parseToml } from 'smol-toml';
import { baseName } from '#cli/platform/paths.ts';
import { decodedText } from '#cli/platform/text.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { SWIFT_PACKAGE_URL, REQUIREMENT_NAME_END } from '#cli/config/repository/repository.ts';
import type { Fields, TrackedFile, DependencyMap, PackageManifest } from '#cli/types/repository/repository.ts';

function manifestText(root: string, path: string): string {
    using files = openRoot(root, 'native');
    const content = files.read(path);
    if (content === undefined) throw new Error(`Manifest is missing: ${path}`);
    const text = decodedText(content.bytes);
    if (text === undefined) throw new Error(`Manifest is not UTF-8 text: ${path}`);
    return text;
}

function packageJsonFacts(root: string, path: string): Fields {
    const parsed = readPackageManifest(root, path);
    const installed: DependencyMap = { ...parsed.dependencies, ...parsed.devDependencies };
    const dependencies: DependencyMap = {
        ...installed,
        ...parsed.peerDependencies,
        ...parsed.optionalDependencies,
    };
    const fields: Fields = {
        path,
        kind: 'package.json',
        dependencies,
        installed,
        scripts: parsed.scripts ?? {},
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : (parsed.workspaces?.packages ?? []),
        engines: parsed.engines ?? {},
    };
    const installer = parsed['packageManager'];
    if (typeof installer === 'string') fields.installer = installer;
    if (typeof parsed['type'] === 'string') fields.type = parsed['type'];
    return fields;
}

// A requirement that names a package: letters or digits at both ends, dots, dashes, and underscores between.
function isNamedRequirement(spec: string): boolean {
    const end = spec.search(REQUIREMENT_NAME_END);
    const name = end === -1 ? spec : spec.slice(0, end);
    return /^[A-Za-z0-9]/u.test(name) && /[A-Za-z0-9]$/u.test(name) && /^[A-Za-z0-9._-]*$/u.test(name);
}

function requirementName(spec: string): string {
    const trimmed = spec.trim();
    const end = trimmed.search(REQUIREMENT_NAME_END);
    return normalizedPythonPackage(end === -1 ? trimmed : trimmed.slice(0, end));
}

function poetryDependencies(
    poetry: NonNullable<ReturnType<typeof pythonManifestSchema.parse>['tool']>['poetry'],
): DependencyMap {
    const poetryGroups = [
        poetry?.dependencies ?? {},
        ...Object.values(poetry?.group ?? {}).map((entry) => entry.dependencies ?? {}),
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

function pythonDependencies(parsed: ReturnType<typeof pythonManifestSchema.parse>): DependencyMap {
    const project = parsed.project ?? {};
    const groups = [
        ...(project.dependencies ?? []),
        ...Object.values(project['optional-dependencies'] ?? {}).flat(),
        ...Object.values(parsed['dependency-groups'] ?? {})
            .flat()
            .filter((entry) => typeof entry === 'string'),
    ];
    const dependencies: DependencyMap = parsed.tool?.pytest === undefined ? {} : { pytest: 'tool.pytest' };
    return Object.assign(
        dependencies,
        Object.fromEntries(groups.map((spec) => [requirementName(spec), spec])),
        poetryDependencies(parsed.tool?.poetry),
    );
}

function pipfile(root: string, path: string): Fields {
    const parsed = pipfileSchema.parse(parseToml(manifestText(root, path)));
    const dependencies: DependencyMap = {};
    for (const [name, value] of Object.entries({ ...parsed.packages, ...parsed['dev-packages'] })) {
        dependencies[normalizedPythonPackage(name)] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return { path, kind: 'Pipfile', dependencies, installed: dependencies, scripts: {}, workspaces: [], engines: {} };
}

function requirements(root: string, path: string): Fields {
    const text = manifestText(root, path);
    const dependencies: DependencyMap = {};
    for (const line of text.replaceAll(/\\\r?\n/gu, '').split(/\r?\n/u)) {
        const comment = line.search(/\s#/u);
        const spec = (comment === -1 ? line : line.slice(0, comment)).trim();
        if (!isNamedRequirement(spec)) continue;
        dependencies[requirementName(spec)] = spec;
    }
    return {
        path,
        kind: 'requirements.txt',
        dependencies,
        installed: dependencies,
        scripts: {},
        workspaces: [],
        engines: {},
    };
}

function pyproject(root: string, path: string): Fields {
    const text = manifestText(root, path);
    const parsed = pythonManifestSchema.parse(parseToml(text));
    const project = parsed.project ?? {};
    const dependencies = pythonDependencies(parsed);
    const requiresPython = project['requires-python'];
    const engines: Record<string, string> = typeof requiresPython === 'string' ? { python: requiresPython } : {};
    return {
        path,
        kind: 'pyproject.toml',
        dependencies,
        installed: dependencies,
        scripts: project.scripts ?? {},
        workspaces: parsed.tool?.uv?.workspace?.members ?? [],
        engines,
    };
}

function swift(root: string, path: string): Fields {
    const text = manifestText(root, path);
    const dependencies: DependencyMap = {};
    for (const match of text.matchAll(SWIFT_PACKAGE_URL)) {
        const url = match[1] ?? '';
        const last = baseName(url);
        dependencies[last.endsWith('.git') ? last.slice(0, -'.git'.length) : last] = url;
    }
    return {
        path,
        kind: 'Package.swift',
        scripts: {},
        workspaces: [],
        engines: {},
        dependencies,
        installed: dependencies,
    };
}

const READERS: Record<string, (root: string, path: string) => Fields> = {
    'package.json': packageJsonFacts,
    'pyproject.toml': pyproject,
    'Package.swift': swift,
    Pipfile: pipfile,
};

const stringList = z.array(z.string());
const stringMap = z.record(z.string(), z.string());
const dependencyGroups = z.record(z.string(), stringList);
const groupInclude = z.object({ 'include-group': z.string() });
const dependencyGroup = z.array(z.union([z.string(), groupInclude]));
const pythonProject = z.object({
    dependencies: stringList.optional(),
    'optional-dependencies': dependencyGroups.optional(),
    scripts: stringMap.optional(),
    'requires-python': z.string().optional(),
});
const uvWorkspace = z.object({ members: stringList.optional() });
const uvTool = z.object({ workspace: uvWorkspace.optional() });
const pythonDependencyDetail = z.record(z.string(), z.unknown());
const pythonDependencyMap = z.record(
    z.string(),
    z.union([z.string(), pythonDependencyDetail, z.array(pythonDependencyDetail)]),
);
const poetryGroup = z.object({ dependencies: pythonDependencyMap.optional() });
const poetryTool = z.object({
    dependencies: pythonDependencyMap.optional(),
    group: z.record(z.string(), poetryGroup).optional(),
});
const pythonTools = z.object({ pytest: z.unknown().optional(), uv: uvTool.optional(), poetry: poetryTool.optional() });
const pipfileSchema = z.object({
    packages: pythonDependencyMap.optional(),
    'dev-packages': pythonDependencyMap.optional(),
});
const pythonManifestSchema = z.object({
    project: pythonProject.optional(),
    'dependency-groups': z.record(z.string(), dependencyGroup).optional(),
    tool: pythonTools.optional(),
});
const workspacePackages = z.object({ packages: stringList });

/**
 * Normalize a Python distribution name for package identity comparisons.
 * @param name the name as written
 * @returns the name in lower case with one hyphen between words
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: License, allowlist, and lock readers compare Python package names by this one normalization.
export function normalizedPythonPackage(name: string): string {
    return name.toLowerCase().replaceAll(/[._-]+/gu, '-');
}

export const packageManifestSchema = z.object({
    imports: z.record(z.string(), z.unknown()).optional(),
    private: z.boolean().optional(),
    packageManager: z.string().optional(),
    type: z.string().optional(),
    workspaces: z.union([stringList, workspacePackages]).optional(),
    dependencies: stringMap.optional(),
    devDependencies: stringMap.optional(),
    peerDependencies: stringMap.optional(),
    optionalDependencies: stringMap.optional(),
    scripts: stringMap.optional(),
    engines: stringMap.optional(),
});

/**
 * Reads the package fields used by detection, replace, and manifest checks.
 * @param root the repository root
 * @param path the manifest path relative to the root
 * @returns the validated package fields
 */
export function readPackageManifest(root: string, path: string): PackageManifest {
    try {
        const content: unknown = JSON.parse(manifestText(root, path));
        return packageManifestSchema.parse(content);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read package manifest ${path}: ${detail}`, { cause: error });
    }
}

/**
 * Fields from every manifest in the tree.
 * @param root the repository root
 * @param files the tracked files
 * @returns one fields entry per supported manifest
 */
export function readManifests(root: string, files: TrackedFile[]): Fields[] {
    return files
        .filter(
            (file) =>
                file.kind === 'source' &&
                !file.path.split('/').some((part) => part.toLowerCase() === '.gspot' || part === 'node_modules'),
        )
        .flatMap((file) => {
            const base = baseName(file.path);
            const reader = base.startsWith('requirements') && base.endsWith('.txt') ? requirements : READERS[base];
            if (reader === undefined) return [];
            try {
                return [reader(root, file.path)];
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
            }
        });
}
