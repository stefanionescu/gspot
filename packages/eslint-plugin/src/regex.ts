import { readAssignedValue } from './modules.ts';
import { REGEXP_CONSTRUCTOR } from './config/regex.ts';
import { GLOBAL_THIS_NAME } from './config/builtins.ts';
import { type AST, parseRegExpLiteral } from '@eslint-community/regexpp';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readStaticString(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): string | undefined {
    if (node === undefined || node.type === AST_NODE_TYPES.SpreadElement) return undefined;
    const value = ASTUtils.getStaticValue(node, source.getScope(node))?.value;
    return typeof value === 'string' ? value : undefined;
}

function isRegExpCallee(callee: TSESTree.Expression): boolean {
    if (ASTUtils.isIdentifier(callee)) return callee.name === REGEXP_CONSTRUCTOR;
    if (callee.type !== AST_NODE_TYPES.MemberExpression || ASTUtils.getPropertyName(callee) !== REGEXP_CONSTRUCTOR)
        return false;
    return ASTUtils.isIdentifier(callee.object) && callee.object.name === GLOBAL_THIS_NAME;
}

function readConstructorSource(
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    source: TSESLint.SourceCode,
): { pattern: string; flags: string } | undefined {
    if (!isRegExpCallee(node.callee)) return undefined;
    const [patternNode, flagsNode] = node.arguments;
    const pattern = readStaticString(patternNode, source);
    const flags = flagsNode === undefined ? '' : readStaticString(flagsNode, source);
    return pattern === undefined || flags === undefined ? undefined : { pattern, flags };
}

/**
Parse a regular expression literal, or a `RegExp` call whose pattern and flags the file spells out. A pattern that
does not compile returns nothing, because `no-invalid-regexp` reports it.

@param node the literal or call to read.
@param source the file that holds the node.
*/
export function readRegex(node: TSESTree.Node, source: TSESLint.SourceCode): AST.RegExpLiteral | undefined {
    let text: { pattern: string; flags: string } | undefined;
    if (node.type === AST_NODE_TYPES.Literal && 'regex' in node) text = node.regex;
    else if (node.type === AST_NODE_TYPES.NewExpression || node.type === AST_NODE_TYPES.CallExpression)
        text = readConstructorSource(node, source);
    if (text === undefined) return undefined;
    try {
        return parseRegExpLiteral(new RegExp(text.pattern, text.flags));
    } catch (error) {
        if (error instanceof SyntaxError) return undefined;
        throw error;
    }
}

/**
Build the visitors that hand each regular expression of a file to one check.

@param check the check that receives the node and its parsed expression.
@param source the file whose expressions the visitors read.
*/
export function buildRegexVisitors(
    check: (node: TSESTree.Node, regex: AST.RegExpLiteral) => void,
    source: TSESLint.SourceCode,
): TSESLint.RuleListener {
    const inspect = (node: TSESTree.Node) => {
        const regex = readRegex(node, source);
        if (regex !== undefined) check(node, regex);
    };
    return { 'Literal[regex]': inspect, NewExpression: inspect, CallExpression: inspect };
}

/**
Read the regular expression that a node holds, following a variable that gets one value.

@param node the expression or variable name to read.
@param source the file that holds the node.
*/
export function traceRegex(node: TSESTree.Node, source: TSESLint.SourceCode): AST.RegExpLiteral | undefined {
    if (!ASTUtils.isIdentifier(node)) return readRegex(node, source);
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    const value = variable === null ? undefined : readAssignedValue(variable);
    return value === undefined ? undefined : readRegex(value, source);
}
