// Python modules parsed from text, for the analyses that read them without a repository.
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import type { PythonModule } from '#cli/types/checks/language/python.ts';

/**
 * Parses Python sources into the modules the analyses read; the caller deletes the trees when done.
 * @param sources the module text by path
 * @returns the modules, in the order given
 */
export async function pythonModulesOf(sources: Record<string, string>): Promise<PythonModule[]> {
    const parser = await parserFor('python');
    return Object.entries(sources).map(([path, text]) => {
        const tree = parser.parse(text);
        if (tree === null) throw new Error(`The Python parser returned no tree for ${path}.`);
        const statements = tree.rootNode.namedChildren
            .filter((child) => child.type !== 'comment')
            .map((node) =>
                node.type === 'decorated_definition' ? (node.childForFieldName('definition') ?? node) : node,
            );
        return { path, lines: text.split('\n'), tree, statements };
    });
}

/**
 * Frees the parse trees of the modules.
 * @param modules the modules to free
 */
export function freeModules(modules: PythonModule[]): void {
    for (const module of modules) module.tree.delete();
}
