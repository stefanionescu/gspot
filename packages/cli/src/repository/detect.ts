// Detects configurations from repository files and dependencies.
// The detection table: what the tree proposes at init and in doctor. Detection never selects.
import { readText } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { npmToolNames } from '#cli/configurations/tool-pins.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import { RUNTIME_TAG, SHEBANG_TAG } from '#cli/config/repository/inventory.ts';
import { isInScope, joinScope, projectFolder } from '#cli/repository/scopes.ts';
import type { TrackedFile, ScopeContents } from '#cli/types/repository/inventory.ts';
import type { DetectionEvidence, ConfigurationEvidence } from '#cli/types/repository/selection.ts';
import { pathMatcher, filenameMatcher, isInGspotFolder, isToolsOnlyPackage } from '#cli/repository/selectors.ts';

function dependencyMap(packageManifests: DependencyFile[], scope: string): Map<string, string> {
    const dependencies = new Map<string, string>();
    for (const fact of packageManifests) {
        if (!isInScope(fact.path, scope)) continue;
        for (const name of Object.keys(fact.dependencies)) dependencies.set(name, fact.path);
    }
    return dependencies;
}

function scopeContents(files: TrackedFile[], packageManifests: DependencyFile[], scope: string): ScopeContents {
    const candidates = files.filter(
        (file) => file.kind === 'source' && !isInGspotFolder(file.path) && isInScope(file.path, scope),
    );
    const extensionCounts = new Map<string, number>();
    const shebangs = new Set(
        candidates.flatMap((file) =>
            file.tags.filter((tag) => tag.startsWith(SHEBANG_TAG)).map((tag) => tag.slice(SHEBANG_TAG.length)),
        ),
    );
    const paths = new Set(candidates.map((file) => file.path));
    const scopeDependencyFiles = packageManifests.filter((fact) => paths.has(fact.path));
    const runtimes = new Map([
        ...candidates.flatMap((file) =>
            file.tags
                .filter((tag) => tag.startsWith(RUNTIME_TAG))
                .map((tag) => [tag.slice(RUNTIME_TAG.length), `${file.path} shebang`] as const),
        ),
        ...scopeDependencyFiles.flatMap((fact) => (fact.runtimes === undefined ? [] : Object.entries(fact.runtimes))),
    ]);
    for (const file of candidates) {
        const extension = extractExtension(file.path);
        if (extension !== '') extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
    }
    return {
        candidates,
        extensionCounts,
        shebangs,
        runtimes,
        dependencies: dependencyMap(scopeDependencyFiles, scope),
        scope,
    };
}

function extensionEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    const extensions = detect.extensions.filter((extension) => tree.extensionCounts.has(extension));
    if (extensions.length === 0) return undefined;
    const count = extensions.reduce((sum, extension) => sum + (tree.extensionCounts.get(extension) ?? 0), 0);
    return { evidence: `${String(count)} ${extensions.join(', ')} file${count === 1 ? '' : 's'}`, count };
}

function contentEvidence(root: string, detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    for (const [path, pattern] of Object.entries(detect.content)) {
        const target = joinScope(tree.scope, path);
        const file = tree.candidates.find((candidate) => candidate.path === target);
        if (file === undefined) continue;
        const text = readText(root, file.path);
        if (text !== undefined && new RegExp(pattern, 'u').test(text)) return { evidence: file.path };
    }
    return undefined;
}

function evidenceFor(root: string, manifest: Manifest, tree: ScopeContents): ConfigurationEvidence | undefined {
    const { configuration } = manifest;
    const evidence =
        evidenceReaders
            .values()
            .map((source) => source(manifest.detect, tree))
            .find((found) => found !== undefined) ?? contentEvidence(root, manifest.detect, tree);
    if (evidence !== undefined) return { configuration: configuration.name, group: configuration.group, ...evidence };
    return configuration.always_selected && tree.scope === ''
        ? { configuration: configuration.name, group: configuration.group, evidence: 'every repository' }
        : undefined;
}

const evidenceReaders = [
    extensionEvidence,
    projectEvidence,
    filenameEvidence,
    dependencyEvidence,
    shebangEvidence,
    runtimeEvidence,
    tagEvidence,
    pathEvidence,
];

function filenameEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    const matches = filenameMatcher(detect.filenames);
    const file = tree.candidates.find((candidate) => matches(candidate.path));
    return file === undefined ? undefined : { evidence: file.path };
}

// A project file names the project it marks, so use the file as evidence and its folder as a scope.
function projectEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    for (const pattern of detect.project_files) {
        const found = tree.candidates.find((file) => projectFolder(file.path, pattern) !== undefined);
        if (found !== undefined) return { evidence: found.path };
    }
    return undefined;
}

function dependencyEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    for (const pattern of detect.dependencies) {
        const matches = pathMatcher([pattern]);
        const dependency = [...tree.dependencies].find(([name]) => matches(name));
        if (dependency !== undefined) return { evidence: `${dependency[0]} in ${dependency[1]}` };
    }
    return undefined;
}

function shebangEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    const shebang = detect.shebangs.find((name) => tree.shebangs.has(name));
    return shebang === undefined ? undefined : { evidence: `${shebang} shebang` };
}

function runtimeEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    for (const name of detect.runtimes) {
        const evidence = tree.runtimes.get(name);
        if (evidence !== undefined) return { evidence };
    }
    return undefined;
}

function pathEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    if (detect.paths.length === 0) return undefined;
    const matcher = pathMatcher(detect.paths);
    const file = tree.candidates.find((candidate) => matcher(candidate.path));
    return file === undefined ? undefined : { evidence: file.path };
}

function tagEvidence(detect: Manifest['detect'], tree: ScopeContents): DetectionEvidence | undefined {
    const file = tree.candidates.find((candidate) => detect.tags.some((tag) => candidate.tags.includes(tag)));
    return file === undefined ? undefined : { evidence: file.path };
}

/**
 * Proposes configurations from the tree, the manifests and the dependencies, with the evidence for each.
 * @param root the repository that supplies tracked source content.
 * @param files the tracked files.
 * @param manifests every configuration manifest.
 * @param packageManifests the parsed package manifests.
 * @param scope the scope path, '' for the root.
 * @returns each matching configuration with its repository evidence.
 */
export function detectConfigurations(
    root: string,
    files: TrackedFile[],
    manifests: Map<string, Manifest>,
    packageManifests: DependencyFile[],
    scope = '',
): ConfigurationEvidence[] {
    const npmNames = npmToolNames(manifests.values());
    const tooling = new Set(
        packageManifests.filter((manifest) => isToolsOnlyPackage(manifest, npmNames)).map((manifest) => manifest.path),
    );
    const tree = scopeContents(
        files.filter((file) => !tooling.has(file.path)),
        packageManifests.filter((manifest) => !tooling.has(manifest.path)),
        scope,
    );
    return manifests
        .values()
        .map((manifest) => evidenceFor(root, manifest, tree))
        .filter((evidence) => evidence !== undefined)
        .toArray();
}

/**
 * Selects conditional declarations using the shared file and dependency evidence.
 * @param conditions the detection conditions declared by selected manifests.
 * @param files the repository source inventory.
 * @param packageManifests the parsed package manifests.
 * @returns the matching condition objects.
 */
export function detectConditions(
    conditions: Manifest['detect'][],
    files: TrackedFile[],
    packageManifests: DependencyFile[],
): Set<Manifest['detect']> {
    const tree = scopeContents(files, packageManifests, '');
    return new Set(
        conditions.filter(
            (condition) =>
                !condition.absent_dependencies.some((name) => tree.dependencies.has(name)) &&
                evidenceReaders.some((source) => source(condition, tree) !== undefined),
        ),
    );
}
