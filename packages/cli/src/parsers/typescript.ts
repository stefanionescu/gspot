// Reads TypeScript imports and source declarations.
import ts from 'typescript';
import type { EnvironmentRead } from '#cli/types/parsers/environment.ts';

import {
    ENV_NAME,
    JAVASCRIPT_ENVIRONMENT_FIELDS,
    JAVASCRIPT_ENVIRONMENT_GETTERS,
} from '#cli/config/parsers/environment.ts';

/**
 * Walk the parsed TypeScript syntax once, visiting declarations and expressions without comment or string contents.
 * @param syntaxRoot the source or subtree to inspect.
 * @returns nodes in source traversal order, including the root.
 */
function listTypescriptNodes(syntaxRoot: ts.Node): ts.Node[] {
    const nodes: ts.Node[] = [];
    const visit = (node: ts.Node): void => {
        nodes.push(node);
        ts.forEachChild(node, visit);
    };
    visit(syntaxRoot);
    return nodes;
}

function readGetterKey(node: ts.CallExpression, source: ts.SourceFile, getters: Set<string>): string | undefined {
    if (!getters.has(node.expression.getText(source).replaceAll(/\s+/gu, ''))) return undefined;
    const argument = node.arguments[0];
    return argument !== undefined && ts.isStringLiteralLike(argument) ? argument.text : undefined;
}

function readEnvironmentKey(node: ts.Node, source: ts.SourceFile, getters: Set<string>): string | undefined {
    if (ts.isCallExpression(node)) return readGetterKey(node, source, getters);
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return undefined;
    if (!JAVASCRIPT_ENVIRONMENT_FIELDS.has(node.expression.getText(source).replaceAll(/\s+/gu, ''))) return undefined;
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;
}

/**
 * Read environment members and calls to the environment functions in JavaScript or TypeScript.
 * @param file the original source path.
 * @param text the JavaScript or TypeScript source.
 * @param readers the environment functions.
 * @returns the environment reads and their source positions.
 */
function readJavascriptEnvironment(file: string, text: string, readers: readonly string[]): EnvironmentRead[] {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const getters = new Set([...JAVASCRIPT_ENVIRONMENT_GETTERS, ...readers]);
    return listTypescriptNodes(source).flatMap((node) => {
        const key = readEnvironmentKey(node, source, getters);
        if (key === undefined || !ENV_NAME.test(key)) return [];
        const at = source.getLineAndCharacterOfPosition(node.getStart(source));
        return [{ key, line: at.line + 1, column: at.character + 1 }];
    });
}

export { listTypescriptNodes, readJavascriptEnvironment };
