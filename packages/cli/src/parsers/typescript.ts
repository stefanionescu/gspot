import ts from 'typescript';
import type { TypescriptImports } from '#cli/types/parsers/typescript.ts';

/**
 * Separate native import declarations from rendered JavaScript without reading strings or comments as syntax.
 * @param text the rendered fragment
 * @returns import statements with their comments, and the remaining fragment body
 */
export function typescriptImports(text: string): TypescriptImports {
    const source = ts.createSourceFile('fragment.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports: string[] = [];
    const body: string[] = [];
    let through = 0;
    for (const statement of source.statements.filter((statement) => ts.isImportDeclaration(statement))) {
        const start = Math.max(through, statement.getFullStart());
        let end = ts.getTrailingCommentRanges(text, statement.end)?.at(-1)?.end ?? statement.end;
        if (text[end] === '\r') end += 1;
        if (text[end] === '\n') end += 1;
        body.push(text.slice(through, start));
        imports.push(text.slice(start, end).trim());
        through = end;
    }
    body.push(text.slice(through));
    return { imports, body: body.join('') };
}

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
