import ts from 'typescript';

/**
 * Walk the parsed TypeScript syntax once, visiting declarations and expressions without comment or string contents.
 *
 * @param syntaxRoot the source or subtree to inspect.
 * @returns nodes in source traversal order, including the root.
 */
export function listTypescriptNodes(syntaxRoot: ts.Node): ts.Node[] {
    const nodes: ts.Node[] = [];
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: It calls itself for each child node.
    const visit = (node: ts.Node): void => {
        nodes.push(node);
        ts.forEachChild(node, visit);
    };
    visit(syntaxRoot);
    return nodes;
}
