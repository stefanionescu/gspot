import { Query, type Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/grammars.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { CountedLanguage, ConventionSource } from '#cli/types/checks/structure.ts';
import { CONVENTION_QUERIES, LANGUAGE_BY_EXTENSION } from '#cli/config/checks/structure.ts';

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
 * Parses Bash, Python, and Swift sources and collects their convention captures.
 *
 * @param session the repository reads and parse resources.
 * @param planned the scope files to parse.
 * @returns the convention sources, with live syntax trees.
 */
async function readConventionSources(
    session: Pick<Session, 'root' | 'reads' | 'resources'>,
    planned: Pick<PlannedCheck, 'files' | 'selection'>,
): Promise<ConventionSource[]> {
    const sources: ConventionSource[] = [];
    try {
        for (const file of planned.files.filter((entry) => entry.kind === 'source')) {
            const language = detectLanguage(file);
            if (language === undefined || !planned.selection.view.configurations.includes(language)) continue;
            const tree = await parseSource(language, readCachedText(session.reads, file.path), session);
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
 * Frees the syntax trees after every convention check finishes.
 *
 * @param sources the parsed files to free.
 */
function releaseConventionSources(sources: ConventionSource[]): void {
    for (const source of sources) source.tree.delete();
}

/** Lets every convention check share one parse of each file. */
export const CONVENTION_SOURCES = {
    read: ({
        root,
        reads,
        resources,
        files,
        selection,
    }: Pick<Session, 'root' | 'reads' | 'resources'> & Pick<PlannedCheck, 'files' | 'selection'>): Promise<
        ConventionSource[]
    > => readConventionSources({ root, reads, resources }, { files, selection }),
    dispose: releaseConventionSources,
};
