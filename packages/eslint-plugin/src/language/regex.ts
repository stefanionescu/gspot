import { getExpressionValue } from './expressions.ts';
import { REGEXP_CONSTRUCTOR } from '../config/regex.ts';
import { type AST, parseRegExpLiteral } from '@eslint-community/regexpp';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getStaticString(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): string | undefined {
    const evaluated = node && ASTUtils.getStaticValue(node, source.getScope(node));
    if (typeof evaluated?.value !== 'string') return undefined;
    return evaluated.value;
}

function getConstructorSource(
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    source: TSESLint.SourceCode,
): { pattern: string; flags: string } | undefined {
    if (!ASTUtils.isIdentifier(node.callee) || node.callee.name !== REGEXP_CONSTRUCTOR) return undefined;
    const [patternNode, flagsNode] = node.arguments;
    const pattern = getStaticString(patternNode, source);
    const flags = flagsNode === undefined ? '' : getStaticString(flagsNode, source);
    return pattern === undefined || flags === undefined ? undefined : { pattern, flags };
}

/**
Parse a regular expression literal, or a `RegExp` call whose pattern and flags the file spells out. A pattern that
does not compile returns nothing, because `no-invalid-regexp` reports it.

@param node the literal or call to read.
@param source the file that holds the node.
*/
export function getRegex(node: TSESTree.Node, source: TSESLint.SourceCode): AST.RegExpLiteral | undefined {
    let text: { pattern: string; flags: string } | undefined;
    if (node.type === AST_NODE_TYPES.Literal && 'regex' in node) text = node.regex;
    else if (node.type === AST_NODE_TYPES.NewExpression || node.type === AST_NODE_TYPES.CallExpression)
        text = getConstructorSource(node, source);
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
        const regex = getRegex(node, source);
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
    const value = getExpressionValue(node, source);
    if (value === undefined) return undefined;
    return getRegex(value, source);
}
