import { z } from 'zod';
// Readers for the manifests detection and takeover need: package.json, pyproject.toml, Package.swift and the rest.
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import { parse as parseToml } from 'smol-toml';
import type { DependencyMap, ManifestFacts, TrackedFile, PackageManifest } from '#cli/types/repository.ts';

const REQUIREMENT_NAME_END = /[\s<>=!~;[]/u;
const SWIFT_PACKAGE_URL = /url:\s*"([^"]+)"/gu;

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

function requirementName(spec: string): string {
    const end = spec.search(REQUIREMENT_NAME_END);
    return (end === -1 ? spec : spec.slice(0, end)).toLowerCase();
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
    return dependencies;
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
const pythonTools = z.object({ pytest: z.unknown().optional(), uv: uvTool.optional() });
const pythonManifestSchema = z.object({
    project: pythonProject.optional(),
    'dependency-groups': z.record(z.string(), dependencyGroup).optional(),
    tool: pythonTools.optional(),
});
const workspacePackages = z.object({ packages: stringList });

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
            const reader = READERS[base];
            if (reader === undefined) return [];
            try {
                return [reader(root, file.path)];
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
            }
        });
}
