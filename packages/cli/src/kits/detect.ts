// The detection table: what the tree proposes at init and in doctor. Detection never selects.
import { projectFolder } from '#cli/repository/scopes.ts';
import { GLOB_CHARS, SHEBANG_TAG } from '#cli/config/kits.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { GSPOT_FOLDER } from '#cli/config/repository/repository.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import type { Layout, Manifest, KitEvidence } from '#cli/types/kits.ts';
import type { Fields, TrackedFile } from '#cli/types/repository/repository.ts';

function dependencyMap(fields: Fields[], scope: string): Map<string, string> {
    const dependencies = new Map<string, string>();
    for (const fact of fields) {
        if (!isInScope(fact.path, scope)) continue;
        for (const name of Object.keys(fact.dependencies)) dependencies.set(name, fact.path);
    }
    return dependencies;
}

function layout(files: TrackedFile[], fields: Fields[], scope: string): Layout {
    const candidates = files.filter(
        (file) =>
            file.kind === 'source' &&
            !file.path.split('/').some((part) => part.toLowerCase() === GSPOT_FOLDER) &&
            isInScope(file.path, scope),
    );
    const extensionCounts = new Map<string, number>();
    const names = new Set<string>();
    const shebangs = new Set<string>();
    for (const file of candidates) {
        const extension = extensionOf(file.path);
        if (extension !== '') extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
        names.add(baseName(file.path));
        for (const tag of file.tags) if (tag.startsWith(SHEBANG_TAG)) shebangs.add(tag.slice(SHEBANG_TAG.length));
    }
    return { candidates, extensionCounts, names, shebangs, dependencies: dependencyMap(fields, scope), scope };
}

function isFileNamed(tree: Layout, name: string): boolean {
    if (!GLOB_CHARS.test(name)) return tree.names.has(name);
    const matcher = pathMatcher([name]);
    return tree.candidates.some((file) => matcher(baseName(file.path)) || matcher(file.path));
}

function extensionEvidence(detect: Manifest['detect'], tree: Layout): string | undefined {
    const extensions = detect.extensions.filter((extension) => tree.extensionCounts.has(extension));
    if (extensions.length === 0) return undefined;
    const count = extensions.reduce((sum, extension) => sum + (tree.extensionCounts.get(extension) ?? 0), 0);
    return `${String(count)} ${extensions.join(', ')} file${count === 1 ? '' : 's'}`;
}

function filenameEvidence(detect: Manifest['detect'], tree: Layout): string | undefined {
    const filename = detect.filenames.find((name) => isFileNamed(tree, name));
    if (filename === undefined) return undefined;
    const matcher = pathMatcher([filename]);
    const found = tree.candidates.find(
        (file) => baseName(file.path) === filename || matcher(file.path) || matcher(baseName(file.path)),
    );
    return found?.path ?? filename;
}

// A project file names the project it marks, so the file is the evidence and its folder is a scope.
function projectEvidence(detect: Manifest['detect'], tree: Layout): string | undefined {
    for (const pattern of detect.project_files) {
        const found = tree.candidates.find((file) => projectFolder(file.path, pattern) !== undefined);
        if (found !== undefined) return found.path;
    }
    return undefined;
}

function dependencyEvidence(detect: Manifest['detect'], tree: Layout): string | undefined {
    const dependency = detect.dependencies.find((name) => tree.dependencies.has(name));
    return dependency === undefined ? undefined : `${dependency} in ${tree.dependencies.get(dependency) ?? ''}`;
}

function shebangEvidence(detect: Manifest['detect'], tree: Layout): string | undefined {
    const shebang = detect.shebangs.find((name) => tree.shebangs.has(name));
    return shebang === undefined ? undefined : `${shebang} shebang`;
}

function pathEvidence(detect: Manifest['detect'], tree: Layout): string | undefined {
    if (detect.paths.length === 0) return undefined;
    const matcher = pathMatcher(detect.paths);
    return tree.candidates.find((file) => matcher(file.path))?.path;
}

function tagEvidence(detect: Manifest['detect'], tree: Layout): string | undefined {
    return tree.candidates.find((file) => detect.tags.some((tag) => file.tags.includes(tag)))?.path;
}

const EVIDENCE = [projectEvidence, filenameEvidence, dependencyEvidence, shebangEvidence, tagEvidence, pathEvidence];

function planFor(manifest: Manifest, tree: Layout): KitEvidence | undefined {
    const { kit: configuration } = manifest;
    const byExtension = extensionEvidence(manifest.detect, tree);
    if (byExtension !== undefined)
        return {
            kit: configuration.name,
            kind: configuration.kind,
            evidence: byExtension,
            count: manifest.detect.extensions.reduce(
                (sum, extension) => sum + (tree.extensionCounts.get(extension) ?? 0),
                0,
            ),
        };
    for (const source of EVIDENCE) {
        const evidence = source(manifest.detect, tree);
        if (evidence !== undefined) return { kit: configuration.name, kind: configuration.kind, evidence };
    }
    const evidence = configuration.default && tree.scope === '' ? 'every repository' : undefined;
    return evidence === undefined ? undefined : { kit: configuration.name, kind: configuration.kind, evidence };
}

/**
 * Proposes configurations from the tree, the manifests and the dependencies, with the evidence for each.
 * @param files the tracked files
 * @param manifests every kit manifest
 * @param fields the package manifests read from the tree
 * @param scope the scope path, '' for the root
 * @returns one plan per configuration with evidence
 */
export function detectKits(
    files: TrackedFile[],
    manifests: Map<string, Manifest>,
    fields: Fields[],
    scope = '',
): KitEvidence[] {
    const tree = layout(files, fields, scope);
    return manifests
        .values()
        .map((manifest) => planFor(manifest, tree))
        .filter((plan) => plan !== undefined)
        .toArray();
}

/**
 * Selects conditional declarations using the shared file and dependency evidence.
 * @param conditions the detection conditions declared by selected manifests.
 * @param files the repository source inventory.
 * @param fields the package dependency reads.
 * @returns the matching condition objects.
 */
export function detectConditions(
    conditions: Manifest['detect'][],
    files: TrackedFile[],
    fields: Fields[],
): Set<Manifest['detect']> {
    const tree = layout(files, fields, '');
    const matched = new Set<Manifest['detect']>();
    for (const condition of conditions)
        if (
            extensionEvidence(condition, tree) !== undefined ||
            EVIDENCE.some((source) => source(condition, tree) !== undefined)
        )
            matched.add(condition);
    return matched;
}
