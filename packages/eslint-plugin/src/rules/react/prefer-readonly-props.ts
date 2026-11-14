import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import { getAssignedValue } from '../../language/variables.ts';
import { listReturnedValues } from '../../language/functions.ts';
import type { TypeReader, CheckedType } from '../../types/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    JSX_NODE_PREFIX,
    READONLY_MAPPED,
    READONLY_MEMBER,
    READONLY_UTILITY,
    COMPONENT_DECLARATION,
} from '../../config/react.ts';

function traceReturnedValue(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node {
    const variable =
        node.type === AST_NODE_TYPES.Identifier ? ASTUtils.findVariable(source.getScope(node), node) : null;
    const value = variable === null ? undefined : getAssignedValue(variable);
    return value ?? node;
}

function isMarkedReadonly(type: CheckedType): boolean {
    const declaration = type.getSymbol()?.declarations?.at(0);
    const isMapped = READONLY_MAPPED.test(declaration?.getText() ?? '');
    return isMapped || type.aliasSymbol?.name === READONLY_UTILITY;
}

function isReadonlyType(type: CheckedType, types: TypeReader): boolean {
    const isValue = types.checker.getApparentType(type) !== type || type.isUnionOrIntersection();
    if (isValue || isMarkedReadonly(type)) return true;
    return type.getProperties().every((property) => {
        const members = property.declarations ?? [];
        return members.length > 0 && members.every((member) => READONLY_MEMBER.test(member.getText()));
    });
}

export const preferReadonlyProps = createRule<[], 'mutable' | 'mark'>({
    name: 'prefer-readonly-props',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        hasSuggestions: true,
        docs: {
            level: 'all',
            requiresTypeChecking: true,
            description:
                'Reports the typed props of a React function component whose properties are not all read-only.',
            why: 'React treats props as immutable. A read-only type lets the compiler reject a write to them.',
            fix: 'Wrap the type in `Readonly`, or mark each property `readonly`.',
            example:
                '`function Badge(props: { label: string }) { return <b>{props.label}</b>; }` reports `mutable`. Write `props: Readonly<{ label: string }>`.',
        },
        schema: [],
        messages: {
            mutable: 'Mark the props of this component as read-only.',
            mark: 'Wrap the props type in `Readonly`.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            [COMPONENT_DECLARATION](node: TSESTree.FunctionDeclaration) {
                const [props] = node.params;
                const annotation =
                    props !== undefined && 'typeAnnotation' in props ? props.typeAnnotation?.typeAnnotation : undefined;
                const hasMarkupReturn = listReturnedValues(node, source).some((value) =>
                    traceReturnedValue(value, source).type.startsWith(JSX_NODE_PREFIX),
                );
                if (
                    props === undefined ||
                    annotation === undefined ||
                    !hasMarkupReturn ||
                    isReadonlyType(types.get(props), types)
                )
                    return;
                context.report({
                    node: props,
                    messageId: 'mutable',
                    suggest: [
                        {
                            messageId: 'mark',
                            fix: (fixer) => fixer.replaceText(annotation, `Readonly<${source.getText(annotation)}>`),
                        },
                    ],
                });
            },
        };
    },
});
