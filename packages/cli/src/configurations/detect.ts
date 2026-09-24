// The detection table: what the tree proposes at init and in doctor. Detection never selects.
import * as linguistLanguages from 'linguist-languages';
import type { TreeFacts } from '#cli/repository/tree.ts';
import { pathMatcher } from '#cli/configurations/claims.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import type { ManifestFacts } from '#cli/repository/manifests.ts';
import { SHEBANG_INTERPRETERS } from '#cli/repository/patterns.ts';
import type { Manifest } from '#cli/configurations/read-manifests.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';

type LinguistEntry = {
    extensions?: readonly string[];
    type?: string;
    filenames?: readonly string[];
    aliases?: readonly string[];
};

const SHEBANG_TAG = 'shebang:';
const GLOB_CHARS = /[*?{]/u;
const ENV_SUFFIX = '/env';
const LANGUAGE_BY_FILENAME = new Map(
    Object.entries(linguistLanguages).flatMap(([language, value]) =>
        ((value as LinguistEntry).filenames ?? []).map((filename) => [filename, language] as const),
    ),
);

function languageByExtension(): Map<string, string> {
    const map = new Map<string, string>();
    for (const [name, value] of Object.entries(linguistLanguages)) {
        const entry = value as LinguistEntry;
        if (entry.type !== 'programming') continue;
        const extensions = entry.extensions ?? [];
        for (const extension of extensions) {
            const normalized = extension.toLowerCase();
            const isAlias = entry.aliases?.includes(normalized.slice(1)) === true;
            if (isAlias || !map.has(normalized)) map.set(normalized, name);
        }
    }
    return map;
}

function dependencyMap(facts: ManifestFacts[], scope: string): Map<string, string> {
    const dependencies = new Map<string, string>();
    for (const fact of facts) {
        if (scope !== '' && !fact.path.startsWith(`${scope}/`)) continue;
        for (const name of Object.keys(fact.dependencies)) dependencies.set(name, fact.path);
    }
    return dependencies;
}

function treeFacts(files: TrackedFile[], facts: ManifestFacts[], scope: string): TreeFacts {
    const candidates = files.filter(
        (file) =>
            file.nature === 'source' &&
            !file.path.split('/').some((part) => part.toLowerCase() === '.gspot') &&
            (scope === '' || file.path.startsWith(`${scope}/`)),
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
    return { candidates, extensionCounts, names, shebangs, dependencies: dependencyMap(facts, scope), scope };
}

function isFileNamed(tree: TreeFacts, name: string): boolean {
    if (!GLOB_CHARS.test(name)) return tree.names.has(name);
    const matcher = pathMatcher([name]);
    return tree.candidates.some((file) => matcher(baseName(file.path)) || matcher(file.path));
}

function extensionEvidence(manifest: Manifest, tree: TreeFacts): string | undefined {
    const extensions = manifest.detect.extensions.filter((extension) => tree.extensionCounts.has(extension));
    if (extensions.length === 0) return undefined;
    const count = extensions.reduce((sum, extension) => sum + (tree.extensionCounts.get(extension) ?? 0), 0);
    return `${String(count)} ${extensions.join(', ')} file${count === 1 ? '' : 's'}`;
}

function extensionCount(manifest: Manifest, tree: TreeFacts): number {
    return manifest.detect.extensions.reduce((sum, extension) => sum + (tree.extensionCounts.get(extension) ?? 0), 0);
}

function filenameEvidence(manifest: Manifest, tree: TreeFacts): string | undefined {
    const filename = manifest.detect.filenames.find((name) => isFileNamed(tree, name));
    if (filename === undefined) return undefined;
    const matcher = pathMatcher([filename]);
    const found = tree.candidates.find(
        (file) => baseName(file.path) === filename || matcher(file.path) || matcher(baseName(file.path)),
    );
    return found?.path ?? filename;
}

function dependencyEvidence(manifest: Manifest, tree: TreeFacts): string | undefined {
    const dependency = manifest.detect.dependencies.find((name) => tree.dependencies.has(name));
    return dependency === undefined ? undefined : `${dependency} in ${tree.dependencies.get(dependency) ?? ''}`;
}

function shebangEvidence(manifest: Manifest, tree: TreeFacts): string | undefined {
    const shebang = manifest.detect.shebangs.find((name) => tree.shebangs.has(name));
    return shebang === undefined ? undefined : `${shebang} shebang`;
}

function pathEvidence(manifest: Manifest, tree: TreeFacts): string | undefined {
    if (manifest.detect.paths.length === 0) return undefined;
    const matcher = pathMatcher(manifest.detect.paths);
    return tree.candidates.find((file) => matcher(file.path))?.path;
}

function defaultEvidence(manifest: Manifest, tree: TreeFacts): string | undefined {
    return manifest.configuration.default && tree.scope === '' ? 'every repository' : undefined;
}

function tagEvidence(manifest: Manifest, tree: TreeFacts): string | undefined {
    return tree.candidates.find((file) => manifest.detect.tags.some((tag) => file.tags.includes(tag)))?.path;
}

const EVIDENCE = [filenameEvidence, dependencyEvidence, shebangEvidence, tagEvidence, pathEvidence, defaultEvidence];

function proposalFor(manifest: Manifest, tree: TreeFacts): Proposal | undefined {
    const { configuration } = manifest;
    const byExtension = extensionEvidence(manifest, tree);
    if (byExtension !== undefined)
        return {
            configuration: configuration.name,
            kind: configuration.kind,
            evidence: byExtension,
            count: extensionCount(manifest, tree),
        };
    for (const source of EVIDENCE) {
        const evidence = source(manifest, tree);
        if (evidence !== undefined) return { configuration: configuration.name, kind: configuration.kind, evidence };
    }
    return undefined;
}

function withoutTrailingVersion(word: string): string {
    let end = word.length;
    while (end > 0 && '0123456789.'.includes(word[end - 1] ?? '')) end -= 1;
    return word.slice(0, end);
}

/**
 * Proposes configurations from the tree, the manifests and the dependencies, with the evidence for each.
 * @param files the tracked files
 * @param manifests every configuration manifest
 * @param facts the package manifests read from the tree
 * @param scope the scope path, '' for the root
 * @returns one proposal per configuration with evidence
 */
export function detectConfigurations(
    files: TrackedFile[],
    manifests: Map<string, Manifest>,
    facts: ManifestFacts[],
    scope = '',
): Proposal[] {
    const tree = treeFacts(files, facts, scope);
    return manifests
        .values()
        .map((manifest) => proposalFor(manifest, tree))
        .filter((proposal) => proposal !== undefined)
        .toArray();
}

/**
 * Languages in the tree that no configuration detects, named through GitHub Linguist's data.
 * @param files the tracked files
 * @param manifests every configuration manifest
 * @returns the languages with their extensions and file counts, most files first
 */
export function unknownLanguages(files: TrackedFile[], manifests: Map<string, Manifest>): UnknownLanguage[] {
    const known = new Set(
        manifests.values().flatMap((manifest) => [...manifest.detect.extensions, ...manifest.claims.extensions]),
    );
    const byExtension = languageByExtension();
    const counts = new Map<string, { extensions: Set<string>; count: number }>();
    for (const file of files) {
        const extension = extensionOf(file.path);
        const fromExtension =
            file.nature === 'source' && !known.has(extension) ? byExtension.get(extension) : undefined;
        if (fromExtension === undefined) continue;
        const language = LANGUAGE_BY_FILENAME.get(baseName(file.path)) ?? fromExtension;
        const entry = counts.get(language) ?? { extensions: new Set<string>(), count: 0 };
        entry.extensions.add(extension);
        entry.count += 1;
        counts.set(language, entry);
    }
    return [...counts]
        .map(([language, entry]) => ({
            language,
            extensions: [...entry.extensions].toSorted((a, b) => a.localeCompare(b)),
            count: entry.count,
        }))
        .toSorted((a, b) => b.count - a.count);
}

/**
 * Reads the executable token, including env -S and interpreter arguments.
 * @param firstLine the first line of the file
 * @returns the executable basename or undefined without a shebang
 */
export function shebangExecutable(firstLine: string): string | undefined {
    if (!firstLine.startsWith('#!')) return undefined;
    const tokens = firstLine.slice(2).trim().split(/\s+/u);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_SUFFIX) === true) index += 1;
    if (tokens[index] === '-S') index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : word.slice(word.lastIndexOf('/') + 1);
}

/**
 * The interpreter a shebang names, or undefined.
 * @param firstLine the first line of the file
 * @returns the interpreter name the table knows
 */
export function shebangInterpreter(firstLine: string): string | undefined {
    const word = shebangExecutable(firstLine);
    if (word === undefined) return undefined;
    const stripped = withoutTrailingVersion(word);
    return SHEBANG_INTERPRETERS[word] ?? SHEBANG_INTERPRETERS[stripped];
}

export type Proposal = { configuration: string; evidence: string; kind: string; count?: number };

export type UnknownLanguage = { language: string; extensions: string[]; count: number };
