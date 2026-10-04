import ts from 'typescript';

/**
 * Walk the parsed TypeScript syntax once, visiting declarations and expressions without comment or string contents.
 * @param root the source or subtree to inspect
 * @returns nodes in source traversal order, including the root
 */
export function typescriptNodes(root: ts.Node): ts.Node[] {
    const nodes: ts.Node[] = [];
    const visit = (node: ts.Node): void => {
        nodes.push(node);
        ts.forEachChild(node, visit);
    };
    visit(root);
    return nodes;
}
