// Proposes configurations from repository files and dependencies; it never selects them.
import { findText } from '#cli/system/files/reads.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { extractExtension } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { listToolOnlyPackages } from '#cli/repository/dependencies.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/files.ts';
import type { DependencyFile } from '#cli/types/parsers/projects/dependencies.ts';
import { RUNTIME_TAG, SHEBANG_TAG } from '#cli/config/repository/files/classify.ts';
import { isInScope, joinScope, findProjectFolder } from '#cli/repository/scopes.ts';
import { buildPathMatcher, buildFilenameMatcher } from '#cli/repository/files/matchers.ts';

import {
    type ScopeContents,
    type DetectionEvidence,
    type ConfigurationEvidence,
} from '#cli/types/repository/detect.ts';

function buildScopeContents(files: TrackedFile[], dependencyFiles: DependencyFile[], scope: string): ScopeContents {
    const scopeFiles = files.filter(
        (file) => file.kind === 'source' && !file.path.startsWith(`${DOT_GSPOT}/`) && isInScope(file.path, scope),
    );
    const extensionCounts = new Map<string, number>();
    const shebangs = new Set(
        scopeFiles.flatMap((file) =>
            file.tags.filter((tag) => tag.startsWith(SHEBANG_TAG)).map((tag) => tag.slice(SHEBANG_TAG.length)),
        ),
    );
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
        shebangs,
        runtimes,
        dependencies: new Map(
            scopeDependencyFiles.flatMap((file) => Object.keys(file.dependencies).map((name) => [name, file.path])),
        ),
        scope,
    };
}

function findExtensionEvidence(
    detect: Configuration['detect'],
    contents: ScopeContents,
): DetectionEvidence | undefined {
    const extensions = detect.extensions.filter((extension) => contents.extensionCounts.has(extension));
    if (extensions.length === 0) return undefined;
    const count = extensions.reduce((sum, extension) => sum + (contents.extensionCounts.get(extension) ?? 0), 0);
    return { evidence: `${String(count)} ${extensions.join(', ')} file${count === 1 ? '' : 's'}`, count };
}

function findContentEvidence(
    root: string,
    detect: Configuration['detect'],
    contents: ScopeContents,
): DetectionEvidence | undefined {
    for (const [path, pattern] of Object.entries(detect.content)) {
        const target = joinScope(contents.scope, path);
        const file = contents.files.find((entry) => entry.path === target);
        if (file === undefined) continue;
        const text = findText(root, file.path);
        if (text !== undefined && new RegExp(pattern, 'u').test(text)) return { evidence: file.path };
    }
    return undefined;
}

function findConfigurationEvidence(
    root: string,
    configuration: Configuration,
    contents: ScopeContents,
): ConfigurationEvidence | undefined {
    const evidence =
        EVIDENCE_FINDERS.values()
            .map((source) => source(configuration.detect, contents))
            .find((found) => found !== undefined) ?? findContentEvidence(root, configuration.detect, contents);
    if (evidence !== undefined) return { configuration: configuration.name, group: configuration.group, ...evidence };
    return configuration.always_selected && contents.scope === ''
        ? { configuration: configuration.name, group: configuration.group, evidence: 'every repository' }
        : undefined;
}

function findFilenameEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    const matches = buildFilenameMatcher(detect.filenames);
    const file = contents.files.find((entry) => matches(entry.path));
    return file === undefined ? undefined : { evidence: file.path };
}

// A project file names the project it marks, so use the file as evidence and its folder as a scope.
function findProjectEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    for (const pattern of detect.project_files) {
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
        const matches = buildPathMatcher([pattern]);
        const dependency = [...contents.dependencies].find(([name]) => matches(name));
        if (dependency !== undefined) return { evidence: `${dependency[0]} in ${dependency[1]}` };
    }
    return undefined;
}

function findShebangEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    const shebang = detect.shebangs.find((name) => contents.shebangs.has(name));
    return shebang === undefined ? undefined : { evidence: `${shebang} shebang` };
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
    const matcher = buildPathMatcher(detect.paths);
    const file = contents.files.find((entry) => matcher(entry.path));
    return file === undefined ? undefined : { evidence: file.path };
}

function findTagEvidence(detect: Configuration['detect'], contents: ScopeContents): DetectionEvidence | undefined {
    const file = contents.files.find((entry) => detect.tags.some((tag) => entry.tags.includes(tag)));
    return file === undefined ? undefined : { evidence: file.path };
}

const EVIDENCE_FINDERS = [
    findExtensionEvidence,
    findProjectEvidence,
    findFilenameEvidence,
    findDependencyEvidence,
    findShebangEvidence,
    findRuntimeEvidence,
    findTagEvidence,
    findPathEvidence,
];

/**
 * Propose configurations from the files and the dependencies, with the evidence for each.
 *
 * @param repository the inventory and parsed package declarations.
 * @param configurations every configuration manifest.
 * @param scope the folder, '' for the root.
 * @returns each matching configuration with its repository evidence.
 */
export function detectConfigurations(
    repository: Pick<Repository, 'root' | 'files' | 'dependencyFiles'>,
    configurations: Map<string, Configuration>,
    scope = '',
): ConfigurationEvidence[] {
    const { root, files, dependencyFiles } = repository;
    const toolOnlyPackages = listToolOnlyPackages(dependencyFiles, configurations.values());
    const contents = buildScopeContents(
        files.filter((file) => !toolOnlyPackages.has(file.path)),
        dependencyFiles.filter((dependencyFile) => !toolOnlyPackages.has(dependencyFile.path)),
        scope,
    );
    return configurations
        .values()
        .map((configuration) => findConfigurationEvidence(root, configuration, contents))
        .filter((evidence) => evidence !== undefined)
        .toArray();
}

/**
 * Select the conditions that the file and dependency evidence meets.
 *
 * @param conditions the detection rules of the manifests.
 * @param files the repository source inventory.
 * @param dependencyFiles the parsed dependency files.
 * @returns the conditions that match.
 */
export function detectConditions(
    conditions: Configuration['detect'][],
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
): Set<Configuration['detect']> {
    const contents = buildScopeContents(files, dependencyFiles, '');
    return new Set(
        conditions.filter(
            (condition) =>
                !condition.absent_dependencies.some((name) => contents.dependencies.has(name)) &&
                EVIDENCE_FINDERS.some((source) => source(condition, contents) !== undefined),
        ),
    );
}
