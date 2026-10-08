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

/**
 * Bind selected syntax without reading dependencies or native library files.
 * @param sources the already captured source files by path
 * @returns the native program with lexical symbols for those sources
 */
export function typescriptProgram(sources: Map<string, ts.SourceFile>): ts.Program {
    const options: ts.CompilerOptions = { noLib: true, noResolve: true, allowJs: true };
    const host: ts.CompilerHost = {
        getSourceFile: (path) => sources.get(path),
        getDefaultLibFileName: () => '',
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        fileExists: (path) => sources.has(path),
        readFile: (path) => sources.get(path)?.text,
        getCanonicalFileName: (path) => path,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
    };
    return ts.createProgram([...sources.keys()], options, host);
}
