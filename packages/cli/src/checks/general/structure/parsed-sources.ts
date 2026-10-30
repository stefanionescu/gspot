import { Query, type Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/session.ts';
import { remember } from '#cli/system/files/cache.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files/classify.ts';
import type { ParsedSource, ParsedLanguage } from '#cli/types/checks/general/structure.ts';
import { SOURCE_QUERIES, LANGUAGE_BY_EXTENSION } from '#cli/config/checks/general/structure/parsed-sources.ts';

function detectLanguage(file: TrackedFile): ParsedLanguage | undefined {
    for (const [extension, language] of Object.entries(LANGUAGE_BY_EXTENSION))
        if (file.path.endsWith(extension)) return language;
    return file.tags.includes(SCRIPT_TAG) ? 'bash' : undefined;
}

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

const PARSED_SOURCES = Symbol('parsed sources');

/**
Parse the scope sources once for each list of paths, and free their trees with the run.

@param session the run cache and resources.
@param planned the scope files and the configurations that select their languages.
@returns the trees and their query captures.
*/
export function readParsedSources(
    session: Pick<Session, 'reads' | 'resources'>,
    planned: Pick<PlannedCheck, 'files' | 'scope'>,
): Promise<ParsedSource[]> {
    return remember(session.reads, PARSED_SOURCES, JSON.stringify(planned.files.map((file) => file.path)), async () => {
        const sources: ParsedSource[] = [];
        for (const file of planned.files) {
            if (file.kind !== 'source') continue;
            const language = detectLanguage(file);
            if (language === undefined || !planned.scope.settings.configurations.includes(language)) continue;
            const tree = await parseSource(language, readCachedText(session.reads, file.path), session);
            session.resources.defer(() => {
                tree.delete();
            });
            const source = { path: file.path, language, tree, captures: new Map<string, Node[]>() };
            sources.push(source);
            captureSource(source);
        }
        return sources;
    });
}
