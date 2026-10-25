import { Query, type Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/session.ts';
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

async function readParsedSources(
    input: Pick<Session, 'root' | 'reads' | 'resources'> & Pick<PlannedCheck, 'files' | 'scope'>,
): Promise<ParsedSource[]> {
    const sources: ParsedSource[] = [];
    try {
        for (const file of input.files) {
            if (file.kind !== 'source') continue;
            const language = detectLanguage(file);
            if (language === undefined || !input.scope.settings.configurations.includes(language)) continue;
            const tree = await parseSource(language, readCachedText(input.reads, file.path), input);
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

function releaseParsedSources(sources: ParsedSource[]): void {
    for (const source of sources) source.tree.delete();
}

export const PARSED_SOURCES = { read: readParsedSources, dispose: releaseParsedSources };
