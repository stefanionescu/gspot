import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import { EMPTY_TYPE_NAMES } from '../../config/types.ts';
import type { FunctionNode } from '../../types/rules.ts';
import type { TypeReader, CheckedType, CheckedSignature } from '../../types/plugin.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    ANY_TYPE,
    TRUE_TYPE,
    RETURN_DOC_TAGS,
    BOXED_STRING_NAME,
    FUNCTION_TYPE_TEXT,
    SANITATION_MEMBERS,
    UNKNOWN_TYPE_NAMES,
} from '../../config/checker.ts';

function getTypeLabel(returned: CheckedType, types: TypeReader): string {
    const { checker } = types;
    const type = checker.getBaseConstraintOfType(returned) ?? returned;
    const text = checker.typeToString(type);
    if (type.isUnion()) return text;
    if (checker.isArrayLikeType(type)) return 'array';
    if (FUNCTION_TYPE_TEXT.test(text)) return 'function';
    const isNonPrimitive =
        !type.isTypeParameter() &&
        !UNKNOWN_TYPE_NAMES.has(text) &&
        checker.isTypeAssignableTo(type, checker.getNonPrimitiveType());
    return isNonPrimitive ? 'object' : checker.typeToString(checker.getBaseTypeOfLiteralType(type));
}

function hasMixedReturnType(signature: CheckedSignature, returned: CheckedType, types: TypeReader): boolean {
    const { checker } = types;
    const widened = checker.getBaseTypeOfLiteralType(returned);
    const members = widened.isUnion() ? widened.types : [];
    const filled = members.filter((member) => !EMPTY_TYPE_NAMES.has(checker.typeToString(member)));
    const labels = new Set(filled.map((member) => getTypeLabel(member, types)));
    const isDocumented = signature.getJsDocTags().some(({ name }) => RETURN_DOC_TAGS.has(name));
    return labels.size > 1 && !isDocumented;
}

function isSanitation(returned: CheckedType, { checker }: TypeReader): boolean {
    const members = returned.isUnionOrIntersection() ? returned.types : [];
    const hasString = members.some(
        (member) =>
            (!member.isIntersection() && checker.isTypeAssignableTo(member, checker.getStringType())) ||
            member.getSymbol()?.name === BOXED_STRING_NAME,
    );
    const hasTrue = members.some((member) => checker.typeToString(member) === TRUE_TYPE);
    return members.length === SANITATION_MEMBERS && hasString && hasTrue;
}

function isMixedFunction(node: FunctionNode, values: readonly TSESTree.Expression[], types: TypeReader): boolean {
    if (values.some(({ type }) => type === AST_NODE_TYPES.ThisExpression)) return false;
    const signature = types.checker.getSignatureFromDeclaration(types.map.get(node));
    if (signature === undefined) return false;
    const resultType = types.checker.getReturnTypeOfSignature(signature);
    const returned = (node.async ? types.checker.getAwaitedType(resultType) : resultType) ?? resultType;
    if (!hasMixedReturnType(signature, returned, types) || isSanitation(returned, types)) return false;
    const labels = values.flatMap((value) => {
        const type = types.get(value);
        const text = types.checker.typeToString(type);
        return EMPTY_TYPE_NAMES.has(text) || text === ANY_TYPE ? [] : [getTypeLabel(type, types)];
    });
    return new Set(labels).size > 1;
}

function getNamedLocation(node: FunctionNode): TSESTree.SourceLocation | undefined {
    const { parent } = node;
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return node.id?.loc;
    const isMember = parent.type === AST_NODE_TYPES.MethodDefinition || parent.type === AST_NODE_TYPES.Property;
    return node.type === AST_NODE_TYPES.FunctionExpression && isMember ? parent.key.loc : undefined;
}

function getFunctionLocation(node: FunctionNode, source: TSESLint.SourceCode): TSESTree.SourceLocation {
    const token =
        node.type === AST_NODE_TYPES.ArrowFunctionExpression
            ? source.getTokenBefore(node.body, { filter: ({ value }) => value === '=>' })
            : source.getFirstToken(node, { filter: ({ value }) => value === 'function' });
    return getNamedLocation(node) ?? token?.loc ?? node.loc;
}

export const noMixedReturnTypes = createRule<[], 'mixed'>({
    name: 'no-mixed-return-types',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a function whose `return` statements return values of different kinds, such as a string in one branch and a number or an object in another, when its inferred return type is a union of those kinds. `null`, `undefined`, `any`, and a returned `this` do not count, and neither does a documented `@returns` tag or a `string | true` result. The rule needs type information.',
            why: 'A caller of a function that returns different kinds of values has to test the kind of each result before it can use it.',
            fix: 'Return one kind of value from every branch, or split the function so that each part returns one kind.',
            example: '`function read(raw: boolean) { if (raw) return "1"; return 1; }` reports `mixed`.',
        },
        schema: [],
        messages: { mixed: 'This function returns values of different types. Return one type from every branch.' },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        if (types === undefined) return {};
        const frames: TSESTree.Expression[][] = [];
        return {
            ':function': () => frames.push([]),
            ReturnStatement: ({ argument }) => {
                if (argument !== null) frames.at(-1)?.push(argument);
            },
            ':function:exit': (node: FunctionNode) => {
                const values = frames.pop();
                if (values !== undefined && isMixedFunction(node, values, types))
                    context.report({ loc: getFunctionLocation(node, source), messageId: 'mixed' });
            },
        };
    },
});
