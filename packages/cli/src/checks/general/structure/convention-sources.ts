import { Query, type Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import type { SourceInput } from '#cli/types/parsers/tree-sitter.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { CountedLanguage, ConventionSource } from '#cli/types/checks/general.ts';
import { CONVENTION_QUERIES, LANGUAGE_BY_EXTENSION } from '#cli/config/checks/general/structure.ts';

// Keep the selected source files, including shell scripts without extensions.
function detectLanguage(file: TrackedFile): CountedLanguage | undefined {
    for (const [extension, language] of Object.entries(LANGUAGE_BY_EXTENSION))
        if (file.path.endsWith(extension)) return language;
    return file.tags.includes('shell') ? 'bash' : undefined;
}

// Each grammar's query supplies both readers with the same captures.
function captureSource(source: ConventionSource): void {
    const query = new Query(source.tree.language, CONVENTION_QUERIES[source.language]);
    try {
        for (const { name, node } of query.captures(source.tree.rootNode)) {
            const nodes = source.captures.get(name) ?? [];
            nodes.push(node);
            source.captures.set(name, nodes);
        }
    } finally {
        query.delete();
    }
}

/**
 * Read convention captures for selected Bash, Python, and Swift sources.
 * @param input the scope-owned inventory and source reads.
 * @returns observations whose syntax trees stay available until their readers finish.
 */
async function readConventionSources(
    input: Omit<SourceInput, 'files'> & Pick<CheckInput, 'files' | 'scope'>,
): Promise<ConventionSource[]> {
    const sources: ConventionSource[] = [];
    try {
        for (const file of input.files.filter((entry) => entry.kind === 'source' && !isInGspotFolder(entry.path))) {
            const language = detectLanguage(file);
            if (language === undefined || !input.scope.view.configurations.includes(language)) continue;
            const tree = await parseSource(language, readCachedBytes(input.reads, file.path).toString('utf8'), input);
            const source = { path: file.path, language, tree, captures: new Map<string, Node[]>() };
            sources.push(source);
            captureSource(source);
        }
        return sources;
    } catch (error) {
        releaseConventionSources(sources);
        throw error;
    }
}

/**
 * Release syntax trees after all convention readers have finished.
 * @param sources the shared parsed observations.
 */
function releaseConventionSources(sources: ConventionSource[]): void {
    for (const source of sources) source.tree.delete();
}

/** One identity shares parsed conventions across their checks. */
export const CONVENTION_SOURCES = { read: readConventionSources, dispose: releaseConventionSources };
