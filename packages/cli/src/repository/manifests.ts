import { z } from 'zod';
import { parse as parseToml } from 'smol-toml';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { REQUIREMENT_NAME_END, SWIFT_PACKAGE_URL } from '#cli/constants/repository/repository.ts';
import type { TrackedFile, DependencyMap, ManifestFacts, PackageManifest } from '#cli/types/repository/repository.ts';

function manifestText(root: string, path: string): string {
    const files = openConfinedRoot(root, 'native');
    try {
        const content = files.read(path);
        if (content === undefined) throw new Error(`Manifest is missing: ${path}`);
        const text = content.bytes.toString('utf8');
        if (!Buffer.from(text).equals(content.bytes)) throw new Error(`Manifest is not UTF-8 text: ${path}`);
        return text;
    } finally {
        files.close();
    }
}

function packageJsonFacts(root: string, path: string): ManifestFacts {
    const parsed = readPackageManifest(root, path);
    const installed: DependencyMap = { ...parsed.dependencies, ...parsed.devDependencies };
    const dependencies: DependencyMap = {
        ...installed,
        ...parsed.peerDependencies,
        ...parsed.optionalDependencies,
    };
    const facts: ManifestFacts = {
        path,
        kind: 'package.json',
        dependencies,
        installed,
        scripts: parsed.scripts ?? {},
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : (parsed.workspaces?.packages ?? []),
        engines: parsed.engines ?? {},
    };
    const installer = parsed['packageManager'];
    if (typeof installer === 'string') facts.installer = installer;
    if (typeof parsed['type'] === 'string') facts.type = parsed['type'];
    return facts;
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
    for (const spec of groups) dependencies[requirementName(spec)] = spec;
    const poetry = parsed.tool?.poetry;
    for (const group of [
        poetry?.dependencies ?? {},
        ...Object.values(poetry?.group ?? {}).map((entry) => entry.dependencies ?? {}),
    ]) {
        for (const [name, value] of Object.entries(group)) {
            if (normalizedPythonPackage(name) === 'python') continue;
            dependencies[normalizedPythonPackage(name)] = typeof value === 'string' ? value : JSON.stringify(value);
        }
    }
    return dependencies;
}

function pipfileFacts(root: string, path: string): ManifestFacts {
    const parsed = pipfileSchema.parse(parseToml(manifestText(root, path)));
    const dependencies: DependencyMap = {};
    for (const [name, value] of Object.entries({ ...parsed.packages, ...parsed['dev-packages'] })) {
        dependencies[normalizedPythonPackage(name)] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return { path, kind: 'Pipfile', dependencies, installed: dependencies, scripts: {}, workspaces: [], engines: {} };
}

function requirementsFacts(root: string, path: string): ManifestFacts {
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

function pyprojectFacts(root: string, path: string): ManifestFacts {
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

function swiftFacts(root: string, path: string): ManifestFacts {
    const text = manifestText(root, path);
    const dependencies: DependencyMap = {};
    for (const match of text.matchAll(SWIFT_PACKAGE_URL)) {
        const url = match[1] ?? '';
        const last = url.slice(url.lastIndexOf('/') + 1);
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

const READERS: Record<string, (root: string, path: string) => ManifestFacts> = {
    'package.json': packageJsonFacts,
    'pyproject.toml': pyprojectFacts,
    'Package.swift': swiftFacts,
    Pipfile: pipfileFacts,
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
 * Reads the package fields used by detection, takeover, and manifest checks.
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
 * Facts from every manifest in the tree.
 * @param root the repository root
 * @param files the tracked files
 * @returns one facts entry per supported manifest
 */
export function readManifests(root: string, files: TrackedFile[]): ManifestFacts[] {
    return files
        .filter(
            (file) =>
                file.nature === 'source' &&
                !file.path.split('/').some((part) => part.toLowerCase() === '.gspot' || part === 'node_modules'),
        )
        .flatMap((file) => {
            const base = file.path.slice(file.path.lastIndexOf('/') + 1);
            const reader = base.startsWith('requirements') && base.endsWith('.txt') ? requirementsFacts : READERS[base];
            if (reader === undefined) return [];
            try {
                return [reader(root, file.path)];
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
            }
        });
}
