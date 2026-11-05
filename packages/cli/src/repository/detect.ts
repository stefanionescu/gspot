import { posix } from 'node:path';

import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { EVERY_REPOSITORY_EVIDENCE, RUNTIME_TAG } from '#cli/config/repository/files.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listToolOnlyPackages } from '#cli/repository/dependencies.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { findProjectFolder, joinScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildFilenameMatcher, buildPathMatcher } from '#cli/system/matchers.ts';
import { escapeGlob, extractExtension, isInScope } from '#cli/system/paths.ts';
import { formatCount } from '#cli/system/text.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type {
    ConfigurationEvidence,
    DetectionEvidence,
    Repository,
    ScopeContents,
    TrackedFile,
} from '#cli/types/repository.ts';

function buildScopeContents(files: TrackedFile[], dependencyFiles: DependencyFile[], scopePath: string): ScopeContents {
    const scopeFiles = files.filter(
        (file) => file.kind === 'source' && !isGspotPath(file.path) && isInScope(file.path, scopePath),
    );
    const extensionCounts = new Map<string, number>();
    const paths = new Set(scopeFiles.map((file) => file.path));
    const scopeDependencyFiles = dependencyFiles.filter((dependencyFile) => paths.has(dependencyFile.path));
    const runtimes = new Map([
        ...scopeFiles.flatMap((file) =>
            file.tags
                .filter((tag) => tag.startsWith(RUNTIME_TAG))
                .map((tag) => [tag.slice(RUNTIME_TAG.length), `${file.path} shebang`] as const),
        ),
        ...scopeDependencyFiles.flatMap((dependencyFile) =>
            dependencyFile.runtimes === undefined ? [] : Object.entries(dependencyFile.runtimes),
        ),
    ]);
    for (const file of scopeFiles) {
        const extension = extractExtension(file.path);
        if (extension !== '') extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
    }
    return {
        files: scopeFiles,
        extensionCounts,
        runtimes,
        dependencies: new Map(
            scopeDependencyFiles.flatMap((file) => Object.keys(file.dependencies).map((name) => [name, file.path])),
        ),
        scopePath,
    };
}

function findExtensionEvidence(
    detect: Configuration['detect'],
    contents: ScopeContents,
): DetectionEvidence | undefined {
    const extensions = detect.extensions.filter((extension) => contents.extensionCounts.has(extension));
    if (extensions.length === 0) return undefined;
    const count = extensions.reduce((sum, extension) => sum + (contents.extensionCounts.get(extension) ?? 0), 0);
    return { evidence: formatCount(count, `${extensions.join(', ')} file`), count };
}

function findContentEvidence(
    root: string,
    detect: Configuration['detect'],
    contents: ScopeContents,
): DetectionEvidence | undefined {
    for (const [path, pattern] of Object.entries(detect.content)) {
        const isTarget = buildPathMatcher([joinScope(escapeGlob(contents.scopePath), path)]);
        const file = contents.files.find((each) => {
            if (!isTarget(each.path)) return false;
            const text = findText(root, each.path);
            return text !== undefined && new RegExp(pattern, 'u').test(text);
        });
        if (file !== undefined) return { evidence: file.path };
    }
    return undefined;
}

function findConfigurationEvidence(
    root: string,
    configuration: Configuration,
    contents: ScopeContents,
): ConfigurationEvidence | undefined {
    if (configuration.detect.absent_dependencies.some((name) => contents.dependencies.has(name))) return undefined;
    const evidence =
        EVIDENCE_FINDERS.values()
            .map((source) => source(configuration.detect, contents))
            .find((found) => found !== undefined) ?? findContentEvidence(root, configuration.detect, contents);
    if (evidence !== undefined) return { configuration: configuration.name, group: configuration.group, ...evidence };
    return configuration.always_selected && contents.scopePath === ''
        ? { configuration: configuration.name, group: configuration.group, evidence: EVERY_REPOSITORY_EVIDENCE }
        : undefined;
}

function findFilenameEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    const isMatch = buildFilenameMatcher(detect.filenames);
    const file = contents.files.find((each) => isMatch(each.path));
    return file === undefined ? undefined : { evidence: file.path };
}

function findProjectEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    const hasNpmDependency = contents.dependencies.values().some((file) => posix.basename(file) === PACKAGE_JSON);
    for (const pattern of detect.project_files) {
        if (pattern === PACKAGE_JSON && !hasNpmDependency) continue;
        const found = contents.files.find((file) => findProjectFolder(file.path, pattern) !== undefined);
        if (found !== undefined) return { evidence: found.path };
    }
    return undefined;
}

function findDependencyEvidence(
    detect: Configuration['detect'],
    contents: ScopeContents,
): DetectionEvidence | undefined {
    for (const pattern of detect.dependencies) {
        const isMatch = buildPathMatcher([pattern]);
        const dependency = [...contents.dependencies].find(([name]) => isMatch(name));
        if (dependency !== undefined) return { evidence: `${dependency[0]} in ${dependency[1]}` };
    }
    return undefined;
}

function findRuntimeEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    for (const name of detect.runtimes) {
        const evidence = contents.runtimes.get(name);
        if (evidence !== undefined) return { evidence };
    }
    return undefined;
}

function findPathEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    if (detect.paths.length === 0) return undefined;
    const isMatch = buildPathMatcher(detect.paths);
    const file = contents.files.find((each) => isMatch(each.path));
    return file === undefined ? undefined : { evidence: file.path };
}

function findTagEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    const file = contents.files.find((each) => detect.tags.some((tag) => each.tags.includes(tag)));
    return file === undefined ? undefined : { evidence: file.path };
}

const EVIDENCE_FINDERS = [
    findExtensionEvidence,
    findProjectEvidence,
    findFilenameEvidence,
    findDependencyEvidence,
    findRuntimeEvidence,
    findTagEvidence,
    findPathEvidence,
];

/**
Propose configurations from the files and the dependencies, with the evidence for each.

@param repository the inventory and parsed package declarations.
@param scopePath the folder, '' for the root.
*/
export function detectConfigurations(
    repository: Pick<Repository, 'root' | 'files' | 'dependencyFiles'>,
    scopePath = '',
): ConfigurationEvidence[] {
    const { root, files, dependencyFiles } = repository;
    const toolOnlyPackages = listToolOnlyPackages(dependencyFiles, readConfigurations().values());
    const contents = buildScopeContents(
        files.filter((file) => !toolOnlyPackages.has(file.path)),
        dependencyFiles.filter((dependencyFile) => !toolOnlyPackages.has(dependencyFile.path)),
        scopePath,
    );
    return readConfigurations()
        .values()
        .map((configuration) => findConfigurationEvidence(root, configuration, contents))
        .filter((evidence) => evidence !== undefined)
        .toArray();
}

/**
Select the conditions that the file and dependency evidence meets.

@param conditions the detection rules of the manifests.
@param files the repository source inventory.
@param dependencyFiles the parsed dependency files.
*/
export function detectConditions(
    conditions: Array<Configuration['detect']>,
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
): Set<Configuration['detect']> {
    const contents = buildScopeContents(files, dependencyFiles, '');
    return new Set(
        conditions.filter(
            (condition) =>
                condition.absent_dependencies.every((name) => !contents.dependencies.has(name)) &&
                EVIDENCE_FINDERS.some((source) => source(condition, contents) !== undefined),
        ),
    );
}

/**
List the general configurations that gspot adds without an explicit selection.

@param repository the available inventory, if any
*/
export function listAutomaticConfigurations(
    repository?: Pick<Repository, 'root' | 'files' | 'dependencyFiles'>,
): string[] {
    const general = new Map([...readConfigurations()].filter(([, configuration]) => configuration.group === 'general'));
    const automatic = new Set(
        general
            .values()
            .filter((configuration) => configuration.always_selected)
            .map((configuration) => configuration.name),
    );
    if (repository === undefined) return [...automatic];
    const detected = new Set(detectConfigurations(repository).map(({ configuration }) => configuration));
    for (const configuration of general.values())
        if (detected.has(configuration.name)) automatic.add(configuration.name);
    return general
        .keys()
        .filter((name) => automatic.has(name))
        .toArray();
}
