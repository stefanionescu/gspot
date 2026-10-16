import { Query, type Node } from 'web-tree-sitter';
import { readSource } from '#cli/system/files/reads.ts';
import { visitParsed } from '#cli/system/files/cache.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { isInGspotFolder } from '#cli/repository/selectors.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { SourceInput } from '#cli/types/parsers/tree-sitter.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { CountedLanguage, ConventionSource } from '#cli/types/checks/general.ts';
import { CONVENTION_QUERIES, LANGUAGE_BY_EXTENSION } from '#cli/config/checks/general/structure.ts';

// Keep the selected source files, including shell scripts without extensions.
function sourceLanguage(file: TrackedFile): CountedLanguage | undefined {
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
    input: Omit<SourceInput, 'files'> & Pick<CheckInput, 'files' | 'selection'>,
): Promise<ConventionSource[]> {
    const sources: ConventionSource[] = [];
    try {
        for (const file of input.files.filter((entry) => entry.kind === 'source' && !isInGspotFolder(entry.path))) {
            const language = sourceLanguage(file);
            if (language === undefined || !input.selection.view.configurations.includes(language)) continue;
            const tree = await parseSource(
                language,
                readSource(input.root, file.path, input.reads).toString('utf8'),
                input,
            );
            const source = { path: file.path, language, tree, captures: new Map<string, Node[]>() };
            sources.push(source);
            captureSource(source);
        }
        return sources;
    } catch (error) {
        disposeConventionSources(sources);
        throw error;
    }
}

/**
 * Release syntax trees after all convention readers have finished.
 * @param sources the shared parsed observations.
 */
function disposeConventionSources(sources: ConventionSource[]): void {
    for (const source of sources) source.tree.delete();
}

/**
 * Share convention captures until both structure checks finish.
 * @param input the check context and syntax tree resources.
 * @returns the captured convention sources.
 */
export function conventionSources(input: CheckInput): Promise<ConventionSource[]> {
    return visitParsed(input, readConventionSources, disposeConventionSources, input.resources);
}
