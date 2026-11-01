import { createRule } from '../rule.ts';
import { readTypes } from '../checker.ts';
import type { TypeReader } from '../types/plugin.ts';
import { LIBRARY_PATH, UNDEFINED_TYPE } from '../config/builtins.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function hasWrittenUndefined(node: TSESTree.TypeNode): boolean {
    if (node.type === AST_NODE_TYPES.TSUndefinedKeyword) return true;
    return node.type === AST_NODE_TYPES.TSUnionType && node.types.some((member) => hasWrittenUndefined(member));
}

function isLocalDeclaration(node: TSESTree.TypeNode, types: TypeReader): boolean {
    const symbol = types.checker.getTypeAtLocation(types.map.get(node)).aliasSymbol;
    const files = (symbol?.declarations ?? []).map((declaration) => declaration.getSourceFile());
    return files.some((file) => !types.program.isSourceFileDefaultLibrary(file) && !LIBRARY_PATH.test(file.fileName));
}

function hasAliasedUndefined(node: TSESTree.TypeNode, types: TypeReader): boolean {
    const type = types.checker.getTypeAtLocation(types.map.get(node));
    const members = type.isUnion() ? type.types : [];
    const undefinedCount = members.filter((member) => types.checker.typeToString(member) === UNDEFINED_TYPE).length;
    return undefinedCount > 0 && undefinedCount < members.length && isLocalDeclaration(node, types);
}

export const noRedundantOptional = createRule<[], 'optional'>({
    name: 'no-redundant-optional',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports an optional property whose type also includes `undefined`, written in a union or, with type information, through a type alias declared in the project. It reports nothing when the project sets `exactOptionalPropertyTypes`, because there the two mean different things.',
            why: 'Without exactOptionalPropertyTypes, `?` already adds `undefined` to the type, so writing both says the same thing twice.',
            fix: 'Remove `?` when the property must be present, or remove `undefined` from the type.',
            example: '`type User = { name?: string | undefined };` reports `optional`. Write `name?: string`.',
        },
        schema: [],
        messages: { optional: 'This property is optional and also allows undefined. Remove one of the two.' },
    },
    create(context) {
        const types = readTypes(context);
        if (types?.program.getCompilerOptions().exactOptionalPropertyTypes === true) return {};
        const inspect = (node: TSESTree.PropertyDefinition | TSESTree.TSPropertySignature) => {
            const type = node.typeAnnotation?.typeAnnotation;
            if (!node.optional || type === undefined) return;
            const isWritten = type.type === AST_NODE_TYPES.TSUnionType && hasWrittenUndefined(type);
            if (!isWritten && (types === undefined || !hasAliasedUndefined(type, types))) return;
            context.report({ node: node.key, messageId: 'optional' });
        };
        return { PropertyDefinition: inspect, TSPropertySignature: inspect };
    },
});
