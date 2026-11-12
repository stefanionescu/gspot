import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    CALLBACK_METHODS,
    LIBRARY_NAMES,
    NATIVE_REPLACEMENTS,
    PATTERN_TEXT,
    SEARCH_METHODS,
    SHORTHAND_ITERATEES,
    STRING_INCLUDES,
} from '../../config/utilities.ts';
import { getTypeCategory, getTypes } from '../../language/checker.ts';
import { getExpressionValue } from '../../language/expressions.ts';
import { getModuleName } from '../../language/modules.ts';
import { isCallOf, unwrapExpression } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';
import type { TypeReader } from '../../types/plugin.ts';
import type { LibraryCall, NativeMessageId, NativeReplacement } from '../../types/utilities.ts';

const methodNames = new Map(NATIVE_REPLACEMENTS.keys().map((method) => [method.toLowerCase(), method]));

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

function getMessageId(replacement: NativeReplacement): NativeMessageId {
    const isCautious = replacement.reason !== undefined;
    if (!isCautious) return 'direct';
    return replacement.example === undefined ? 'cautious' : 'example';
}

function findNativeReplacement(
    node: TSESTree.CallExpression,
    { source, types, year }: { source: TSESLint.SourceCode; types: TypeReader | undefined; year: number },
): TSESLint.ReportDescriptor<NativeMessageId> | undefined {
    const call = getLibraryCall(node, source);
    if (call === undefined) return undefined;
    const { method } = call;
    const isShaped = SEARCH_METHODS.has(method) || CALLBACK_METHODS.has(method);
    const replacement = isShaped ? getShapedReplacement(method, node, source, types) : NATIVE_REPLACEMENTS.get(method);
    if (replacement === undefined || year < replacement.year) return undefined;
    const report = node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
    return { node: report, messageId: getMessageId(replacement), data: { ...replacement, ...call } };
}

export const preferNativeLodash = createRule<[], NativeMessageId>({
    name: 'prefer-native-lodash',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a call of a lodash, lodash-es, or Underscore.js method that the configured ECMAScript version provides, such as `isArray` or `uniq`, and of `map` or `filter` on a value that the source or its types show is an array.',
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
        const file = {
            source: context.sourceCode,
            types: getTypes(context),
            year: context.languageOptions.ecmaVersion as number,
        };
        return {
            CallExpression(node) {
                const replacement = findNativeReplacement(node, file);
                if (replacement === undefined) return;
                context.report(replacement);
            },
        };
    },
});
