import { createRule } from '../rule.ts';
import { isCallOf } from '../testing.ts';
import { getModuleName } from '../modules.ts';
import { unwrapExpression } from '../syntax.ts';
import type { TypeReader } from '../types/plugin.ts';
import { getExpressionValue } from '../expressions.ts';
import { getTypes, getTypeCategory } from '../checker.ts';
import type { LibraryCall, NativeReplacement } from '../types/rules.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    PATTERN_TEXT,
    LIBRARY_NAMES,
    SEARCH_METHODS,
    STRING_INCLUDES,
    CALLBACK_METHODS,
    NATIVE_REPLACEMENTS,
    SHORTHAND_ITERATEES,
} from '../config/lodash.ts';

const methodNames = new Map([...NATIVE_REPLACEMENTS.keys()].map((method) => [method.toLowerCase(), method]));

function isDirectMember(callee: TSESTree.Node): boolean {
    const member = callee.type === AST_NODE_TYPES.MemberExpression ? callee : undefined;
    const isChained = member?.object.type === AST_NODE_TYPES.CallExpression && !isCallOf(member.object, 'require');
    return member === undefined || (!member.computed && !isChained);
}

function getLibraryCall(node: TSESTree.CallExpression, source: TSESLint.SourceCode): LibraryCall | undefined {
    const name = (getModuleName(node.callee, source) ?? '').replaceAll('/', '.');
    const separator = name.indexOf('.');
    const library = LIBRARY_NAMES.get(name.slice(0, separator));
    const method = methodNames.get(name.slice(separator + 1).toLowerCase());
    const isDirect = method !== undefined && library !== undefined && isDirectMember(node.callee);
    return isDirect ? { method, library } : undefined;
}

function getSyntaxShape(node: TSESTree.Node): string | undefined {
    const value = unwrapExpression(node);
    const isText =
        value.type === AST_NODE_TYPES.TemplateLiteral ||
        (value.type === AST_NODE_TYPES.Literal && typeof value.value === 'string');
    if (isText) return 'string';
    return value.type === AST_NODE_TYPES.ArrayExpression ? 'array' : undefined;
}

function getTypeShape(node: TSESTree.Node, types: TypeReader | undefined): string | undefined {
    const type = types?.get(node);
    const members = type?.isUnion() === true ? type.types : [type];
    const shapes = members.flatMap((member) => {
        if (member === undefined || types === undefined) return [];
        const shape = types.checker.isTupleType(member) ? 'array' : getTypeCategory(types, member);
        return shape === 'array' || shape === 'string' ? [shape] : [];
    });
    return new Set(shapes).size === 1 ? shapes[0] : undefined;
}

function hasCallback(argument: TSESTree.CallExpressionArgument | undefined, source: TSESLint.SourceCode): boolean {
    const value = getExpressionValue(argument, source) ?? argument;
    const isShorthand = value !== undefined && SHORTHAND_ITERATEES.has(value.type);
    return value !== undefined && value.type !== AST_NODE_TYPES.SpreadElement && !isShorthand;
}

function isPatternSearch(argument: TSESTree.CallExpressionArgument | undefined, source: TSESLint.SourceCode): boolean {
    const value = getExpressionValue(argument, source) ?? argument;
    const text = value === undefined ? '' : source.getText(value);
    return value?.type === AST_NODE_TYPES.SpreadElement || PATTERN_TEXT.test(text);
}

function getCollectionShape(
    collection: TSESTree.CallExpressionArgument | undefined,
    types: TypeReader | undefined,
): string | undefined {
    const isSpread = collection === undefined || collection.type === AST_NODE_TYPES.SpreadElement;
    const shape = isSpread ? undefined : getSyntaxShape(collection);
    return isSpread ? undefined : (shape ?? getTypeShape(collection, types));
}

function getShapedReplacement(
    method: string,
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
    types: TypeReader | undefined,
): NativeReplacement | undefined {
    const [collection, argument] = node.arguments;
    const shape = getCollectionShape(collection, types);
    const isSearch = SEARCH_METHODS.has(method);
    if (!isSearch && !hasCallback(argument, source)) return undefined;
    if (shape === 'array') return NATIVE_REPLACEMENTS.get(method);
    return shape === 'string' && isSearch && !isPatternSearch(argument, source) ? STRING_INCLUDES : undefined;
}

function getMessageId(replacement: NativeReplacement): 'direct' | 'cautious' | 'example' {
    const isCautious = replacement.reason !== undefined;
    if (!isCautious) return 'direct';
    return replacement.example === undefined ? 'cautious' : 'example';
}

export const preferNativeLodash = createRule<[], 'direct' | 'cautious' | 'example'>({
    name: 'prefer-native-lodash',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a call of a method of lodash, lodash-es, or Underscore.js that the language provides, such as `isArray`, `keys`, or `uniq`, when the configured ECMAScript version has it. For a method that also accepts objects, such as `map` or `filter`, it reports only a call whose collection is an array or a string, in the source or by the type information of a TypeScript project, with a function as its callback.',
            why: 'A native method needs no dependency, and every reader knows it.',
            fix: 'Call the native method. Check nullish values first, because the library accepts them.',
            example: '`_.isArray(value)` reports `direct`. Write `Array.isArray(value)`.',
        },
        schema: [],
        messages: {
            direct: 'Use {{alternative}} instead of {{method}}() from {{library}}.',
            cautious:
                'Consider {{alternative}} instead of {{method}}() from {{library}}; check that the behavior matches, because {{reason}}.',
            example:
                'Consider {{alternative}} instead of {{method}}() from {{library}}, such as {{example}}. Check that the behavior matches, because {{reason}}.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        const year = context.languageOptions.ecmaVersion as number;
        return {
            CallExpression(node) {
                const call = getLibraryCall(node, source);
                if (call === undefined) return;
                const { method } = call;
                const isShaped = SEARCH_METHODS.has(method) || CALLBACK_METHODS.has(method);
                const replacement = isShaped
                    ? getShapedReplacement(method, node, source, types)
                    : NATIVE_REPLACEMENTS.get(method);
                if (replacement === undefined || year < replacement.year) return;
                const report =
                    node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
                context.report({
                    node: report,
                    messageId: getMessageId(replacement),
                    data: { ...replacement, ...call },
                });
            },
        };
    },
});
