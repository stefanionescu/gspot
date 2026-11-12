import { type AST, parseRegExpLiteral } from '@eslint-community/regexpp';
import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { REGEXP_CONSTRUCTOR } from '../config/regex.ts';
import { getStaticString } from './expressions.ts';

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
