import { type Node, Query } from 'web-tree-sitter';

import { SOURCE_QUERIES } from '#cli/config/configurations/structure.ts';
import { SCRIPT_TAG } from '#cli/config/parsers/code.ts';
import { findGrammarByExtension, visitParsedSources } from '#cli/parsers/code/grammars.ts';
import type { ParsedSource } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { ParsedLanguage } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

/**
Parse the source files that a Python, Swift, or Bash configuration of the scope reads, capture the nodes that the
structure query of their language names, and lend each source to a visitor.

@param visit reads one source; its syntax nodes must not leave this callback.
*/
export async function visitQueriedSources(
    session: Pick<Session, 'cache' | 'resources'>,
    planned: Pick<PlannedCheck, 'files' | 'scope'>,
    visit: (source: ParsedSource) => void,
): Promise<void> {
    const { configurations } = planned.scope.settings;
    const files = planned.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            path: file.path,
            grammar: findGrammarByExtension(file.path) ?? (file.tags.includes(SCRIPT_TAG) ? 'bash' : undefined),
        }))
        .filter(
            (file): file is { path: string; grammar: ParsedLanguage } =>
                file.grammar !== undefined &&
                Object.hasOwn(SOURCE_QUERIES, file.grammar) &&
                configurations.includes(file.grammar),
        );
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        const query = new Query(source.rootNode.tree.language, SOURCE_QUERIES[source.grammar]);
        try {
            const captures = new Map<string, Node[]>();
            for (const { name, node } of query.captures(source.rootNode)) {
                const nodes = captures.get(name) ?? [];
                nodes.push(node);
                captures.set(name, nodes);
            }
            visit({ path: source.path, language: source.grammar, rootNode: source.rootNode, captures });
        } finally {
            query.delete();
        }
    });
}
