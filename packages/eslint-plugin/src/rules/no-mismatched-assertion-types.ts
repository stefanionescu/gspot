import { createRule } from '../rule.ts';
import { getTypes } from '../checker.ts';
import { readAssertion } from '../assertions.ts';
import type { TypeReader, CheckedType } from '../types/plugin.ts';
import { OPEN_CATEGORIES, TYPE_CATEGORIES } from '../config/matchers.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getCategories(types: TypeReader, type: CheckedType): string[] {
    const base = types.checker.getBaseTypeOfLiteralType(type);
    const members = base.isUnion() ? base.types : [base];
    return members.map((member) =>
        member.isTypeParameter() ? 'unknown' : (TYPE_CATEGORIES.get(types.checker.typeToString(member)) ?? 'object'),
    );
}

function getRootVariable(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | null {
    let value = node;
    while (value.type === AST_NODE_TYPES.ChainExpression || value.type === AST_NODE_TYPES.MemberExpression)
        value = value.type === AST_NODE_TYPES.ChainExpression ? value.expression : value.object;
    return value.type === AST_NODE_TYPES.Identifier ? ASTUtils.findVariable(source.getScope(value), value) : null;
}

function isStable(
    node: TSESTree.Node,
    types: TypeReader,
    patched: ReadonlySet<TSESLint.Scope.Variable>,
    source: TSESLint.SourceCode,
): boolean {
    const receiver = node.type === AST_NODE_TYPES.CallExpression ? getRootVariable(node.callee, source) : null;
    const writes = getRootVariable(node, source)?.references.filter((reference) => reference.isWrite()) ?? [];
    const isPatched = receiver !== null && patched.has(receiver);
    return (
        !isPatched &&
        writes.every(({ writeExpr }) => {
            const categories = writeExpr ? getCategories(types, types.get(writeExpr)) : ['unknown'];
            return !categories.includes('unknown');
        })
    );
}

function getIncompatibility(
    types: TypeReader,
    received: TSESTree.Node,
    expected: TSESTree.Node,
): Record<'received' | 'expected', string> | undefined {
    const left = types.checker.getBaseTypeOfLiteralType(types.get(received));
    const right = types.checker.getBaseTypeOfLiteralType(types.get(expected));
    const rightCategories = getCategories(types, right);
    const isComparable = getCategories(types, left).some((category) =>
        rightCategories.some(
            (other) => category === other || OPEN_CATEGORIES.has(category) || OPEN_CATEGORIES.has(other),
        ),
    );
    return isComparable
        ? undefined
        : { received: types.checker.typeToString(left), expected: types.checker.typeToString(right) };
}

export const noMismatchedAssertionTypes = createRule<[], 'incompatible'>({
    name: 'no-mismatched-assertion-types',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a strict or deep equality assertion of Jest, Vitest, Bun, Jasmine, Playwright, chai, Cypress, or node:assert whose two values have primitive types that never match, such as a string and a number. A union matches when one of its members can. It needs the type information of a TypeScript project. It skips values typed `any`, values assigned from such a value, and calls of a method that the file replaces.',
            why: 'Values of different primitive types never compare equal, so the assertion always fails, or always passes when negated, whatever the code under test does.',
            fix: 'Compare values of the same type: convert one side, such as `String(count)`, or assert the value that the code returns.',
            example:
                '`expect(count).toBe("3")` with a number `count` reports `incompatible`. Write `expect(count).toBe(3)`.',
        },
        schema: [],
        messages: {
            incompatible:
                'Review this assertion; it compares values of types that never match ("{{received}}" and "{{expected}}").',
        },
    },
    create(context) {
        const types = getTypes(context);
        const source = context.sourceCode;
        const patched = new Set<TSESLint.Scope.Variable>();
        if (types === undefined) return {};
        return {
            'AssignmentExpression[operator="="][left.type="MemberExpression"][right.type=/^(?:Arrow)?FunctionExpression$/]'(
                node: TSESTree.AssignmentExpression & { left: TSESTree.MemberExpression },
            ) {
                const variable = getRootVariable(node.left.object, source);
                if (variable !== null) patched.add(variable);
            },
            CallExpression(node) {
                const assertion = readAssertion(node, context);
                if (assertion?.kind !== 'comparison' || assertion.comparison === 'loose') return;
                const { received, expected } = assertion;
                const isChecked = [received, expected].every((side) => isStable(side, types, patched, source));
                const incompatibility = isChecked ? getIncompatibility(types, received, expected) : undefined;
                if (incompatibility !== undefined)
                    context.report({ node: assertion.report, messageId: 'incompatible', data: incompatibility });
            },
        };
    },
});
