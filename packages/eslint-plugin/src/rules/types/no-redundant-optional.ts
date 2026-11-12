import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import { UNDEFINED_NAME } from '../../config/plugin.ts';
import { LIBRARY_PATH } from '../../config/types.ts';
import { getTypes } from '../../language/checker.ts';
import { createRule } from '../../rule.ts';
import type { TypeReader } from '../../types/plugin.ts';

function hasWrittenUndefined(node: TSESTree.TypeNode): boolean {
    if (node.type === AST_NODE_TYPES.TSUndefinedKeyword) return true;
    return node.type === AST_NODE_TYPES.TSUnionType && node.types.some((member) => hasWrittenUndefined(member));
}

function isLocalDeclaration(node: TSESTree.TypeNode, types: TypeReader): boolean {
    const symbol = types.get(node).aliasSymbol;
    const files = (symbol?.declarations ?? []).map((declaration) => declaration.getSourceFile());
    return files.some((file) => !types.program.isSourceFileDefaultLibrary(file) && !LIBRARY_PATH.test(file.fileName));
}

function hasAliasedUndefined(node: TSESTree.TypeNode, types: TypeReader): boolean {
    const type = types.get(node);
    const members = type.isUnion() ? type.types : [];
    const undefinedCount = members.filter((member) => types.checker.typeToString(member) === UNDEFINED_NAME).length;
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
                'Reports an optional property whose type also includes `undefined`, written in a union or, with type information, through a type alias, unless the project sets `exactOptionalPropertyTypes`.',
            why: 'Without exactOptionalPropertyTypes, `?` already adds `undefined` to the type, so writing both says the same thing twice.',
            fix: 'Remove `?` when the property must be present, or remove `undefined` from the type.',
            example: '`type User = { name?: string | undefined };` reports `optional`. Write `name?: string`.',
        },
        schema: [],
        messages: { optional: 'This property is optional and also allows undefined. Remove one of the two.' },
    },
    create(context) {
        const types = getTypes(context);
        if (types?.program.getCompilerOptions().exactOptionalPropertyTypes === true) return {};
        const inspect = (node: TSESTree.PropertyDefinition | TSESTree.TSPropertySignature) => {
            const type = node.typeAnnotation?.typeAnnotation;
            if (type === undefined || !node.optional) return;
            const isWritten = type.type === AST_NODE_TYPES.TSUnionType && hasWrittenUndefined(type);
            if (!isWritten && (types === undefined || !hasAliasedUndefined(type, types))) return;
            context.report({ node: node.key, messageId: 'optional' });
        };
        return { PropertyDefinition: inspect, TSPropertySignature: inspect };
    },
});
