import { Query, type Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/session.ts';
import { parseSource } from '#cli/parsers/grammars.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { ParsedSource, ParsedLanguage } from '#cli/types/checks/structure.ts';
import { SOURCE_QUERIES, LANGUAGE_BY_EXTENSION } from '#cli/config/checks/structure.ts';

function detectLanguage(file: TrackedFile): ParsedLanguage | undefined {
    for (const [extension, language] of Object.entries(LANGUAGE_BY_EXTENSION))
        if (file.path.endsWith(extension)) return language;
    return file.tags.includes('shell') ? 'bash' : undefined;
}

// Each grammar's query supplies both readers with the same captures.
function captureSource(source: ParsedSource): void {
    const query = new Query(source.tree.language, SOURCE_QUERIES[source.language]);
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
async function readParsedSources(
    session: Pick<Session, 'root' | 'reads' | 'resources'>,
    planned: Pick<PlannedCheck, 'files' | 'scope'>,
): Promise<ParsedSource[]> {
    const sources: ParsedSource[] = [];
    try {
        for (const file of planned.files.filter((entry) => entry.kind === 'source')) {
            const language = detectLanguage(file);
            if (language === undefined || !planned.scope.settings.configurations.includes(language)) continue;
            const tree = await parseSource(language, readCachedText(session.reads, file.path), session);
            const source = { path: file.path, language, tree, captures: new Map<string, Node[]>() };
            sources.push(source);
            captureSource(source);
        }
        return sources;
    } catch (error) {
        releaseParsedSources(sources);
        throw error;
    }
}

/**
 * Frees the syntax trees after every convention check finishes.
 *
 * @param sources the parsed files to free.
 */
function releaseParsedSources(sources: ParsedSource[]): void {
    for (const source of sources) source.tree.delete();
}

/** Lets every convention check share one parse of each file. */
export const PARSED_SOURCES = {
    read: ({
        root,
        reads,
        resources,
        files,
        scope,
    }: Pick<Session, 'root' | 'reads' | 'resources'> & Pick<PlannedCheck, 'files' | 'scope'>): Promise<
        ParsedSource[]
    > => readParsedSources({ root, reads, resources }, { files, scope }),
    dispose: releaseParsedSources,
};
